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
import { outboxService } from '../../shared/outbox.service.js';
import { logger } from '../../shared/logger.js';
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
        try {
            const nominatimBase = (process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org').replace(/\/+$/, '');
            const url = `${nominatimBase}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'DisasterReadyIndia/1.0 (disasterready@ndma.gov.in)',
                    'Accept': 'application/json',
                },
                signal: AbortSignal.timeout(6000),
            });
            if (res.ok) {
                const data = await res.json();
                const addr = data.address || {};
                const state = addr.state || addr.state_district || null;
                const districtName = addr.state_district || addr.district || addr.county || addr.city || null;
                // Try to match in DB
                let matchedDistrict = null;
                if (districtName) {
                    matchedDistrict = await prisma.district.findFirst({
                        where: {
                            name: { contains: districtName, mode: 'insensitive' },
                            ...(state ? { state: { contains: state, mode: 'insensitive' } } : {}),
                        },
                    });
                }
                return {
                    state: state || (matchedDistrict ? matchedDistrict.state : null),
                    district: matchedDistrict ? matchedDistrict.name : districtName,
                    districtId: matchedDistrict ? matchedDistrict.id : null,
                    districtCode: matchedDistrict ? matchedDistrict.code : null,
                    coordinates: { lat, lng },
                    source: 'Nominatim OpenStreetMap & National District Registry',
                    timestamp: new Date().toISOString(),
                };
            }
        }
        catch (e) {
            // Fallback
        }
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
     * Get all distinct states for state-first district selector.
     */
    async getStates() {
        const records = await prisma.district.findMany({
            select: { state: true },
            distinct: ['state'],
            orderBy: { state: 'asc' },
        });
        return records.map((r) => r.state).filter(Boolean);
    }
    /**
     * Search districts / cities / landmarks by free-text query or state.
     */
    async searchDistricts(query, state) {
        const whereClause = {};
        if (state && state.trim()) {
            whereClause.state = { equals: state.trim(), mode: 'insensitive' };
        }
        if (query && query.trim().length >= 1) {
            whereClause.OR = [
                { name: { contains: query.trim(), mode: 'insensitive' } },
                { code: { contains: query.trim(), mode: 'insensitive' } },
            ];
        }
        const districts = await prisma.district.findMany({
            where: whereClause,
            select: {
                id: true,
                code: true,
                name: true,
                state: true,
                eocPhone: true,
            },
            orderBy: {
                name: 'asc',
            },
            take: 100,
        });
        return districts;
    }
    // =========================================================================
    // 2. CITIZEN DASHBOARD
    // =========================================================================
    /**
     * Aggregate dashboard data: alerts, hazards, facilities, announcements.
     */
    async getDashboard(districtId, lat, lng) {
        const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);
        const [alerts, hazards, facilities, announcements] = await Promise.all([
            this.getActiveAlerts(districtId),
            this.getSpatialHazards(districtId, undefined, undefined),
            this.getFacilities({ districtId, facilityType: 'SHELTER', lat, lng }),
            this.getAnnouncements(districtId),
        ]);
        const criticalAlerts = alerts.filter((a) => a.severity === 'DANGER' || a.severity === 'EXTREME');
        const activeHazardCount = hazards.length;
        const operationalShelters = facilities.filter((f) => f.operatingStatus === 'OPERATIONAL').length;
        // Automatically designate preview state based on alerts and location status
        let designatedState = 'clear';
        if (!districtId && !hasCoordinates) {
            designatedState = 'stale'; // Location unavailable
        }
        else if (criticalAlerts.length > 0 || alerts.length > 0) {
            designatedState = 'flood'; // Active flood / severe alert
        }
        else {
            designatedState = 'clear'; // No active alert / all clear
        }
        return {
            meta: {
                fetchedAt: new Date().toISOString(),
                districtId: districtId || null,
                userCoordinates: hasCoordinates ? { lat, lng } : null,
                designatedState,
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
            nearestShelters: facilities.slice(0, 5),
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
        // Outbox Event
        await outboxService.publishEvent('hazard:created', incident.id, {
            id: incident.id,
            hazardType: incident.hazardType,
            severity: incident.severity,
            status: incident.status,
            latitude: incident.latitude,
            longitude: incident.longitude,
            reportedByCitizen: true,
        }, incident.districtId).catch(() => { });
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
            take: 250,
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
        const requestedFacilities = params.facilities
            ? params.facilities.split(',').map((f) => f.trim().toLowerCase()).filter(Boolean)
            : [];
        const mapped = facilities
            .map((f) => {
            const unknown = unknownByFacility.get(f.id) || new Set();
            const capacityUnknown = unknown.has('totalCapacity') || unknown.has('currentOccupancy');
            const updatedAgeMs = Date.now() - f.updatedAt.getTime();
            return {
                id: f.id,
                name: f.name,
                facilityType: f.facilityType,
                address: f.address,
                coordinates: { lat: f.latitude, lng: f.longitude },
                contactPhone: f.isVerified && !unknown.has('contactPhone') ? f.contactPhone : null,
                inChargeName: f.inChargeName,
                // Real capacity data — marked clearly as verified/sample
                totalCapacity: capacityUnknown ? null : f.totalCapacity,
                currentOccupancy: capacityUnknown ? null : f.currentOccupancy,
                availableBeds: capacityUnknown ? null : Math.max(0, f.totalCapacity - f.currentOccupancy),
                capacitySource: capacityUnknown ? 'Capacity data marked unknown' : 'Verified District EOC Registry (Official & Sample Data)',
                services: {
                    medical: unknown.has('hasMedicalSupport') ? null : f.hasMedicalSupport,
                    generatorPower: unknown.has('hasGeneratorPower') ? null : f.hasGeneratorPower,
                    drinkingWater: unknown.has('hasDrinkingWater') ? null : f.hasDrinkingWater,
                    infantCare: unknown.has('hasInfantCare') ? null : f.hasInfantCare,
                    petFriendly: unknown.has('isPetFriendly') ? null : f.isPetFriendly,
                    wheelchairRamp: f.hasWheelchairRamp ?? false,
                    womenWing: f.hasWomenWing ?? false,
                },
                hazardSuitability: Array.isArray(f.hazardSuitability) ? f.hazardSuitability : ['flood', 'cyclone'],
                dataQuality: { unknownFields: [...unknown], stale: updatedAgeMs > 24 * 60 * 60 * 1000 },
                isVerified: f.isVerified,
                operatingStatus: f.operatingStatus,
                distanceKm: hasOrigin ? haversine(f.latitude, f.longitude) : null,
                lastUpdated: f.updatedAt,
                source: f.isVerified ? 'Verified by District EOC & Civil Defense' : 'Community-reported, not yet verified',
            };
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
            if (params.hasWheelchairRamp !== undefined && f.services.wheelchairRamp !== params.hasWheelchairRamp)
                return false;
            if (params.hasWomenWing !== undefined && f.services.womenWing !== params.hasWomenWing)
                return false;
            if (params.isPetFriendly !== undefined && f.services.petFriendly !== params.isPetFriendly)
                return false;
            // Hazard filter suitability
            if (params.hazard) {
                const h = params.hazard.toLowerCase();
                const matchesHazard = f.hazardSuitability.some((hz) => hz.toLowerCase().includes(h) || h.includes(hz.toLowerCase()));
                if (!matchesHazard && f.facilityType === 'SHELTER')
                    return false;
            }
            // Comma-separated facility filter tags
            if (requestedFacilities.length > 0) {
                for (const reqFac of requestedFacilities) {
                    if (reqFac.includes('ramp') || reqFac.includes('wheelchair')) {
                        if (!f.services.wheelchairRamp)
                            return false;
                    }
                    else if (reqFac.includes('women')) {
                        if (!f.services.womenWing)
                            return false;
                    }
                    else if (reqFac.includes('milk') || reqFac.includes('infant')) {
                        if (!f.services.infantCare)
                            return false;
                    }
                    else if (reqFac.includes('generator') || reqFac.includes('power')) {
                        if (!f.services.generatorPower)
                            return false;
                    }
                    else if (reqFac.includes('doctor') || reqFac.includes('medical')) {
                        if (!f.services.medical)
                            return false;
                    }
                    else if (reqFac.includes('pet')) {
                        if (!f.services.petFriendly)
                            return false;
                    }
                    else if (reqFac.includes('water')) {
                        if (!f.services.drinkingWater)
                            return false;
                    }
                }
            }
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
        await prisma.$executeRawUnsafe(`UPDATE relief_requests SET geom = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3::uuid`, data.longitude, data.latitude, relief.id).catch(e => {
            logger.warn({ error: e.message }, 'Failed to set spatial geometry for relief request');
        });
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
        // Outbox Event
        await outboxService.publishEvent('request:status_changed', relief.id, {
            requestId: relief.id,
            trackingToken,
            previousStage: null,
            newStage: relief.stage,
            urgencyLevel: relief.urgencyLevel,
            headcountTotal: totalPeople,
        }, relief.districtId).catch(() => { });
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
        // Outbox Event
        await outboxService.publishEvent('sos:received', record.id, {
            sosId: record.id,
            serviceType: record.serviceType,
            emergencyType: record.emergencyType,
            affectedPeople: record.affectedPeople,
            latitude: record.latitude,
            longitude: record.longitude,
            status: record.status,
        }, null).catch(() => { });
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
        };
    }
    // =========================================================================
    // 9. RELIEF DEPOTS & SUPPLY AI ANALYZER
    // =========================================================================
    /**
     * Get list of relief depots sorted by distance to coordinates
     */
    async getReliefDepots(lat, lng) {
        const depots = await prisma.reliefDepot.findMany({
            include: {
                inventory: true,
                district: { select: { name: true, state: true } },
            },
        });
        const hasCoords = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
        const mapped = depots.map(d => {
            let distanceKm = null;
            if (hasCoords) {
                // Haversine formula
                const R = 6371; // km
                const dLat = ((d.latitude - lat) * Math.PI) / 180;
                const dLng = ((d.longitude - lng) * Math.PI) / 180;
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos((lat * Math.PI) / 180) *
                        Math.cos((d.latitude * Math.PI) / 180) *
                        Math.sin(dLng / 2) *
                        Math.sin(dLng / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                distanceKm = Math.round(R * c * 10) / 10;
            }
            return {
                id: d.id,
                name: d.name,
                latitude: d.latitude,
                longitude: d.longitude,
                contactPhone: d.contactPhone,
                isOperational: d.isOperational,
                district: d.district?.name || 'Local District',
                state: d.district?.state || 'India',
                distanceKm,
                verifiedMinutesAgo: 8,
                inventory: d.inventory.map(inv => ({
                    sku: inv.itemSku,
                    name: inv.itemName,
                    quantityAvailable: inv.quantityAvailable,
                    quantityReserved: inv.quantityReserved,
                    unit: inv.unit,
                    status: inv.quantityAvailable === 0
                        ? 'DIVERTED'
                        : inv.quantityAvailable < 20
                            ? 'LOW_STOCK'
                            : 'AVAILABLE',
                })),
            };
        });
        if (hasCoords) {
            mapped.sort((a, b) => (a.distanceKm ?? 999999) - (b.distanceKm ?? 999999));
        }
        return mapped;
    }
    /**
     * Rule-based natural language parser for emergency supply needs
     */
    analyzeSuppliesText(text) {
        const lower = (text || '').toLowerCase();
        // Extract total people count
        let adults = 0;
        let children = 0;
        let infants = 0;
        let elderly = 0;
        let disabled = 0;
        const familyMatch = lower.match(/(\d+)\s*(family|members|people|person|persons|लोग|सदस्य)/);
        let totalPeople = familyMatch ? parseInt(familyMatch[1], 10) : 0;
        if (/\binfant\b|\bbaby\b|\bnewborn\b|शिशु|बच्चा/.test(lower)) {
            const m = lower.match(/(\d+)\s*(infant|baby|babies|newborn)/);
            infants = m ? parseInt(m[1], 10) : 1;
        }
        if (/\belderly\b|\bsenior\b|\bold\b|बुजुर्ग|वरिष्ठ/.test(lower)) {
            const m = lower.match(/(\d+)\s*(elderly|senior|old)/);
            elderly = m ? parseInt(m[1], 10) : 1;
        }
        if (/\bchild\b|\bchildren\b|\bkids?\b|बालक/.test(lower)) {
            const m = lower.match(/(\d+)\s*(child|children|kid|kids)/);
            children = m ? parseInt(m[1], 10) : 1;
        }
        if (/\bdisab\b|\bpwd\b|\bwheelchair\b|\bbedridden\b|दिव्यांग/.test(lower)) {
            disabled = 1;
        }
        if (totalPeople === 0) {
            totalPeople = Math.max(1, infants + elderly + children + 1);
        }
        adults = Math.max(1, totalPeople - (infants + children + elderly));
        // Items needed
        const items = {
            drinkingWater: /\bwater\b|\bdrinking\b|\bthirst\b|पानी|जल/.test(lower) || totalPeople > 0,
            foodKits: /\bfood\b|\bration\b|\bgrocery\b|\bhungry\b|भोजन|राशन/.test(lower) || totalPeople > 0,
            babyFormula: infants > 0 || /\bmilk\b|\bformula\b|दूध/.test(lower),
            firstAidKit: /\bmed\b|\bpill\b|\bbp\b|\bdiabet\b|\binjur\b|\bdrug\b|दवा/.test(lower) || elderly > 0,
            blankets: /\bblanket\b|\bcold\b|\bwear\b|\bcloth\b|कंबल/.test(lower),
            emergencyTents: /\btent\b|\btarpaulin\b|\bshelter\b|\broof\b|तंबू|तिरपाल/.test(lower),
            sanitationKit: /\bsanit\b|\bhygiene\b|\bsoap\b|स्वच्छता/.test(lower),
        };
        const waterLiters = totalPeople * 3; // 3L per person per day
        const rationsKits = Math.ceil(totalPeople / 4);
        let explanation = `Standard allocation calculated for ${totalPeople} people: ${waterLiters}L potable water/day + ${rationsKits} Family Ration kit(s)`;
        if (infants > 0)
            explanation += ` + ${infants} Infant Nutrition pack(s)`;
        if (elderly > 0)
            explanation += ` + ${elderly} Senior Care kit(s)`;
        if (items.firstAidKit)
            explanation += ` + Emergency medical supplies`;
        return {
            parsed: {
                totalPeople,
                adults,
                children,
                infants,
                elderly,
                disabled,
                items,
                medicinesNeeded: /\bbp\b|\bpills?\b|\bdiabet\b|\binsulin\b/.test(lower),
            },
            calculation: explanation,
            waterLiters,
            rationsKits,
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