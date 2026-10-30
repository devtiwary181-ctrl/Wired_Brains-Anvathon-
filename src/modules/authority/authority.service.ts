import argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler.js';
import { prisma } from '../../shared/database.js';
import { AuthenticatedUser } from '../auth/auth.middleware.js';
import { RoleType, ROLE_PERMISSIONS } from '../auth/rbac.js';
import { getFacilityUnknownFields } from '../../shared/facilityDataQuality.js';
import { notifyAuthorizedStaff } from '../../shared/notifications.js';

type AuditInput = {
  user: AuthenticatedUser;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
};

async function writeAudit(tx: Prisma.TransactionClient, input: AuditInput) {
  return tx.auditLog.create({
    data: {
      staffUserId: input.user.id,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
      ipAddress: input.ipAddress,
    },
  });
}

function districtFilter(user: AuthenticatedUser) {
  return user.districtId ? { districtId: user.districtId } : {};
}

async function requireDistrictAccess(user: AuthenticatedUser, districtId: string | null | undefined) {
  if (user.districtId && districtId !== user.districtId) {
    throw new AppError('Record is outside your assigned district.', 404, 'RECORD_NOT_FOUND');
  }
}

export class AuthorityService {
  async getDashboard(user: AuthenticatedUser) {
    const where = districtFilter(user);
    const now = new Date();
    const activeAlertWhere = { ...where, isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
    const [activeIncidents, activeHazards, pendingReports, verifiedReports, criticalAlerts, openRequests, criticalRequests, peopleAggregate, sosRecords, facilities, inventory, recentUpdates] = await Promise.all([
      prisma.hazardIncident.count({ where: { ...where, status: 'VERIFIED_ACTIVE' } }),
      prisma.hazardIncident.count({ where: { ...where, status: { in: ['VERIFIED_ACTIVE', 'UNVERIFIED'] } } }),
      user.permissions.includes('hazards:verify') ? prisma.hazardIncident.count({ where: { ...where, status: 'UNVERIFIED' } }) : Promise.resolve(null),
      user.permissions.includes('hazards:verify') ? prisma.hazardIncident.count({ where: { ...where, status: 'VERIFIED_ACTIVE' } }) : Promise.resolve(null),
      prisma.disasterAlert.count({ where: { ...activeAlertWhere, severity: { in: ['DANGER', 'EXTREME', 'CRITICAL'] } } }),
      user.permissions.includes('relief:triage') ? prisma.reliefRequest.count({ where: { ...where, stage: { notIn: ['STAGE_5_DELIVERED', 'CANCELLED'] } } }) : Promise.resolve(null),
      user.permissions.includes('relief:triage') ? prisma.reliefRequest.count({ where: { ...where, urgencyLevel: 'CRITICAL_LIFE_SAFETY', stage: { notIn: ['STAGE_3_ALLOCATED', 'STAGE_4_IN_TRANSIT', 'STAGE_5_DELIVERED', 'CANCELLED'] } } }) : Promise.resolve(null),
      user.permissions.includes('relief:triage') ? prisma.reliefRequest.aggregate({ where: { ...where, stage: { notIn: ['STAGE_5_DELIVERED', 'CANCELLED'] } }, _sum: { headcountAdults: true, headcountChildren: true, headcountInfants: true, headcountSeniors: true } }) : Promise.resolve({ _sum: { headcountAdults: null, headcountChildren: null, headcountInfants: null, headcountSeniors: null } }),
      user.permissions.includes('sos:view') && !user.districtId ? prisma.sosRecord.count({ where: { status: { not: 'RESOLVED' } } }) : Promise.resolve(null),
      user.permissions.includes('facilities:view') ? prisma.facility.groupBy({ by: ['facilityType', 'operatingStatus'], where, _count: { _all: true } }) : Promise.resolve([]),
      user.permissions.some(permission => permission === 'inventory:allocate' || permission === 'inventory:restock')
        ? prisma.depotInventory.findMany({ where: { depot: where }, include: { depot: { select: { id: true, name: true, districtId: true } } }, orderBy: [{ depot: { name: 'asc' } }, { itemName: 'asc' }] })
        : Promise.resolve([]),
      user.permissions.includes('audit:view')
        ? prisma.auditLog.findMany({ where: user.districtId ? { staffUser: { districtId: user.districtId } } : {}, include: { staffUser: { select: { fullName: true, role: true } } }, orderBy: { timestamp: 'desc' }, take: 20 })
        : Promise.resolve([]),
    ]);

    const supplyRequests = user.permissions.includes('relief:triage')
      ? await prisma.reliefRequest.groupBy({ by: ['stage'], where, _count: { _all: true } })
      : [];

    return {
      fetchedAt: new Date().toISOString(),
      districtId: user.districtId,
      scope: user.districtId ? 'ASSIGNED_DISTRICT' : 'ALL_DISTRICTS',
      demoDataLabel: 'Dashboard values are database records; seeded demonstration records may be present.',
      metrics: {
        activeIncidents,
        activeHazards,
        pendingReports,
        verifiedReports,
        criticalAlerts,
        openSupplyRequests: openRequests,
        criticalUnallocatedRequests: criticalRequests,
        trackedPeopleInOpenRequests: user.permissions.includes('relief:triage') ? (peopleAggregate._sum.headcountAdults || 0) + (peopleAggregate._sum.headcountChildren || 0) + (peopleAggregate._sum.headcountInfants || 0) + (peopleAggregate._sum.headcountSeniors || 0) : null,
        unresolvedSos: sosRecords,
      },
      facilities: facilities.map(item => ({ facilityType: item.facilityType, status: item.operatingStatus, count: item._count._all })),
      inventory: inventory.map(item => ({
        depotId: item.depotId,
        depotName: item.depot.name,
        itemSku: item.itemSku,
        itemName: item.itemName,
        quantityAvailable: item.quantityAvailable,
        quantityReserved: item.quantityReserved,
        quantityUnreserved: Math.max(0, item.quantityAvailable - item.quantityReserved),
        unit: item.unit,
        lastRestockedAt: item.lastRestockedAt,
      })),
      supplyRequests: supplyRequests.map(item => ({ stage: item.stage, count: item._count._all })),
      recentUpdates: recentUpdates.map(item => ({
        id: item.id,
        action: item.action,
        entityType: item.entityType,
        entityId: item.entityId,
        metadata: item.metadata,
        actor: item.staffUser?.fullName || 'System',
        actorRole: item.staffUser?.role || null,
        timestamp: item.timestamp,
      })),
    };
  }

  async listSos(user: AuthenticatedUser) {
    if (!user.districtId) {
      return prisma.sosRecord.findMany({ where: { status: { not: 'RESOLVED' } }, orderBy: { triggeredAt: 'desc' }, take: 200 });
    }
    const district = await prisma.district.findUnique({ where: { id: user.districtId }, select: { boundary: true } });
    const boundary = district?.boundary && typeof district.boundary === 'object' && !Array.isArray(district.boundary)
      ? district.boundary as { type?: string }
      : null;
    if (!boundary || !['Polygon', 'MultiPolygon'].includes(boundary.type || '')) {
      throw new AppError('SOS records cannot be district-filtered because this district has no usable boundary geometry.', 503, 'SOS_SCOPE_UNAVAILABLE');
    }
    return prisma.$queryRaw<Array<{ id: string; service_type: string; latitude: number | null; longitude: number | null; triggered_at: Date; status: string }>>`
      SELECT s.id, s.service_type, s.latitude, s.longitude, s.triggered_at, s.status
      FROM sos_records s
      JOIN districts d ON d.id = ${user.districtId}
      WHERE s.status <> 'RESOLVED'
        AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
        AND ST_Contains(
          ST_SetSRID(ST_GeomFromGeoJSON(d.boundary::text), 4326),
          ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326)
        )
      ORDER BY s.triggered_at DESC
      LIMIT 200
    `;
  }

  async listHazards(user: AuthenticatedUser, status?: string) {
    const incidents = await prisma.hazardIncident.findMany({
      where: { ...districtFilter(user), ...(status ? { status } : {}) },
      include: {
        district: { select: { id: true, name: true, state: true } },
        evidence: { orderBy: { uploadedAt: 'desc' } },
        polygons: { where: { isActive: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return incidents.map(incident => ({
      id: incident.id,
      district: incident.district,
      hazardType: incident.hazardType,
      severity: incident.severity,
      coordinates: { lat: incident.latitude, lng: incident.longitude },
      addressLandmark: incident.addressLandmark,
      description: incident.description,
      observedAt: incident.observedAt,
      contactInfo: incident.contactInfo,
      waterDepthCm: incident.waterDepthCm,
      status: incident.status,
      reportedByCitizen: incident.reportedByCitizen,
      verifiedByStaffId: incident.verifiedByStaffId,
      verifiedAt: incident.verifiedAt,
      evidence: incident.evidence,
      polygons: incident.polygons,
      createdAt: incident.createdAt,
      updatedAt: incident.updatedAt,
    }));
  }

  async listIncidents(user: AuthenticatedUser, status?: string) {
    const rawIncidents = await this.listHazards(user, status);
    const incidents = rawIncidents.map(({ contactInfo: _contactInfo, evidence: _evidence, ...incident }) => incident);
    if (!incidents.length) return [];
    const auditRows = await prisma.auditLog.findMany({
      where: { entityType: 'HazardIncident', entityId: { in: incidents.map(incident => incident.id) }, action: { in: ['CREATE_INCIDENT', 'UPDATE_INCIDENT', 'CLOSE_INCIDENT', 'VERIFY_HAZARD', 'REJECT_HAZARD'] } },
      select: { entityId: true, metadata: true, timestamp: true, staffUser: { select: { id: true, fullName: true } } },
      orderBy: { timestamp: 'desc' },
    });
    const latest = new Map<string, typeof auditRows[number]>();
    for (const audit of auditRows) if (!latest.has(audit.entityId)) latest.set(audit.entityId, audit);
    return incidents.map(incident => {
      const audit = latest.get(incident.id);
      const metadata = audit?.metadata && typeof audit.metadata === 'object' && !Array.isArray(audit.metadata) ? audit.metadata as Record<string, unknown> : {};
      return {
        ...incident,
        assignedStaffId: typeof metadata.assignedStaffId === 'string' ? metadata.assignedStaffId : null,
        operationalNotes: typeof metadata.notes === 'string' ? metadata.notes : typeof metadata.reason === 'string' ? metadata.reason : null,
        lastUpdatedBy: audit?.staffUser ?? null,
      };
    });
  }

  async listIncidentHistory(user: AuthenticatedUser, incidentId: string) {
    const incident = await prisma.hazardIncident.findUnique({ where: { id: incidentId }, select: { id: true, districtId: true } });
    if (!incident) throw new AppError('Incident not found.', 404, 'RECORD_NOT_FOUND');
    await requireDistrictAccess(user, incident.districtId);
    return prisma.auditLog.findMany({
      where: { entityType: 'HazardIncident', entityId: incidentId },
      include: { staffUser: { select: { id: true, fullName: true, role: true } } },
      orderBy: { timestamp: 'asc' },
    });
  }

  async decideHazard(user: AuthenticatedUser, incidentId: string, decision: 'VERIFY' | 'REJECT', reason: string, ipAddress?: string) {
    const incident = await prisma.hazardIncident.findUnique({ where: { id: incidentId }, select: { id: true, districtId: true, status: true } });
    if (!incident) throw new AppError('Hazard report not found.', 404, 'RECORD_NOT_FOUND');
    await requireDistrictAccess(user, incident.districtId);
    if (incident.status !== 'UNVERIFIED') throw new AppError('Only pending reports can be verified or rejected.', 409, 'INVALID_HAZARD_STATE');

    const status = decision === 'VERIFY' ? 'VERIFIED_ACTIVE' : 'REJECTED';
    return prisma.$transaction(async tx => {
      const updated = await tx.hazardIncident.update({
        where: { id: incidentId },
        data: {
          status,
          verifiedByStaffId: decision === 'VERIFY' ? user.id : null,
          verifiedAt: decision === 'VERIFY' ? new Date() : null,
        },
        select: { id: true, status: true, verifiedAt: true, district: { select: { id: true, name: true, state: true } } },
      });
      await writeAudit(tx, {
        user,
        action: decision === 'VERIFY' ? 'VERIFY_HAZARD' : 'REJECT_HAZARD',
        entityType: 'HazardIncident',
        entityId: incidentId,
        metadata: { previousStatus: incident.status, newStatus: status, reason } as Prisma.InputJsonValue,
        ipAddress,
      });
      return { id: updated.id, status: updated.status, verifiedAt: updated.verifiedAt, district: updated.district, message: decision === 'VERIFY' ? 'Report verified and now visible as an official active hazard.' : 'Report rejected and removed from citizen-visible active hazards.' };
    });
  }

  async createIncident(user: AuthenticatedUser, data: {
    districtId?: string;
    hazardType: string;
    severity: string;
    latitude: number;
    longitude: number;
    addressLandmark?: string;
    description?: string;
    status: 'UNVERIFIED' | 'VERIFIED_ACTIVE';
    assignedStaffId?: string;
    notes?: string;
    affectedArea?: { coordinates: unknown; zoneType: string; depthM?: number };
  }, ipAddress?: string) {
    const districtId = data.districtId || user.districtId;
    if (!districtId) throw new AppError('A district is required to create an incident.', 400, 'DISTRICT_REQUIRED');
    await requireDistrictAccess(user, districtId);
    if (data.assignedStaffId) {
      const assigned = await prisma.staffUser.findFirst({ where: { id: data.assignedStaffId, isActive: true, ...(user.districtId ? { districtId: user.districtId } : {}) }, select: { id: true } });
      if (!assigned) throw new AppError('Assigned staff member was not found in your district.', 404, 'STAFF_NOT_FOUND');
    }
    return prisma.$transaction(async tx => {
      const incident = await tx.hazardIncident.create({
        data: {
          districtId,
          hazardType: data.hazardType,
          severity: data.severity,
          latitude: data.latitude,
          longitude: data.longitude,
          addressLandmark: data.addressLandmark,
          description: data.description,
          status: data.status,
          reportedByCitizen: false,
          verifiedByStaffId: data.status === 'VERIFIED_ACTIVE' ? user.id : null,
          verifiedAt: data.status === 'VERIFIED_ACTIVE' ? new Date() : null,
        },
      });
      if (data.affectedArea) {
        await tx.hazardPolygon.create({
          data: {
            incidentId: incident.id,
            zoneType: data.affectedArea.zoneType,
            coordinates: data.affectedArea.coordinates as Prisma.InputJsonValue,
            depthM: data.affectedArea.depthM ?? 0,
          },
        });
      }
      await writeAudit(tx, {
        user,
        action: 'CREATE_INCIDENT',
        entityType: 'HazardIncident',
        entityId: incident.id,
        metadata: { notes: data.notes ?? null, assignedStaffId: data.assignedStaffId ?? null, status: data.status } as Prisma.InputJsonValue,
        ipAddress,
      });
      return incident;
    });
  }

  async updateIncident(user: AuthenticatedUser, incidentId: string, data: {
    severity?: string;
    status?: string;
    assignedStaffId?: string | null;
    notes?: string;
    affectedArea?: { coordinates: unknown; zoneType: string; depthM?: number };
  }, ipAddress?: string) {
    const existing = await prisma.hazardIncident.findUnique({ where: { id: incidentId }, select: { id: true, districtId: true, severity: true, status: true } });
    if (!existing) throw new AppError('Incident not found.', 404, 'RECORD_NOT_FOUND');
    await requireDistrictAccess(user, existing.districtId);
    if (data.assignedStaffId) {
      const assigned = await prisma.staffUser.findFirst({ where: { id: data.assignedStaffId, isActive: true, ...(user.districtId ? { districtId: user.districtId } : {}) }, select: { id: true } });
      if (!assigned) throw new AppError('Assigned staff member was not found in your district.', 404, 'STAFF_NOT_FOUND');
    }
    const previousAudit = await prisma.auditLog.findFirst({ where: { entityType: 'HazardIncident', entityId: incidentId, action: { in: ['CREATE_INCIDENT', 'UPDATE_INCIDENT', 'CLOSE_INCIDENT'] } }, orderBy: { timestamp: 'desc' }, select: { metadata: true } });
    const previousMetadata = previousAudit?.metadata && typeof previousAudit.metadata === 'object' && !Array.isArray(previousAudit.metadata) ? previousAudit.metadata as Record<string, unknown> : {};
    const assignedStaffId = Object.prototype.hasOwnProperty.call(data, 'assignedStaffId') ? data.assignedStaffId ?? null : typeof previousMetadata.assignedStaffId === 'string' ? previousMetadata.assignedStaffId : null;
    const operationalNotes = data.notes ?? (typeof previousMetadata.notes === 'string' ? previousMetadata.notes : null);
    return prisma.$transaction(async tx => {
      const updated = await tx.hazardIncident.update({
        where: { id: incidentId },
        data: {
          severity: data.severity,
          status: data.status,
          verifiedByStaffId: data.status === 'VERIFIED_ACTIVE' ? user.id : undefined,
          verifiedAt: data.status === 'VERIFIED_ACTIVE' ? new Date() : undefined,
        },
      });
      if (data.affectedArea) {
        await tx.hazardPolygon.updateMany({ where: { incidentId, isActive: true }, data: { isActive: false } });
        await tx.hazardPolygon.create({ data: {
          incidentId,
          zoneType: data.affectedArea.zoneType,
          coordinates: data.affectedArea.coordinates as Prisma.InputJsonValue,
          depthM: data.affectedArea.depthM ?? 0,
        } });
      }
      await writeAudit(tx, {
        user,
        action: data.status === 'RESOLVED' ? 'CLOSE_INCIDENT' : 'UPDATE_INCIDENT',
        entityType: 'HazardIncident',
        entityId: incidentId,
        metadata: {
          previousStatus: existing.status,
          status: updated.status,
          previousSeverity: existing.severity,
          severity: updated.severity,
          assignedStaffId,
          notes: operationalNotes,
        } as Prisma.InputJsonValue,
        ipAddress,
      });
      return updated;
    });
  }

  async listAlerts(user: AuthenticatedUser) {
    const alerts = await prisma.disasterAlert.findMany({
      where: districtFilter(user),
      include: { district: { select: { id: true, name: true, state: true } } },
      orderBy: { issuedAt: 'desc' },
      take: 200,
    });
    const history = alerts.length ? await prisma.auditLog.findMany({ where: { entityType: 'DisasterAlert', entityId: { in: alerts.map(alert => alert.id) }, action: { in: ['PUBLISH_ALERT', 'CREATE_ALERT_DRAFT', 'UPDATE_ALERT'] } }, select: { entityId: true, metadata: true, timestamp: true }, orderBy: { timestamp: 'desc' } }) : [];
    const translations = new Map<string, unknown>();
    for (const entry of history) {
      if (translations.has(entry.entityId)) continue;
      const metadata = entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata) ? entry.metadata as Record<string, unknown> : {};
      if (metadata.translations) translations.set(entry.entityId, metadata.translations);
    }
    return alerts.map(alert => ({ ...alert, translations: translations.get(alert.id) || {} }));
  }

  async alertHistory(user: AuthenticatedUser, alertId: string) {
    const alert = await prisma.disasterAlert.findUnique({ where: { id: alertId }, select: { id: true, districtId: true } });
    if (!alert) throw new AppError('Alert not found.', 404, 'RECORD_NOT_FOUND');
    await requireDistrictAccess(user, alert.districtId);
    return prisma.auditLog.findMany({ where: { entityType: 'DisasterAlert', entityId: alertId }, include: { staffUser: { select: { id: true, fullName: true, role: true } } }, orderBy: { timestamp: 'asc' } });
  }

  async createAlert(user: AuthenticatedUser, data: {
    districtId?: string;
    title: string;
    severity: string;
    disasterType: string;
    summary: string;
    instructions: string;
    sourceAgency: string;
    translations?: Record<string, { title: string; summary: string; instructions: string }>;
    expiresAt?: string;
    publish: boolean;
    confirmationText?: string;
  }, ipAddress?: string) {
    const districtId = data.districtId || user.districtId;
    if (!districtId) throw new AppError('A district is required to create an alert.', 400, 'DISTRICT_REQUIRED');
    await requireDistrictAccess(user, districtId);
    if (data.publish && data.confirmationText !== 'PUBLISH') throw new AppError('Type PUBLISH to confirm public alert release.', 400, 'PUBLISH_CONFIRMATION_REQUIRED');
    return prisma.$transaction(async tx => {
      const alert = await tx.disasterAlert.create({
        data: {
          districtId,
          title: data.title,
          severity: data.severity,
          disasterType: data.disasterType,
          summary: data.summary,
          instructions: data.instructions,
          sourceAgency: data.sourceAgency,
          isActive: data.publish,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        },
      });
      await writeAudit(tx, {
        user,
        action: data.publish ? 'PUBLISH_ALERT' : 'CREATE_ALERT_DRAFT',
        entityType: 'DisasterAlert',
        entityId: alert.id,
        metadata: { title: alert.title, severity: alert.severity, published: data.publish, translations: data.translations ?? {} } as Prisma.InputJsonValue,
        ipAddress,
      });
      return alert;
    });
  }

  async updateAlert(user: AuthenticatedUser, alertId: string, data: {
    title?: string;
    severity?: string;
    disasterType?: string;
    summary?: string;
    instructions?: string;
    expiresAt?: string | null;
    cancel?: boolean;
    confirmationText?: string;
    translations?: Record<string, { title: string; summary: string; instructions: string }>;
  }, ipAddress?: string) {
    const alert = await prisma.disasterAlert.findUnique({ where: { id: alertId }, select: { id: true, districtId: true, isActive: true } });
    if (!alert) throw new AppError('Alert not found.', 404, 'RECORD_NOT_FOUND');
    await requireDistrictAccess(user, alert.districtId);
    if (data.cancel && data.confirmationText !== 'CANCEL') throw new AppError('Type CANCEL to confirm alert cancellation.', 400, 'CANCEL_CONFIRMATION_REQUIRED');
    if (alert.isActive && !data.cancel && data.confirmationText !== 'UPDATE_AND_PUBLISH') throw new AppError('Active alert changes require explicit publish confirmation.', 400, 'PUBLISH_CONFIRMATION_REQUIRED');
    return prisma.$transaction(async tx => {
      const updated = await tx.disasterAlert.update({
        where: { id: alertId },
        data: {
          title: data.title,
          severity: data.severity,
          disasterType: data.disasterType,
          summary: data.summary,
          instructions: data.instructions,
          expiresAt: data.expiresAt === undefined ? undefined : data.expiresAt ? new Date(data.expiresAt) : null,
          isActive: data.cancel ? false : undefined,
        },
      });
      await writeAudit(tx, {
        user,
        action: data.cancel ? 'CANCEL_ALERT' : 'UPDATE_ALERT',
        entityType: 'DisasterAlert',
        entityId: alertId,
        metadata: { previousActive: alert.isActive, isActive: updated.isActive, changedFields: Object.keys(data), translations: data.translations } as Prisma.InputJsonValue,
        ipAddress,
      });
      return updated;
    });
  }

  async listFacilities(user: AuthenticatedUser) {
    const facilities = await prisma.facility.findMany({ where: districtFilter(user), include: { district: { select: { id: true, name: true } } }, orderBy: [{ facilityType: 'asc' }, { name: 'asc' }], take: 500 });
    const unknownByFacility = await getFacilityUnknownFields(facilities.map(facility => facility.id));
    return facilities.map(facility => ({
      ...facility,
      dataQuality: {
        unknownFields: [...(unknownByFacility.get(facility.id) || new Set())],
        stale: Date.now() - facility.updatedAt.getTime() > 24 * 60 * 60 * 1000,
      },
    }));
  }

  async createFacility(user: AuthenticatedUser, data: {
    districtId?: string;
    facilityType: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    contactPhone: string;
    totalCapacity: number;
    currentOccupancy: number;
    operatingStatus: string;
    hasMedicalSupport: boolean;
    hasGeneratorPower: boolean;
    hasDrinkingWater: boolean;
    hasInfantCare: boolean;
    isPetFriendly: boolean;
  }, ipAddress?: string) {
    const districtId = data.districtId || user.districtId;
    if (!districtId) throw new AppError('A district is required to add a facility.', 400, 'DISTRICT_REQUIRED');
    await requireDistrictAccess(user, districtId);
    if (data.currentOccupancy > data.totalCapacity) throw new AppError('Current occupancy cannot exceed total capacity.', 400, 'INVALID_CAPACITY');
    return prisma.$transaction(async tx => {
      const facility = await tx.facility.create({
        data: { ...data, districtId, isVerified: true },
      });
      await writeAudit(tx, { user, action: 'CREATE_FACILITY', entityType: 'Facility', entityId: facility.id, metadata: { districtId, facilityType: facility.facilityType, source: 'Authority staff entry' } as Prisma.InputJsonValue, ipAddress });
      return facility;
    });
  }

  async updateFacility(user: AuthenticatedUser, facilityId: string, data: {
    name?: string;
    address?: string;
    contactPhone?: string;
    totalCapacity?: number;
    currentOccupancy?: number;
    operatingStatus?: string;
    hasMedicalSupport?: boolean;
    hasGeneratorPower?: boolean;
    hasDrinkingWater?: boolean;
    hasInfantCare?: boolean;
    isPetFriendly?: boolean;
    isVerified?: boolean;
    markUnknown?: string[];
  }, ipAddress?: string) {
    const facility = await prisma.facility.findUnique({ where: { id: facilityId }, select: { id: true, districtId: true, totalCapacity: true, currentOccupancy: true } });
    if (!facility) throw new AppError('Facility not found.', 404, 'RECORD_NOT_FOUND');
    await requireDistrictAccess(user, facility.districtId);
    const effectiveCapacity = data.totalCapacity ?? facility.totalCapacity;
    const effectiveOccupancy = data.currentOccupancy ?? facility.currentOccupancy;
    if (effectiveOccupancy > effectiveCapacity) {
      throw new AppError('Current occupancy cannot exceed total capacity.', 400, 'INVALID_CAPACITY');
    }
    const permitted = { ...data } as Record<string, unknown>;
    delete permitted.markUnknown;
    if (data.markUnknown?.length) {
      for (const field of data.markUnknown) delete permitted[field];
    }
    return prisma.$transaction(async tx => {
      const updated = await tx.facility.update({ where: { id: facilityId }, data: permitted as Prisma.FacilityUpdateInput });
      await writeAudit(tx, {
        user,
        action: data.markUnknown?.length ? 'MARK_FACILITY_DATA_UNKNOWN' : 'UPDATE_FACILITY',
        entityType: 'Facility',
        entityId: facilityId,
        metadata: { changedFields: Object.keys(data), markedUnknown: data.markUnknown ?? [] } as Prisma.InputJsonValue,
        ipAddress,
      });
      return updated;
    });
  }

  async listReliefRequests(user: AuthenticatedUser, stage?: string) {
    return prisma.reliefRequest.findMany({
      where: { ...districtFilter(user), ...(stage ? { stage } : {}) },
      include: { district: { select: { id: true, name: true } }, auditLogs: { orderBy: { timestamp: 'desc' }, take: 5 } },
      orderBy: [{ urgencyLevel: 'desc' }, { createdAt: 'asc' }],
      take: 500,
    });
  }

  async transitionReliefRequest(user: AuthenticatedUser, requestId: string, data: {
    stage: string;
    notes: string;
    etaMinutes?: number;
    assignedResponderId?: string;
  }, ipAddress?: string) {
    const current = await prisma.reliefRequest.findUnique({ where: { id: requestId }, select: { id: true, districtId: true, stage: true } });
    if (!current) throw new AppError('Supply request not found.', 404, 'RECORD_NOT_FOUND');
    await requireDistrictAccess(user, current.districtId);
    const transitions: Record<string, string[]> = {
      STAGE_1_TRIAGED: ['STAGE_2_VERIFIED', 'CANCELLED'],
      STAGE_2_VERIFIED: ['CANCELLED'],
      STAGE_3_ALLOCATED: ['STAGE_4_IN_TRANSIT', 'CANCELLED'],
      STAGE_4_IN_TRANSIT: ['STAGE_5_DELIVERED', 'CANCELLED'],
      STAGE_5_DELIVERED: [],
      CANCELLED: [],
    };
    if (!transitions[current.stage]?.includes(data.stage)) throw new AppError('Invalid supply-request stage transition.', 409, 'INVALID_STAGE_TRANSITION');
    return prisma.$transaction(async tx => {
      const updated = await tx.reliefRequest.update({ where: { id: requestId }, data: {
        stage: data.stage,
        etaMinutes: data.etaMinutes,
        assignedResponderId: data.assignedResponderId,
        deliveredAt: data.stage === 'STAGE_5_DELIVERED' ? new Date() : undefined,
      } });
      await tx.requestAuditLog.create({ data: { requestId, previousStage: current.stage, newStage: data.stage, actorType: 'STAFF_OFFICER', actorId: user.id, notes: data.notes } });
      await writeAudit(tx, { user, action: 'TRANSITION_RELIEF_REQUEST', entityType: 'ReliefRequest', entityId: requestId, metadata: { previousStage: current.stage, newStage: data.stage, notes: data.notes } as Prisma.InputJsonValue, ipAddress });

      // If request reached STAGE_5_DELIVERED, complete inventory deduction from assigned depot
      if (data.stage === 'STAGE_5_DELIVERED' && updated.assignedDepotId) {
        const fullRequest = await tx.reliefRequest.findUnique({ where: { id: requestId }, select: { itemsRequested: true, assignedDepotId: true } });
        const items = fullRequest?.itemsRequested && typeof fullRequest.itemsRequested === 'object' && !Array.isArray(fullRequest.itemsRequested)
          ? fullRequest.itemsRequested as Record<string, unknown>
          : {};
        const skuMapping: Record<string, string> = { drinkingWater: 'WATER_20L', foodKits: 'DRY_RATION_KIT', babyFormula: 'BABY_FORMULA', firstAidKit: 'FIRST_AID_KIT', tarpaulin: 'TARPAULIN' };
        for (const [key, sku] of Object.entries(skuMapping)) {
          const val = items[key];
          const qty = typeof val === 'number' ? val : val === true ? 1 : 0;
          if (qty > 0 && fullRequest?.assignedDepotId) {
            const stock = await tx.depotInventory.findUnique({ where: { depotId_itemSku: { depotId: fullRequest.assignedDepotId, itemSku: sku } } });
            if (stock && stock.quantityReserved >= qty && stock.quantityAvailable >= qty) {
              const prevAvail = stock.quantityAvailable;
              const prevRes = stock.quantityReserved;
              const newAvail = prevAvail - qty;
              const newRes = prevRes - qty;
              await tx.depotInventory.update({
                where: { id: stock.id },
                data: { quantityAvailable: newAvail, quantityReserved: newRes },
              });
              await tx.inventoryMovement.create({
                data: {
                  depotId: fullRequest.assignedDepotId,
                  itemSku: sku,
                  movementType: 'DELIVER',
                  quantity: qty,
                  previousAvailable: prevAvail,
                  newAvailable: newAvail,
                  previousReserved: prevRes,
                  newReserved: newRes,
                  referenceId: requestId,
                  actorId: user.id,
                  notes: `Relief delivery fulfilled: Request ${requestId}`,
                },
              });
            }
          }
        }
      }

      // If request was CANCELLED after stock was allocated, release the reserved stock back
      if (data.stage === 'CANCELLED' && current.stage === 'STAGE_3_ALLOCATED') {
        const fullRequest = await tx.reliefRequest.findUnique({ where: { id: requestId }, select: { itemsRequested: true, assignedDepotId: true } });
        const items = fullRequest?.itemsRequested && typeof fullRequest.itemsRequested === 'object' && !Array.isArray(fullRequest.itemsRequested)
          ? fullRequest.itemsRequested as Record<string, unknown>
          : {};
        const skuMapping: Record<string, string> = { drinkingWater: 'WATER_20L', foodKits: 'DRY_RATION_KIT', babyFormula: 'BABY_FORMULA', firstAidKit: 'FIRST_AID_KIT', tarpaulin: 'TARPAULIN' };
        for (const [key, sku] of Object.entries(skuMapping)) {
          const val = items[key];
          const qty = typeof val === 'number' ? val : val === true ? 1 : 0;
          if (qty > 0 && fullRequest?.assignedDepotId) {
            const stock = await tx.depotInventory.findUnique({ where: { depotId_itemSku: { depotId: fullRequest.assignedDepotId, itemSku: sku } } });
            if (stock && stock.quantityReserved >= qty) {
              const prevAvail = stock.quantityAvailable;
              const prevRes = stock.quantityReserved;
              const newRes = prevRes - qty;
              await tx.depotInventory.update({
                where: { id: stock.id },
                data: { quantityReserved: newRes },
              });
              await tx.inventoryMovement.create({
                data: {
                  depotId: fullRequest.assignedDepotId,
                  itemSku: sku,
                  movementType: 'CANCEL_RELEASE',
                  quantity: qty,
                  previousAvailable: prevAvail,
                  newAvailable: prevAvail,
                  previousReserved: prevRes,
                  newReserved: newRes,
                  referenceId: requestId,
                  actorId: user.id,
                  notes: `Reservation released on request cancellation: Request ${requestId}`,
                },
              });
            }
          }
        }
      }

      // Notify authorized staff on request status changes
      notifyAuthorizedStaff({
        type: data.stage === 'STAGE_5_DELIVERED' ? 'DELIVERY_COMPLETED' : 'RELIEF_STAGE_CHANGED',
        title: `Relief Request Stage Updated: ${data.stage}`,
        message: `Request ${requestId} transitioned from ${current.stage} to ${data.stage}. Notes: ${data.notes}`,
        districtId: current.districtId,
        entityId: requestId,
        metadata: { previousStage: current.stage, newStage: data.stage, notes: data.notes },
      }).catch(() => {});

      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async allocateReliefRequest(user: AuthenticatedUser, requestId: string, data: {
    depotId: string;
    allocations: Array<{ itemSku: string; quantity: number }>;
    etaMinutes?: number;
    assignedResponderId?: string;
    notes: string;
  }, ipAddress?: string) {
    const request = await prisma.reliefRequest.findUnique({ where: { id: requestId }, select: { id: true, districtId: true, stage: true, itemsRequested: true } });
    if (!request) throw new AppError('Supply request not found.', 404, 'RECORD_NOT_FOUND');
    await requireDistrictAccess(user, request.districtId);
    if (request.stage !== 'STAGE_2_VERIFIED') throw new AppError('Only verified requests can be allocated.', 409, 'INVALID_STAGE_TRANSITION');
    const requestedItems = request.itemsRequested && typeof request.itemsRequested === 'object' && !Array.isArray(request.itemsRequested)
      ? request.itemsRequested as Record<string, unknown>
      : {};
    const demandForSku = (sku: string) => {
      const requestField: Record<string, string> = { WATER_20L: 'drinkingWater', DRY_RATION_KIT: 'foodKits', BABY_FORMULA: 'babyFormula', FIRST_AID_KIT: 'firstAidKit', TARPAULIN: 'tarpaulin' };
      const requested = requestedItems[requestField[sku] || ''];
      if (typeof requested === 'number') return requested;
      return requested === true ? 1 : 0;
    };
    const requestedBySku = new Map<string, number>();
    for (const allocation of data.allocations) requestedBySku.set(allocation.itemSku, (requestedBySku.get(allocation.itemSku) || 0) + allocation.quantity);
    for (const [sku, quantity] of requestedBySku) {
      if (quantity > demandForSku(sku)) throw new AppError(`Allocation for ${sku} exceeds the citizen's requested amount.`, 400, 'ALLOCATION_EXCEEDS_REQUEST');
    }
    const depot = await prisma.reliefDepot.findUnique({ where: { id: data.depotId }, select: { id: true, districtId: true, isOperational: true, name: true } });
    if (!depot || !depot.isOperational) throw new AppError('Operational depot not found.', 404, 'DEPOT_NOT_FOUND');
    await requireDistrictAccess(user, depot.districtId);
    if (!data.allocations.length) throw new AppError('At least one inventory item must be allocated.', 400, 'ALLOCATION_REQUIRED');

    return prisma.$transaction(async tx => {
      const reservedItems: Array<{ itemSku: string; quantity: number; remaining: number }> = [];
      for (const allocation of data.allocations) {
        const stock = await tx.depotInventory.findUnique({ where: { depotId_itemSku: { depotId: data.depotId, itemSku: allocation.itemSku } } });
        if (!stock) throw new AppError(`Inventory item ${allocation.itemSku} is unavailable at the selected depot.`, 409, 'STOCK_UNAVAILABLE');
        if (stock.quantityAvailable - stock.quantityReserved < allocation.quantity) {
          throw new AppError(`Insufficient unreserved stock for ${allocation.itemSku}.`, 409, 'INSUFFICIENT_STOCK');
        }
        const updatedStock = await tx.depotInventory.update({
          where: { id: stock.id },
          data: { quantityReserved: { increment: allocation.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            depotId: data.depotId,
            itemSku: allocation.itemSku,
            movementType: 'RESERVE',
            quantity: allocation.quantity,
            previousAvailable: stock.quantityAvailable,
            newAvailable: stock.quantityAvailable,
            previousReserved: stock.quantityReserved,
            newReserved: updatedStock.quantityReserved,
            referenceId: requestId,
            actorId: user.id,
            notes: `Stock reserved for Relief Request ${requestId}`,
          },
        });
        reservedItems.push({ itemSku: allocation.itemSku, quantity: allocation.quantity, remaining: updatedStock.quantityAvailable - updatedStock.quantityReserved });
      }
      const updatedRequest = await tx.reliefRequest.update({ where: { id: requestId }, data: {
        stage: 'STAGE_3_ALLOCATED',
        assignedDepotId: depot.id,
        assignedResponderId: data.assignedResponderId,
        etaMinutes: data.etaMinutes,
      } });
      await tx.requestAuditLog.create({ data: {
        requestId,
        previousStage: request.stage,
        newStage: 'STAGE_3_ALLOCATED',
        actorType: 'STAFF_OFFICER',
        actorId: user.id,
        notes: data.notes,
      } });
      await writeAudit(tx, { user, action: 'ALLOCATE_RELIEF_REQUEST', entityType: 'ReliefRequest', entityId: requestId, metadata: { depotId: depot.id, depotName: depot.name, allocations: reservedItems, notes: data.notes, previousStage: request.stage } as Prisma.InputJsonValue, ipAddress });

      // Notify authorized staff
      notifyAuthorizedStaff({
        type: 'INVENTORY_ALLOCATED',
        title: 'Relief Supplies Allocated',
        message: `Depot ${depot.name} allocated supplies for request ${requestId}. Items: ${reservedItems.map(r => `${r.quantity}x ${r.itemSku}`).join(', ')}.`,
        districtId: depot.districtId,
        entityId: requestId,
        metadata: { depotId: depot.id, allocations: reservedItems, notes: data.notes },
      }).catch(() => {});

      return { request: updatedRequest, depot, allocations: reservedItems };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async listInventory(user: AuthenticatedUser) {
    return prisma.depotInventory.findMany({ where: { depot: districtFilter(user) }, include: { depot: { include: { district: { select: { id: true, name: true } } } } }, orderBy: [{ depot: { name: 'asc' } }, { itemName: 'asc' }] });
  }

  async adjustInventory(user: AuthenticatedUser, inventoryId: string, data: { quantityAvailable: number; reason: string }, ipAddress?: string) {
    const item = await prisma.depotInventory.findUnique({ where: { id: inventoryId }, include: { depot: { select: { districtId: true } } } });
    if (!item) throw new AppError('Inventory item not found.', 404, 'RECORD_NOT_FOUND');
    await requireDistrictAccess(user, item.depot.districtId);
    return prisma.$transaction(async tx => {
      const current = await tx.depotInventory.findUnique({ where: { id: inventoryId }, select: { quantityReserved: true, quantityAvailable: true, depotId: true, itemSku: true } });
      if (!current) throw new AppError('Inventory item not found.', 404, 'RECORD_NOT_FOUND');
      if (data.quantityAvailable < current.quantityReserved) throw new AppError('Available stock cannot be lower than already reserved stock.', 409, 'STOCK_RESERVED');
      const updated = await tx.depotInventory.update({ where: { id: inventoryId }, data: { quantityAvailable: data.quantityAvailable, lastRestockedAt: data.quantityAvailable > current.quantityAvailable ? new Date() : undefined } });
      await tx.inventoryMovement.create({
        data: {
          depotId: current.depotId,
          itemSku: current.itemSku,
          movementType: data.quantityAvailable > current.quantityAvailable ? 'RESTOCK' : 'ADJUSTMENT',
          quantity: Math.abs(data.quantityAvailable - current.quantityAvailable),
          previousAvailable: current.quantityAvailable,
          newAvailable: updated.quantityAvailable,
          previousReserved: current.quantityReserved,
          newReserved: current.quantityReserved,
          referenceId: inventoryId,
          actorId: user.id,
          notes: data.reason,
        },
      });
      await writeAudit(tx, { user, action: 'ADJUST_INVENTORY', entityType: 'DepotInventory', entityId: inventoryId, metadata: { previousQuantity: item.quantityAvailable, quantityAvailable: updated.quantityAvailable, quantityReserved: item.quantityReserved, reason: data.reason } as Prisma.InputJsonValue, ipAddress });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async getInventoryMovements(user: AuthenticatedUser, depotId?: string) {
    if (depotId) {
      const depot = await prisma.reliefDepot.findUnique({ where: { id: depotId }, select: { districtId: true } });
      if (depot) await requireDistrictAccess(user, depot.districtId);
    }
    return prisma.inventoryMovement.findMany({
      where: depotId ? { depotId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async acknowledgeSos(user: AuthenticatedUser, sosId: string, notes?: string, ipAddress?: string) {
    const record = await prisma.sosRecord.findUnique({ where: { id: sosId } });
    if (!record) throw new AppError('SOS record not found.', 404, 'RECORD_NOT_FOUND');
    return prisma.$transaction(async tx => {
      const updated = await tx.sosRecord.update({
        where: { id: sosId },
        data: {
          status: 'ACKNOWLEDGED',
          acknowledgedAt: new Date(),
          acknowledgedByStaffId: user.id,
          responderNotes: notes || 'Acknowledged by emergency control staff',
        },
      });
      await writeAudit(tx, { user, action: 'ACKNOWLEDGE_SOS', entityType: 'SosRecord', entityId: sosId, metadata: { previousStatus: record.status, newStatus: 'ACKNOWLEDGED', notes } as Prisma.InputJsonValue, ipAddress });
      return updated;
    });
  }

  async updateSosStatus(user: AuthenticatedUser, sosId: string, status: 'RESPONDER_DISPATCHED' | 'RESOLVED', notes?: string, ipAddress?: string) {
    const record = await prisma.sosRecord.findUnique({ where: { id: sosId } });
    if (!record) throw new AppError('SOS record not found.', 404, 'RECORD_NOT_FOUND');
    return prisma.$transaction(async tx => {
      const updated = await tx.sosRecord.update({
        where: { id: sosId },
        data: {
          status,
          responderNotes: notes || undefined,
          resolvedAt: status === 'RESOLVED' ? new Date() : undefined,
        },
      });
      await writeAudit(tx, { user, action: 'UPDATE_SOS_STATUS', entityType: 'SosRecord', entityId: sosId, metadata: { previousStatus: record.status, newStatus: status, notes } as Prisma.InputJsonValue, ipAddress });
      return updated;
    });
  }

  async listStaff(user: AuthenticatedUser) {
    return prisma.staffUser.findMany({ where: user.districtId ? { districtId: user.districtId } : {}, select: { id: true, username: true, fullName: true, email: true, phoneNumber: true, role: true, districtId: true, isActive: true, createdAt: true, updatedAt: true }, orderBy: { fullName: 'asc' } });
  }

  async staffHistory(user: AuthenticatedUser, staffId: string) {
    const staff = await prisma.staffUser.findUnique({ where: { id: staffId }, select: { id: true, districtId: true } });
    if (!staff) throw new AppError('Staff account not found.', 404, 'RECORD_NOT_FOUND');
    await requireDistrictAccess(user, staff.districtId);
    return prisma.auditLog.findMany({ where: { staffUserId: staffId }, orderBy: { timestamp: 'asc' } });
  }

  async createStaff(user: AuthenticatedUser, data: { username: string; fullName: string; email: string; phoneNumber: string; password: string; role: RoleType; districtId?: string }, ipAddress?: string) {
    if (data.role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN') throw new AppError('Only a super administrator may grant the SUPER_ADMIN role.', 403, 'ROLE_ESCALATION_DENIED');
    const districtId = data.districtId || user.districtId;
    if (!districtId) throw new AppError('A district is required for staff accounts.', 400, 'DISTRICT_REQUIRED');
    await requireDistrictAccess(user, districtId);
    if (!ROLE_PERMISSIONS[data.role]) throw new AppError('Invalid role.', 400, 'INVALID_ROLE');
    const passwordHash = await argon2.hash(data.password);
    return prisma.$transaction(async tx => {
      const staff = await tx.staffUser.create({ data: {
        username: data.username,
        fullName: data.fullName,
        email: data.email.toLowerCase(),
        phoneNumber: data.phoneNumber,
        passwordHash,
        role: data.role,
        districtId,
      }, select: { id: true, username: true, fullName: true, email: true, phoneNumber: true, role: true, districtId: true, isActive: true } });
      await writeAudit(tx, { user, action: 'CREATE_STAFF_ACCOUNT', entityType: 'StaffUser', entityId: staff.id, metadata: { role: staff.role, districtId } as Prisma.InputJsonValue, ipAddress });
      return { ...staff, permissions: ROLE_PERMISSIONS[data.role] };
    });
  }

  async updateStaff(user: AuthenticatedUser, staffId: string, data: { role?: RoleType; isActive?: boolean; districtId?: string }, ipAddress?: string) {
    const existing = await prisma.staffUser.findUnique({ where: { id: staffId }, select: { id: true, role: true, isActive: true, districtId: true } });
    if (!existing) throw new AppError('Staff account not found.', 404, 'RECORD_NOT_FOUND');
    await requireDistrictAccess(user, existing.districtId);
    if (data.districtId) await requireDistrictAccess(user, data.districtId);
    if (data.role && !ROLE_PERMISSIONS[data.role]) throw new AppError('Invalid role.', 400, 'INVALID_ROLE');
    if (data.role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN') throw new AppError('Only a super administrator may grant the SUPER_ADMIN role.', 403, 'ROLE_ESCALATION_DENIED');
    return prisma.$transaction(async tx => {
      const updated = await tx.staffUser.update({ where: { id: staffId }, data, select: { id: true, username: true, fullName: true, role: true, districtId: true, isActive: true } });
      if (data.isActive === false) await tx.staffSession.deleteMany({ where: { staffUserId: staffId } });
      await writeAudit(tx, { user, action: data.isActive === false ? 'DISABLE_STAFF_ACCOUNT' : 'UPDATE_STAFF_ACCOUNT', entityType: 'StaffUser', entityId: staffId, metadata: { previousRole: existing.role, role: updated.role, isActive: updated.isActive, previousDistrictId: existing.districtId, districtId: updated.districtId, permissions: ROLE_PERMISSIONS[updated.role as RoleType] || [] } as Prisma.InputJsonValue, ipAddress });
      return { ...updated, permissions: ROLE_PERMISSIONS[updated.role as RoleType] || [] };
    });
  }
}

export const authorityService = new AuthorityService();
