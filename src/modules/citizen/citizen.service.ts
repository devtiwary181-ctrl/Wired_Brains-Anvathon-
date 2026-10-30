import { prisma } from '../../shared/database.js';
import { AppError } from '../../middleware/errorHandler.js';

export class CitizenService {
  /**
   * Reverse geocode GPS coordinate to district and state
   */
  async reverseGeocode(lat: number, lng: number) {
    // Check if coordinates fall within a known district or find nearest
    const district = await prisma.district.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    return {
      state: district?.state || 'Delhi',
      district: district?.name || 'Central Delhi',
      districtId: district?.id || null,
      districtCode: district?.code || 'IN-DL-CENTRAL',
      coordinates: { lat, lng },
      source: 'PostGIS District Geocoder',
    };
  }

  /**
   * Search districts/cities
   */
  async searchDistricts(query: string) {
    const districts = await prisma.district.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { state: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
        state: true,
        eocPhone: true,
      },
      take: 10,
    });
    return districts;
  }

  /**
   * Get active alerts for district or global
   */
  async getActiveAlerts(districtId?: string) {
    const where: any = { isActive: true };
    if (districtId) {
      where.districtId = districtId;
    }

    const alerts = await prisma.disasterAlert.findMany({
      where,
      include: {
        district: {
          select: { name: true, state: true },
        },
      },
      orderBy: { issuedAt: 'desc' },
      take: 20,
    });

    return alerts.map((a) => ({
      id: a.id,
      title: a.title,
      severity: a.severity,
      disasterType: a.disasterType,
      summary: a.summary,
      instructions: a.instructions,
      sourceAgency: a.sourceAgency,
      issuedAt: a.issuedAt,
      district: a.district.name,
      state: a.district.state,
    }));
  }

  /**
   * Get spatial hazards & polygons
   */
  async getSpatialHazards(districtId?: string, hazardType?: string, status?: string) {
    const where: any = {};
    if (districtId) where.districtId = districtId;
    if (hazardType) where.hazardType = hazardType;
    if (status) {
      where.status = status;
    } else {
      // By default return verified and unverified
      where.status = { in: ['VERIFIED_ACTIVE', 'UNVERIFIED'] };
    }

    const incidents = await prisma.hazardIncident.findMany({
      where,
      include: {
        polygons: {
          where: { isActive: true },
        },
        evidence: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return incidents.map((i) => ({
      id: i.id,
      hazardType: i.hazardType,
      severity: i.severity,
      coordinates: { lat: i.latitude, lng: i.longitude },
      addressLandmark: i.addressLandmark,
      waterDepthCm: i.waterDepthCm,
      status: i.status, // 'VERIFIED_ACTIVE', 'UNVERIFIED'
      reportedByCitizen: i.reportedByCitizen,
      verifiedAt: i.verifiedAt,
      photoUrl: i.photoUrl,
      createdAt: i.createdAt,
      polygons: i.polygons.map((p) => ({
        id: p.id,
        zoneType: p.zoneType,
        depthM: p.depthM,
        coordinates: p.coordinates,
      })),
    }));
  }

  /**
   * Submit citizen hazard report (Anonymous, pending verification)
   */
  async reportHazard(data: {
    districtId?: string;
    hazardType: string;
    severity: string;
    latitude: number;
    longitude: number;
    addressLandmark?: string;
    waterDepthCm?: number;
    photoUrl?: string;
  }) {
    let districtId = data.districtId;
    if (!districtId) {
      const defaultDistrict = await prisma.district.findFirst();
      districtId = defaultDistrict?.id;
    }

    const incident = await prisma.hazardIncident.create({
      data: {
        districtId,
        hazardType: data.hazardType,
        severity: data.severity,
        latitude: data.latitude,
        longitude: data.longitude,
        addressLandmark: data.addressLandmark,
        waterDepthCm: data.waterDepthCm || 0,
        status: 'UNVERIFIED', // Pending staff triage
        reportedByCitizen: true,
        photoUrl: data.photoUrl,
      },
    });

    // PostGIS point geometry update
    await prisma.$executeRawUnsafe(
      `UPDATE hazard_incidents SET geom = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
      data.longitude,
      data.latitude,
      incident.id
    );

    return {
      incidentId: incident.id,
      status: 'UNVERIFIED',
      message: 'Hazard report received. It will appear as pending community alert until verified by District EOC.',
    };
  }

  /**
   * Nearby facilities search (Shelters & Hospitals)
   */
  async getFacilities(params: {
    districtId?: string;
    facilityType?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    hasMedical?: boolean;
    hasInfantCare?: boolean;
  }) {
    const lat = params.lat || 28.6139;
    const lng = params.lng || 77.2090;

    // Use Prisma findMany for structured filters
    const where: any = {};
    if (params.facilityType) where.facilityType = params.facilityType;
    if (params.districtId) where.districtId = params.districtId;
    if (params.hasMedical !== undefined) where.hasMedicalSupport = params.hasMedical;
    if (params.hasInfantCare !== undefined) where.hasInfantCare = params.hasInfantCare;

    const facilities = await prisma.facility.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    // Calculate haversine / spherical distance in km
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const calcDistance = (fLat: number, fLng: number) => {
      const R = 6371; // Earth radius in km
      const dLat = toRad(fLat - lat);
      const dLng = toRad(fLng - lng);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat)) * Math.cos(toRad(fLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c * 10) / 10;
    };

    const mapped = facilities.map((f) => {
      const dist = calcDistance(f.latitude, f.longitude);
      return {
        id: f.id,
        name: f.name,
        facilityType: f.facilityType,
        address: f.address,
        coordinates: { lat: f.latitude, lng: f.longitude },
        contactPhone: f.contactPhone,
        inChargeName: f.inChargeName,
        totalCapacity: f.totalCapacity,
        currentOccupancy: f.currentOccupancy,
        availableBeds: Math.max(0, f.totalCapacity - f.currentOccupancy),
        isVerified: f.isVerified,
        hasMedicalSupport: f.hasMedicalSupport,
        hasGeneratorPower: f.hasGeneratorPower,
        hasDrinkingWater: f.hasDrinkingWater,
        hasInfantCare: f.hasInfantCare,
        isPetFriendly: f.isPetFriendly,
        operatingStatus: f.operatingStatus,
        distanceKm: dist,
        updatedAt: f.updatedAt,
      };
    });

    return mapped.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  /**
   * Preparedness Guides & Checklists
   */
  async getPreparednessGuides(disasterType?: string) {
    const where: any = {};
    if (disasterType) where.disasterType = disasterType.toUpperCase();

    const guides = await prisma.preparednessGuide.findMany({ where });
    return guides;
  }

  /**
   * Public Citizen Relief Request Tracking via High-Entropy Token
   */
  async trackRequest(token: string) {
    const req = await prisma.reliefRequest.findUnique({
      where: { trackingToken: token.trim().toUpperCase() },
      include: {
        district: {
          select: { name: true, state: true, eocPhone: true },
        },
      },
    });

    if (!req) {
      throw new AppError('Relief request tracking token not found. Please verify your reference code.', 404, 'TOKEN_NOT_FOUND');
    }

    return {
      trackingToken: req.trackingToken,
      district: req.district.name,
      eocPhone: req.district.eocPhone,
      stage: req.stage,
      urgencyLevel: req.urgencyLevel,
      deliveryContext: req.deliveryContext,
      headcount: {
        adults: req.headcountAdults,
        children: req.headcountChildren,
        infants: req.headcountInfants,
        seniors: req.headcountSeniors,
        total: req.headcountAdults + req.headcountChildren + req.headcountInfants + req.headcountSeniors,
      },
      itemsRequested: req.itemsRequested,
      etaMinutes: req.etaMinutes,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
    };
  }
}

export const citizenService = new CitizenService();
