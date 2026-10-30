import { Request, Response, NextFunction } from 'express';
import { citizenService } from './citizen.service.js';

export class CitizenController {
  async reverseGeocode(req: Request, res: Response, next: NextFunction) {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);

      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_COORDINATES', message: 'Valid lat and lng query parameters are required.' },
        });
      }

      const result = await citizenService.reverseGeocode(lat, lng);
      res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async searchDistricts(req: Request, res: Response, next: NextFunction) {
    try {
      const q = (req.query.q as string) || '';
      const result = await citizenService.searchDistricts(q);
      res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async getActiveAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const districtId = req.query.districtId as string | undefined;
      const result = await citizenService.getActiveAlerts(districtId);
      res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async getSpatialHazards(req: Request, res: Response, next: NextFunction) {
    try {
      const districtId = req.query.districtId as string | undefined;
      const hazardType = req.query.hazardType as string | undefined;
      const status = req.query.status as string | undefined;

      const result = await citizenService.getSpatialHazards(districtId, hazardType, status);
      res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async reportHazard(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await citizenService.reportHazard(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async getFacilities(req: Request, res: Response, next: NextFunction) {
    try {
      const { districtId, facilityType, lat, lng, radiusKm, hasMedical, hasInfantCare } = req.query;

      const result = await citizenService.getFacilities({
        districtId: districtId as string | undefined,
        facilityType: facilityType as string | undefined,
        lat: lat ? parseFloat(lat as string) : undefined,
        lng: lng ? parseFloat(lng as string) : undefined,
        radiusKm: radiusKm ? parseFloat(radiusKm as string) : undefined,
        hasMedical: hasMedical !== undefined ? hasMedical === 'true' : undefined,
        hasInfantCare: hasInfantCare !== undefined ? hasInfantCare === 'true' : undefined,
      });

      res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async getPreparednessGuides(req: Request, res: Response, next: NextFunction) {
    try {
      const disasterType = req.query.disasterType as string | undefined;
      const result = await citizenService.getPreparednessGuides(disasterType);
      res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async trackRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.params.token;
      const result = await citizenService.trackRequest(token);
      res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }
}

export const citizenController = new CitizenController();
