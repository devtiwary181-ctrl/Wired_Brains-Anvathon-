/**
 * Citizen Controller — DisasterReady India
 * HTTP request handlers for all public citizen endpoints.
 * No authentication required for any route in this controller.
 */
import { Request, Response, NextFunction } from 'express';
import { citizenService } from './citizen.service.js';
import { checkRouteRisk, compareRoutes, geocodeSearch, getMapsBrowserConfig } from './routing.service.js';
import path from 'path';

export class CitizenController {
  async compareRoutes(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await compareRoutes(req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async checkRouteRisk(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await checkRouteRisk(req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async searchPlaces(req: Request, res: Response, next: NextFunction) {
    try {
      const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const result = await geocodeSearch(query);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async mapsConfig(_req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ success: true, data: getMapsBrowserConfig() });
    } catch (error) {
      next(error);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. GEO / LOCATION
  // ---------------------------------------------------------------------------

  async reverseGeocode(req: Request, res: Response, next: NextFunction) {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
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

  async getStates(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await citizenService.getStates();
      res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async searchDistricts(req: Request, res: Response, next: NextFunction) {
    try {
      const q = ((req.query.q as string) || '').trim();
      const state = ((req.query.state as string) || '').trim();
      if (!q && !state) {
        return res.status(200).json({ success: true, data: [] });
      }
      const result = await citizenService.searchDistricts(q, state);
      res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. DASHBOARD
  // ---------------------------------------------------------------------------

  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const districtId = req.query.districtId as string | undefined;
      const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
      const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
      const result = await citizenService.getDashboard(districtId, lat, lng);
      res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  // ---------------------------------------------------------------------------
  // 3. ALERTS
  // ---------------------------------------------------------------------------

  async getActiveAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const districtId = req.query.districtId as string | undefined;
      const result = await citizenService.getActiveAlerts(districtId);
      res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. ANNOUNCEMENTS
  // ---------------------------------------------------------------------------

  async getAnnouncements(req: Request, res: Response, next: NextFunction) {
    try {
      const districtId = req.query.districtId as string | undefined;
      const result = await citizenService.getAnnouncements(districtId);
      res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  // ---------------------------------------------------------------------------
  // 5. HAZARDS MAP
  // ---------------------------------------------------------------------------

  async getSpatialHazards(req: Request, res: Response, next: NextFunction) {
    try {
      const { districtId, hazardType, status, severity, since } = req.query;
      const result = await citizenService.getSpatialHazards(
        districtId as string | undefined,
        hazardType as string | undefined,
        status as string | undefined,
        severity as string | undefined,
        since as string | undefined,
      );
      res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  // ---------------------------------------------------------------------------
  // 6. HAZARD REPORTING
  // ---------------------------------------------------------------------------

  async reportHazard(req: Request, res: Response, next: NextFunction) {
    try {
      // If a file was uploaded via multipart, attach its path as photoUrl
      let photoUrl: string | undefined;
      if (req.file) {
        // Relative URL path served statically
        photoUrl = `/uploads/evidence/${req.file.filename}`;
      } else if (req.body.photoUrl) {
        photoUrl = req.body.photoUrl;
      }

      const result = await citizenService.reportHazard({ ...req.body, photoUrl });

      const statusCode = result.isDuplicate ? 200 : 201;
      res.status(statusCode).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  // ---------------------------------------------------------------------------
  // 7. FACILITIES
  // ---------------------------------------------------------------------------

  async getFacilities(req: Request, res: Response, next: NextFunction) {
    try {
      const query = res.locals.validatedQuery ?? req.query;
      const {
        districtId,
        facilityType,
        lat,
        lng,
        radiusKm,
        hazard,
        facilities,
        hasMedical,
        hasInfantCare,
        hasPower,
        hasDrinkingWater,
        hasWheelchairRamp,
        hasWomenWing,
        isPetFriendly,
      } = query;

      const result = await citizenService.getFacilities({
        districtId: districtId as string | undefined,
        facilityType: facilityType as string | undefined,
        lat: lat ? parseFloat(lat as string) : undefined,
        lng: lng ? parseFloat(lng as string) : undefined,
        radiusKm: radiusKm ? parseFloat(radiusKm as string) : undefined,
        hazard: hazard as string | undefined,
        facilities: facilities as string | undefined,
        hasMedical: hasMedical !== undefined ? hasMedical === 'true' : undefined,
        hasInfantCare: hasInfantCare !== undefined ? hasInfantCare === 'true' : undefined,
        hasPower: hasPower !== undefined ? hasPower === 'true' : undefined,
        hasDrinkingWater: hasDrinkingWater !== undefined ? hasDrinkingWater === 'true' : undefined,
        hasWheelchairRamp: hasWheelchairRamp !== undefined ? hasWheelchairRamp === 'true' : undefined,
        hasWomenWing: hasWomenWing !== undefined ? hasWomenWing === 'true' : undefined,
        isPetFriendly: isPetFriendly !== undefined ? isPetFriendly === 'true' : undefined,
      });

      res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  // ---------------------------------------------------------------------------
  // 8. PREPAREDNESS GUIDES
  // ---------------------------------------------------------------------------

  async getPreparednessGuides(req: Request, res: Response, next: NextFunction) {
    try {
      const disasterType = req.query.disasterType as string | undefined;
      const result = await citizenService.getPreparednessGuides(disasterType);
      res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  // ---------------------------------------------------------------------------
  // 9. RELIEF REQUESTS (anonymous create + track)
  // ---------------------------------------------------------------------------

  async createReliefRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await citizenService.createReliefRequest(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async trackRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const rawParam = req.params.token || req.params.id;
      const token = Array.isArray(rawParam) ? rawParam[0] : rawParam;
      if (!token) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TOKEN_FORMAT', message: 'A tracking token is required.' },
        });
      }
      const result = await citizenService.trackRequest(token);
      res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  // ---------------------------------------------------------------------------
  // 10. SOS LOGGING
  // ---------------------------------------------------------------------------

  async logSos(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await citizenService.logSos(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  // ---------------------------------------------------------------------------
  // 11. RELIEF DEPOTS & SUPPLY AI ANALYZER
  // ---------------------------------------------------------------------------

  async getDepots(req: Request, res: Response, next: NextFunction) {
    try {
      const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
      const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
      const result = await citizenService.getReliefDepots(lat, lng);
      res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async analyzeSupplies(req: Request, res: Response, next: NextFunction) {
    try {
      const text = (req.body.text || req.query.text || '').toString();
      const result = citizenService.analyzeSuppliesText(text);
      res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }
}

export const citizenController = new CitizenController();
