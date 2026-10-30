/**
 * Citizen Service — DisasterReady India
 * All public citizen operations: zero authentication required.
 *
 * Covers Phase 4 requirements:
 * - Language/location onboarding (geo search, reverse geocode)
 * - Citizen dashboard data (alerts, hazards, facilities, announcements)
 * - Hazard map (markers, polygons, filters)
 * - Hazard reporting (with spam/duplicate protection)
 * - Shelters & hospitals search (distance-sorted)
 * - Preparedness guides & checklists
 * - Anonymous request creation and tracking (high-entropy tokens)
 * - SOS event logging
 * - Announcements feed
 */
import { prisma } from '../../shared/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import { getFacilityUnknownFields } from '../../shared/facilityDataQuality.js';
import { notifyAuthorizedStaff } from '../../shared/notifications.js';
import crypto from 'crypto';
// ---------------------------------------------------------------------------
// Helper: Generate cryptographically secure high-entropy tracking token
// URL-safe opaque bearer token with 256 bits of entropy.
// ---------------------------------------------------------------------------
function generateTrackingToken() {
    return `DR-${crypto.randomBytes(32).toString('base64url')}`;
}
export class CitizenService {
    // =========================================================================
    // 1. GEOLOCATION & LOCATION ONBOARDING
    // =========================================================================
    /**
     * Reverse geocode GPS coordinate to district and state.
     */
    async reverseGeocode(lat, lng) {
        return {
            state: null,
            district: null,
            districtId: null,
            districtCode: null,
            coordinates: { lat, lng },
            source: 'GPS coordinates; district boundary data is unavailable',
            timestamp: new Date().toISOString(),
        };
    }
    /**
     * Search districts / cities / landmarks by free-text query.
     */
    async searchDistricts(query) {
        if (!query || query.trim().length < 2) {
            return [];
        }
        const districts = await prisma.district.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { state: { contains: query, mode: 'insensitive' } },
                    { code: { contains: query, mode: 'insensitive' } },
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
    // =========================================================================
    // 2. CITIZEN DASHBOARD
    // =========================================================================
    /**
     * Aggregate dashboard data: alerts, hazards, facilities, announcements.
     */
    async getDashboard(districtId) {
        const [alerts, hazards, facilities, announcements] = await Promise.all([
            this.getActiveAlerts(districtId),
            this.getSpatialHazards(districtId, undefined, undefined),
            this.getFacilities({ districtId, facilityType: 'SHELTER' }),
            this.getAnnouncements(districtId),
        ]);
        const criticalAlerts = alerts.filter((a) => a.severity === 'DANGER' || a.severity === 'EXTREME');
        const activeHazardCount = hazards.length;
        const operationalShelters = facilities.filter((f) => f.operatingStatus === 'OPERATIONAL').length;
        return {
            meta: {
                fetchedAt: new Date().toISOString(),
                districtId: districtId || null,
                disclaimer: 'Absence of a hazard marker does NOT imply an area is safe. Always follow official instructions.',
            },
            summary: {
                criticalAlertCount: criticalAlerts.length,
                activeHazardCount,
                operationalShelterCount: operationalShelters,
                announcementCount: announcements.length,
            },
            alerts: alerts.slice(0, 5),
            recentHazards: hazards.slice(0, 8),
            nearestShelters: facilities.slice(0, 3),
            announcements: announcements.slice(0, 5),
        };
    }
    /**
     * Get active official alerts.
     */
    async getActiveAlerts(districtId) {
        const where = { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };
        if (districtId) {
            where.districtId = districtId;
        }
        const alerts = await prisma.disasterAlert.findMany({
            where,
            include: {
                district: { select: { name: true, state: true } },
            },
            orderBy: { issuedAt: 'desc' },
            take: 20,
        });
        const translationHistory = alerts.length ? await prisma.auditLog.findMany({
            where: { entityType: 'DisasterAlert', entityId: { in: alerts.map(alert => alert.id) }, action: { in: ['PUBLISH_ALERT', 'CREATE_ALERT_DRAFT', 'UPDATE_ALERT'] } },
            select: { entityId: true, metadata: true },
            orderBy: { timestamp: 'desc' },
        }) : [];
        const translations = new Map();
        for (const entry of translationHistory) {
            if (translations.has(entry.entityId))
                continue;
            const metadata = entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata) ? entry.metadata : {};
            if (metadata.translations)
                translations.set(entry.entityId, metadata.translations);
        }
        return alerts.map((a) => ({
            id: a.id,
            title: a.title,
            severity: a.severity,
            disasterType: a.disasterType,
            summary: a.summary,
            instructions: a.instructions,
            sourceAgency: a.sourceAgency,
            issuedAt: a.issuedAt,
            expiresAt: a.expiresAt,
            district: a.district.name,
            state: a.district.state,
            translations: translations.get(a.id) || {},
            freshness: computeFreshness(a.issuedAt),
        }));
    }
    /**
     * Get announcements (official broadcast messages).
     */
    async getAnnouncements(districtId) {
        const now = new Date();
        const where = {
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        };
        if (districtId) {
            where.districtId = districtId;
        }
        const announcements = await prisma.announcement.findMany({
            where,
            orderBy: { issuedAt: 'desc' },
            take: 20,
        });
        return announcements.map((a) => ({
            id: a.id,
            title: a.title,
            message: a.message,
            severity: a.severity,
            issuedBy: a.issuedBy,
            issuedAt: a.issuedAt,
            freshness: computeFreshness(a.issuedAt),
        }));
    }
    // =========================================================================
    // 3. HAZARD OVERVIEW & MAP
    // =========================================================================
    /**
     * Spatial hazards with filters: type, severity, status, time range.
     * Includes polygons, verification status, and data source clarity.
     */
    async getSpatialHazards(districtId, hazardType, statusFilter, severity, since) {
        const where = {};
        if (districtId)
            where.districtId = districtId;
        if (hazardType)
            where.hazardType = hazardType;
        if (severity)
            where.severity = severity;
        // Status filter
        if (statusFilter) {
            where.status = statusFilter;
        }
        else {
            where.status = { in: ['VERIFIED_ACTIVE', 'UNVERIFIED'] };
        }
        // Time filter
        if (since) {
            const sinceDate = new Date(since);
            if (!isNaN(sinceDate.getTime())) {
                where.createdAt = { gte: sinceDate };
            }
        }
        const incidents = await prisma.hazardIncident.findMany({
            where,
            include: {
                polygons: { where: { isActive: true } },
                evidence: true,
                district: { select: { name: true, state: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        return incidents.map((i) => ({
            id: i.id,
            hazardType: i.hazardType,
            severity: i.severity,
            coordinates: { lat: i.latitude, lng: i.longitude },
            addressLandmark: i.addressLandmark,
            waterDepthCm: i.waterDepthCm,
            // Explicit classification for UI rendering
            reportCategory: classifyReport(i.reportedByCitizen, i.status),
            status: i.status,
            verifiedAt: i.verifiedAt,
            district: i.district?.name,
            state: i.district?.state,
            evidenceCount: i.evidence.length,
            hasPhoto: !!i.photoUrl,
            createdAt: i.createdAt,
            freshness: computeFreshness(i.createdAt),
            polygons: i.polygons.map((p) => ({
                id: p.id,
                zoneType: p.zoneType,
                depthM: p.depthM,
                coordinates: p.coordinates,
            })),
            // Safety disclaimer always included
            disclaimer: 'No hazard marker shown here does NOT mean the area is safe. Always follow District EOC instructions.',
        }));
    }
    // =========================================================================
    // 4. HAZARD REPORTING
    // =========================================================================
    /**
     * Submit anonymous citizen hazard report with duplicate protection.
     */
    async reportHazard(data) {
        // Spam & duplicate check: same location + type within last 30 minutes
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const recentDuplicate = await prisma.hazardIncident.findFirst({
            where: {
                reportedByCitizen: true,
                hazardType: data.hazardType,
                status: 'UNVERIFIED',
                createdAt: { gte: thirtyMinutesAgo },
                // Approximate location match: ±0.001 degree (~100m)
                latitude: {
                    gte: data.latitude - 0.001,
                    lte: data.latitude + 0.001,
                },
                longitude: {
                    gte: data.longitude - 0.001,
                    lte: data.longitude + 0.001,
                },
            },
        });
        if (recentDuplicate) {
            return {
                incidentId: recentDuplicate.id,
                status: 'DUPLICATE_PENDING',
                message: 'A similar hazard has already been reported at this location. Your report has been noted and will reinforce the existing alert.',
                isDuplicate: true,
            };
        }
        // Resolve district
        let districtId = data.districtId;
        if (!districtId) {
            const defaultDistrict = await prisma.district.findFirst();
            districtId = defaultDistrict?.id;
        }
        // Parse optional observation time
        const incident = await prisma.hazardIncident.create({
            data: {
                districtId,
                hazardType: data.hazardType,
                severity: data.severity,
                latitude: data.latitude,
                longitude: data.longitude,
                addressLandmark: data.addressLandmark,
                description: data.description,
                observedAt: data.observationTime ? new Date(data.observationTime) : undefined,
                contactInfo: data.contactInfo,
                waterDepthCm: data.waterDepthCm || 0,
                status: 'UNVERIFIED',
                reportedByCitizen: true,
                photoUrl: data.photoUrl,
            },
        });
        if (data.photoUrl) {
            await prisma.hazardEvidence.create({
                data: {
                    incidentId: incident.id,
                    mediaUrl: data.photoUrl,
                    mediaType: 'IMAGE',
                },
            });
        }
        // PostGIS point update
        await prisma.$executeRawUnsafe(`UPDATE hazard_incidents SET geom = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`, data.longitude, data.latitude, incident.id);
        return {
            incidentId: incident.id,
            status: 'UNVERIFIED',
            isDuplicate: false,
            message: 'Hazard report received and queued for District EOC verification. It will appear as a community alert once verified by NDRF staff.',
            submittedAt: incident.createdAt,
        };
    }
    // =========================================================================
    // 5. SHELTERS & HOSPITALS
    // =========================================================================
    /**
     * Nearby facility search with Haversine distance sorting.
     * Never fabricates capacity or availability data.
     */
    async getFacilities(params) {
        const hasOrigin = params.lat !== undefined && params.lng !== undefined;
        const userLat = params.lat ?? 0;
        const userLng = params.lng ?? 0;
        const where = {};
        if (params.facilityType)
            where.facilityType = params.facilityType;
        if (params.districtId)
            where.districtId = params.districtId;
        const facilities = await prisma.facility.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            take: 50,
        });
        const unknownByFacility = await getFacilityUnknownFields(facilities.map(facility => facility.id));
        const toRad = (deg) => (deg * Math.PI) / 180;
        const haversine = (fLat, fLng) => {
            const R = 6371;
            const dLat = toRad(fLat - userLat);
            const dLng = toRad(fLng - userLng);
            const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(userLat)) * Math.cos(toRad(fLat)) * Math.sin(dLng / 2) ** 2;
            return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
        };
        const mapped = facilities
            .map((f) => {
            const unknown = unknownByFacility.get(f.id) || new Set();
            const capacityUnknown = unknown.has('totalCapacity') || unknown.has('currentOccupancy');
            const updatedAgeMs = Date.now() - f.updatedAt.getTime();
            return ({
                id: f.id,
                name: f.name,
                facilityType: f.facilityType,
                address: f.address,
                coordinates: { lat: f.latitude, lng: f.longitude },
                contactPhone: f.isVerified && !unknown.has('contactPhone') ? f.contactPhone : null,
                inChargeName: f.inChargeName,
                // Real capacity data — never fabricated
                totalCapacity: capacityUnknown ? null : f.totalCapacity,
                currentOccupancy: capacityUnknown ? null : f.currentOccupancy,
                availableBeds: capacityUnknown ? null : Math.max(0, f.totalCapacity - f.currentOccupancy),
                capacitySource: capacityUnknown ? 'Capacity data marked unknown' : 'Last reported by facility in-charge',
                services: {
                    medical: unknown.has('hasMedicalSupport') ? null : f.hasMedicalSupport,
                    generatorPower: unknown.has('hasGeneratorPower') ? null : f.hasGeneratorPower,
                    drinkingWater: unknown.has('hasDrinkingWater') ? null : f.hasDrinkingWater,
                    infantCare: unknown.has('hasInfantCare') ? null : f.hasInfantCare,
                    petFriendly: unknown.has('isPetFriendly') ? null : f.isPetFriendly,
                },
                dataQuality: { unknownFields: [...unknown], stale: updatedAgeMs > 24 * 60 * 60 * 1000 },
                isVerified: f.isVerified,
                operatingStatus: f.operatingStatus,
                distanceKm: hasOrigin ? haversine(f.latitude, f.longitude) : null,
                lastUpdated: f.updatedAt,
                source: f.isVerified ? 'Verified by District EOC' : 'Community-reported, not yet verified',
            });
        })
            .filter((f) => {
            if (params.hasMedical !== undefined && f.services.medical !== params.hasMedical)
                return false;
            if (params.hasInfantCare !== undefined && f.services.infantCare !== params.hasInfantCare)
                return false;
            if (params.hasPower !== undefined && f.services.generatorPower !== params.hasPower)
                return false;
            if (params.hasDrinkingWater !== undefined && f.services.drinkingWater !== params.hasDrinkingWater)
                return false;
            if (params.radiusKm && hasOrigin && f.distanceKm != null)
                return f.distanceKm <= params.radiusKm;
            return true;
        })
            .sort((a, b) => hasOrigin
            ? (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
            : b.lastUpdated.getTime() - a.lastUpdated.getTime());
        return mapped;
    }
    // =========================================================================
    // 6. PREPAREDNESS
    // =========================================================================
    /**
     * Disaster-specific preparedness guides with before/during/after sections.
     */
    async getPreparednessGuides(disasterType) {
        const where = {};
        if (disasterType)
            where.disasterType = disasterType.toUpperCase();
        const guides = await prisma.preparednessGuide.findMany({ where });
        return guides.map((g) => ({
            id: g.id,
            disasterType: g.disasterType,
            title: g.title,
            sections: g.sections,
            updatedAt: g.updatedAt,
        }));
    }
    // =========================================================================
    // 7. RELIEF REQUESTS (ANONYMOUS SUBMISSION + HIGH-ENTROPY TRACKING)
    // =========================================================================
    /**
     * Submit an anonymous citizen relief request.
     * Returns a high-entropy tracking token — no login required.
     */
    async createReliefRequest(data) {
        let districtId = data.districtId;
        if (!districtId) {
            const defaultDistrict = await prisma.district.findFirst();
            districtId = defaultDistrict?.id;
        }
        // Generate unique high-entropy token (retry on collision)
        let trackingToken = generateTrackingToken();
        let attempt = 0;
        while (attempt < 5) {
            const existing = await prisma.reliefRequest.findUnique({ where: { trackingToken } });
            if (!existing)
                break;
            trackingToken = generateTrackingToken();
            attempt++;
        }
        const relief = await prisma.reliefRequest.create({
            data: {
                trackingToken,
                districtId,
                requesterPhone: data.requesterPhone,
                headcountAdults: data.headcountAdults,
                headcountChildren: data.headcountChildren,
                headcountInfants: data.headcountInfants,
                headcountSeniors: data.headcountSeniors,
                deliveryContext: data.deliveryContext,
                urgencyLevel: data.urgencyLevel,
                latitude: data.latitude,
                longitude: data.longitude,
                landmarkNotes: data.landmarkNotes,
                itemsRequested: data.itemsRequested,
                specialMedicalNeeds: data.specialMedicalNeeds,
                stage: 'STAGE_1_TRIAGED',
            },
        });
        // PostGIS spatial update
        await prisma.$executeRawUnsafe(`UPDATE relief_requests SET geom = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`, data.longitude, data.latitude, relief.id);
        // Audit trail entry
        await prisma.requestAuditLog.create({
            data: {
                requestId: relief.id,
                previousStage: null,
                newStage: 'STAGE_1_TRIAGED',
                actorType: 'CITIZEN',
                notes: 'Citizen submitted anonymous relief request via DisasterReady Portal.',
            },
        });
        // Notify authorized staff and EOC
        const totalPeople = data.headcountAdults + data.headcountChildren + data.headcountInfants + data.headcountSeniors;
        notifyAuthorizedStaff({
            type: 'NEW_RELIEF_REQUEST',
            title: `New Relief Request: ${data.urgencyLevel} Urgency`,
            message: `${totalPeople} people in need at (${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}). Context: ${data.deliveryContext}.`,
            districtId: relief.districtId,
            entityId: relief.id,
            metadata: { trackingToken, urgencyLevel: data.urgencyLevel, totalPeople },
        }).catch(() => { });
        return {
            requestId: relief.id,
            trackingToken,
            stage: relief.stage,
            estimatedResponseMinutes: estimateResponseTime(data.urgencyLevel),
            eocPhone: null, // Will be populated when district EOC is assigned
            message: 'Your relief request has been received and queued for District EOC triage. Use your tracking token to monitor status.',
            submittedAt: relief.createdAt,
        };
    }
    /**
     * Track relief request by high-entropy token — no login required.
     */
    async trackRequest(token) {
        const sanitized = token.trim();
        // Validate format to prevent ID oracle attacks
        if (!/^DR-[A-Za-z0-9_-]{43}$/.test(sanitized)) {
            throw new AppError('Invalid tracking token format.', 400, 'INVALID_TOKEN_FORMAT');
        }
        const req = await prisma.reliefRequest.findUnique({
            where: { trackingToken: sanitized },
            include: {
                district: { select: { name: true, state: true, eocPhone: true } },
                auditLogs: { orderBy: { timestamp: 'asc' } },
            },
        });
        if (!req) {
            throw new AppError('Relief request tracking token not found. Please verify your reference code.', 404, 'TOKEN_NOT_FOUND');
        }
        return {
            trackingToken: req.trackingToken,
            district: req.district.name,
            state: req.district.state,
            eocPhone: req.district.eocPhone,
            stage: req.stage,
            stageLabel: stageLabel(req.stage),
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
            deliveredAt: req.deliveredAt,
            timeline: req.auditLogs.map((l) => ({
                stage: l.newStage,
                label: stageLabel(l.newStage),
                actorType: l.actorType,
                notes: l.notes,
                timestamp: l.timestamp,
            })),
            createdAt: req.createdAt,
            updatedAt: req.updatedAt,
        };
    }
    // =========================================================================
    // 8. SOS LOGGING
    // =========================================================================
    /**
     * Log an SOS event (call intent) for analytics and dispatch coordination.
     * Does not replace calling 112 — that must be done via phone.
     */
    async logSos(data) {
        const record = await prisma.sosRecord.create({
            data: {
                serviceType: data.serviceType,
                emergencyType: data.emergencyType,
                latitude: data.latitude,
                longitude: data.longitude,
                gpsAccuracy: data.gpsAccuracy,
                affectedPeople: data.affectedPeople || 1,
                description: data.description,
                contactInfo: data.contactInfo,
                status: 'LOGGED',
            },
        });
        // Notify authorized staff and responders
        notifyAuthorizedStaff({
            type: 'NEW_SOS',
            title: `EMERGENCY SOS: ${data.serviceType}`,
            message: `${data.affectedPeople || 1} people affected.${data.description ? ` Details: ${data.description}.` : ''} Location: ${data.latitude != null && data.longitude != null ? `(${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)})` : 'Not provided'}.`,
            entityId: record.id,
            metadata: { serviceType: data.serviceType, emergencyType: data.emergencyType, affectedPeople: data.affectedPeople || 1 },
        }).catch(() => { });
        return {
            sosId: record.id,
            serviceType: record.serviceType,
            emergencyType: record.emergencyType,
            affectedPeople: record.affectedPeople,
            status: record.status,
            message: 'SOS emergency record logged. Note: Submitting SOS to DisasterReady India does not automatically contact police, ambulance or government emergency services. Please immediately use the direct helpline call buttons.',
            directHelplines: [
                { service: 'National Emergency / Police / Fire', number: '112', telUri: 'tel:112' },
                { service: 'Disaster Helpline (NDMA / NDRF)', number: '1078', telUri: 'tel:1078' },
                { service: 'Ambulance & Medical Emergency', number: '108', telUri: 'tel:108' },
                { service: 'Fire Brigade', number: '101', telUri: 'tel:101' },
                { service: 'Women Safety Helpline', number: '1091', telUri: 'tel:1091' },
            ],
            emergency_numbers: {
                '112': '112',
                '1078': '1078',
                '108': '108',
                '101': '101',
                '1091': '1091',
                national: '112',
                ndrf: '1078',
                ambulance: '108',
                fire: '101',
                women_helpline: '1091',
            },
            loggedAt: record.triggeredAt,
        };
    }
}
// =========================================================================
// Pure utility helpers
// =========================================================================
function computeFreshness(date) {
    const diffMs = Date.now() - new Date(date).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 5)
        return 'JUST_NOW';
    if (diffMin < 60)
        return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24)
        return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
}
function classifyReport(reportedByCitizen, status) {
    if (!reportedByCitizen && status === 'VERIFIED_ACTIVE')
        return 'OFFICIAL_VERIFIED';
    if (reportedByCitizen && status === 'VERIFIED_ACTIVE')
        return 'COMMUNITY_VERIFIED';
    if (status === 'UNVERIFIED')
        return 'COMMUNITY_UNVERIFIED';
    return 'UNKNOWN';
}
function stageLabel(stage) {
    const labels = {
        STAGE_1_TRIAGED: 'Received — Under Triage',
        STAGE_2_VERIFIED: 'Verified by EOC — Preparing Dispatch',
        STAGE_3_ALLOCATED: 'Resources Allocated — Dispatching Soon',
        STAGE_4_IN_TRANSIT: 'Relief Team En Route',
        STAGE_5_DELIVERED: 'Delivered ✓',
        CANCELLED: 'Request Cancelled',
    };
    return labels[stage] || stage;
}
function estimateResponseTime(urgencyLevel) {
    const times = {
        CRITICAL_LIFE_SAFETY: 30,
        HIGH: 60,
        STANDARD: 120,
    };
    return times[urgencyLevel] ?? 90;
}
export const citizenService = new CitizenService();
//# sourceMappingURL=citizen.service.js.map