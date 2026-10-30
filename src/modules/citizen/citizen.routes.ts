import { Router } from 'express';
import { z } from 'zod';
import { citizenController } from './citizen.controller.js';
import { validateRequest } from '../../middleware/validate.js';

export const citizenRouter = Router();

const reportHazardSchema = z.object({
  districtId: z.string().uuid().optional(),
  hazardType: z.enum(['WATERLOGGING', 'FALLEN_TREE', 'LIVE_WIRE', 'BRIDGE_SUBMERGED', 'LANDSLIDE']),
  severity: z.enum(['LOW', 'MODERATE', 'SEVERE', 'CRITICAL']),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  addressLandmark: z.string().optional(),
  waterDepthCm: z.number().min(0).max(500).optional(),
  photoUrl: z.string().url().optional(),
});

// 1. Geocoding & Location
citizenRouter.get('/geo/reverse-geocode', (req, res, next) => citizenController.reverseGeocode(req, res, next));
citizenRouter.get('/geo/districts', (req, res, next) => citizenController.searchDistricts(req, res, next));

// 2. Active Alerts & Hazards
citizenRouter.get('/alerts/active', (req, res, next) => citizenController.getActiveAlerts(req, res, next));
citizenRouter.get('/hazards/spatial', (req, res, next) => citizenController.getSpatialHazards(req, res, next));
citizenRouter.post('/hazards/report', validateRequest({ body: reportHazardSchema }), (req, res, next) =>
  citizenController.reportHazard(req, res, next)
);

// 3. Safe Places Directory (Shelters & Hospitals)
citizenRouter.get('/facilities', (req, res, next) => citizenController.getFacilities(req, res, next));

// 4. Preparedness Guides
citizenRouter.get('/preparedness/guides', (req, res, next) => citizenController.getPreparednessGuides(req, res, next));

// 5. Anonymous Tracking by Token
citizenRouter.get('/relief-requests/track/:token', (req, res, next) => citizenController.trackRequest(req, res, next));
