import { citizenService } from './citizen.service.js';
export class CitizenController {
    // ---------------------------------------------------------------------------
    // 1. GEO / LOCATION
    // ---------------------------------------------------------------------------
    async reverseGeocode(req, res, next) {
        try {
            const lat = parseFloat(req.query.lat);
            const lng = parseFloat(req.query.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_COORDINATES', message: 'Valid lat and lng query parameters are required.' },
                });
            }
            const result = await citizenService.reverseGeocode(lat, lng);
            res.status(200).json({ success: true, data: result });
        }
        catch (e) {
            next(e);
        }
    }
    async searchDistricts(req, res, next) {
        try {
            const q = (req.query.q || '').trim();
            if (q.length < 2) {
                return res.status(200).json({ success: true, data: [] });
            }
            const result = await citizenService.searchDistricts(q);
            res.status(200).json({ success: true, data: result });
        }
        catch (e) {
            next(e);
        }
    }
    // ---------------------------------------------------------------------------
    // 2. DASHBOARD
    // ---------------------------------------------------------------------------
    async getDashboard(req, res, next) {
        try {
            const districtId = req.query.districtId;
            const result = await citizenService.getDashboard(districtId);
            res.status(200).json({ success: true, data: result });
        }
        catch (e) {
            next(e);
        }
    }
    // ---------------------------------------------------------------------------
    // 3. ALERTS
    // ---------------------------------------------------------------------------
    async getActiveAlerts(req, res, next) {
        try {
            const districtId = req.query.districtId;
            const result = await citizenService.getActiveAlerts(districtId);
            res.status(200).json({ success: true, data: result });
        }
        catch (e) {
            next(e);
        }
    }
    // ---------------------------------------------------------------------------
    // 4. ANNOUNCEMENTS
    // ---------------------------------------------------------------------------
    async getAnnouncements(req, res, next) {
        try {
            const districtId = req.query.districtId;
            const result = await citizenService.getAnnouncements(districtId);
            res.status(200).json({ success: true, data: result });
        }
        catch (e) {
            next(e);
        }
    }
    // ---------------------------------------------------------------------------
    // 5. HAZARDS MAP
    // ---------------------------------------------------------------------------
    async getSpatialHazards(req, res, next) {
        try {
            const { districtId, hazardType, status, severity, since } = req.query;
            const result = await citizenService.getSpatialHazards(districtId, hazardType, status, severity, since);
            res.status(200).json({ success: true, data: result });
        }
        catch (e) {
            next(e);
        }
    }
    // ---------------------------------------------------------------------------
    // 6. HAZARD REPORTING
    // ---------------------------------------------------------------------------
    async reportHazard(req, res, next) {
        try {
            // If a file was uploaded via multipart, attach its path as photoUrl
            let photoUrl;
            if (req.file) {
                // Relative URL path served statically
                photoUrl = `/uploads/evidence/${req.file.filename}`;
            }
            else if (req.body.photoUrl) {
                photoUrl = req.body.photoUrl;
            }
            const result = await citizenService.reportHazard({ ...req.body, photoUrl });
            const statusCode = result.isDuplicate ? 200 : 201;
            res.status(statusCode).json({ success: true, data: result });
        }
        catch (e) {
            next(e);
        }
    }
    // ---------------------------------------------------------------------------
    // 7. FACILITIES
    // ---------------------------------------------------------------------------
    async getFacilities(req, res, next) {
        try {
            const query = res.locals.validatedQuery ?? req.query;
            const { districtId, facilityType, lat, lng, radiusKm, hasMedical, hasInfantCare, hasPower, hasDrinkingWater } = query;
            const result = await citizenService.getFacilities({
                districtId: districtId,
                facilityType: facilityType,
                lat: lat ? parseFloat(lat) : undefined,
                lng: lng ? parseFloat(lng) : undefined,
                radiusKm: radiusKm ? parseFloat(radiusKm) : undefined,
                hasMedical: hasMedical !== undefined ? hasMedical === 'true' : undefined,
                hasInfantCare: hasInfantCare !== undefined ? hasInfantCare === 'true' : undefined,
                hasPower: hasPower !== undefined ? hasPower === 'true' : undefined,
                hasDrinkingWater: hasDrinkingWater !== undefined ? hasDrinkingWater === 'true' : undefined,
            });
            res.status(200).json({ success: true, data: result });
        }
        catch (e) {
            next(e);
        }
    }
    // ---------------------------------------------------------------------------
    // 8. PREPAREDNESS GUIDES
    // ---------------------------------------------------------------------------
    async getPreparednessGuides(req, res, next) {
        try {
            const disasterType = req.query.disasterType;
            const result = await citizenService.getPreparednessGuides(disasterType);
            res.status(200).json({ success: true, data: result });
        }
        catch (e) {
            next(e);
        }
    }
    // ---------------------------------------------------------------------------
    // 9. RELIEF REQUESTS (anonymous create + track)
    // ---------------------------------------------------------------------------
    async createReliefRequest(req, res, next) {
        try {
            const result = await citizenService.createReliefRequest(req.body);
            res.status(201).json({ success: true, data: result });
        }
        catch (e) {
            next(e);
        }
    }
    async trackRequest(req, res, next) {
        try {
            const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
            if (!token) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_TOKEN_FORMAT', message: 'A tracking token is required.' },
                });
            }
            const result = await citizenService.trackRequest(token);
            res.status(200).json({ success: true, data: result });
        }
        catch (e) {
            next(e);
        }
    }
    // ---------------------------------------------------------------------------
    // 10. SOS LOGGING
    // ---------------------------------------------------------------------------
    async logSos(req, res, next) {
        try {
            const result = await citizenService.logSos(req.body);
            res.status(201).json({ success: true, data: result });
        }
        catch (e) {
            next(e);
        }
    }
}
export const citizenController = new CitizenController();
//# sourceMappingURL=citizen.controller.js.map