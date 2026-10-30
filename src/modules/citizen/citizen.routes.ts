/**
 * Citizen Routes — DisasterReady India
 * All public routes. Zero authentication required.
 * Organized by frontend screen mapping.
 */
import { Router } from 'express';
import { z } from 'zod';
import { citizenController } from './citizen.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import { evidenceUpload } from '../../middleware/upload.js';
import {
  publicRateLimiter,
  hazardReportRateLimiter,
  reliefRequestRateLimiter,
  sosRateLimiter,
  mapsQueryRateLimiter,
} from '../../middleware/rateLimiter.js';

export const citizenRouter = Router();

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const reportHazardSchema = z.object({
  districtId: z.string().uuid().optional(),
  hazardType: z.enum(['WATERLOGGING', 'FALLEN_TREE', 'LIVE_WIRE', 'BRIDGE_SUBMERGED', 'LANDSLIDE', 'FIRE', 'BUILDING_COLLAPSE']),
  severity: z.enum(['LOW', 'MODERATE', 'SEVERE', 'CRITICAL']),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  addressLandmark: z.string().max(500).optional(),
  waterDepthCm: z.coerce.number().min(0).max(1000).optional(),
  description: z.string().max(1000).optional(),
  observationTime: z.string().datetime().optional(),
  contactInfo: z.string().max(200).optional(),
  photoUrl: z.string().url().optional(),
});

const createReliefRequestSchema = z.object({
  districtId: z.string().uuid().optional(),
  requesterPhone: z.string().regex(/^\+?[0-9]{8,15}$/).optional(),
  headcountAdults: z.coerce.number().int().min(0).max(50).default(1),
  headcountChildren: z.coerce.number().int().min(0).max(50).default(0),
  headcountInfants: z.coerce.number().int().min(0).max(10).default(0),
  headcountSeniors: z.coerce.number().int().min(0).max(20).default(0),
  deliveryContext: z.enum(['ROOFTOP_STRANDED', 'GROUND_FLOOR', 'ISOLATED_ROAD', 'COMMUNITY_CENTER', 'OTHER']),
  urgencyLevel: z.enum(['STANDARD', 'HIGH', 'CRITICAL_LIFE_SAFETY']),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  landmarkNotes: z.string().max(500).optional(),
  itemsRequested: z.object({
    drinkingWater: z.boolean().optional(),
    foodKits: z.number().int().min(0).max(100).optional(),
    babyFormula: z.boolean().optional(),
    firstAidKit: z.boolean().optional(),
    tarpaulin: z.boolean().optional(),
    medications: z.string().optional(),
  }),
  specialMedicalNeeds: z.string().max(500).optional(),
});

const sosSchema = z.object({
  serviceType: z.enum(['112_NATIONAL', '1078_NDRF', '108_AMBULANCE', '101_FIRE', '1091_WOMEN', '1800_NDMA']),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

const facilitiesQuerySchema = z.object({
  districtId: z.string().uuid().optional(),
  facilityType: z.enum(['SHELTER', 'HOSPITAL', 'FOOD_WATER_POINT', 'COMMUNITY_KITCHEN']).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(500).optional(),
  hasMedical: z.enum(['true', 'false']).optional(),
  hasInfantCare: z.enum(['true', 'false']).optional(),
  hasPower: z.enum(['true', 'false']).optional(),
  hasDrinkingWater: z.enum(['true', 'false']).optional(),
}).refine((query) => (query.lat === undefined) === (query.lng === undefined), {
  message: 'Latitude and longitude must be provided together.',
});

const coordinateSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

const compareRoutesSchema = z.object({
  origin: coordinateSchema,
  destination: coordinateSchema,
  travelMode: z.enum(['WALK', 'BICYCLE', 'DRIVE', 'TWO_WHEELER']).default('WALK'),
}).refine(({ origin, destination }) => origin.lat !== destination.lat || origin.lng !== destination.lng, {
  message: 'Origin and destination must be different locations.',
});

const routeRiskCheckSchema = z.object({
  coordinates: z.array(coordinateSchema).min(2).max(1000),
  knownFeatureIds: z.array(z.string().max(100)).max(1000).optional(),
  previousRiskScore: z.coerce.number().min(0).max(100).optional(),
  previousFreshness: z.coerce.number().min(0).max(1).optional(),
});

// ---------------------------------------------------------------------------
// Screen 01 — Language & Location Onboarding
// ---------------------------------------------------------------------------
citizenRouter.get('/geo/reverse-geocode', publicRateLimiter, (req, res, next) =>
  citizenController.reverseGeocode(req, res, next),
);
citizenRouter.get('/geo/districts', publicRateLimiter, (req, res, next) =>
  citizenController.searchDistricts(req, res, next),
);
citizenRouter.get('/geo/search', mapsQueryRateLimiter, (req, res, next) =>
  citizenController.searchPlaces(req, res, next),
);
citizenRouter.get('/maps/config', mapsQueryRateLimiter, (req, res, next) =>
  citizenController.mapsConfig(req, res, next),
);

// ---------------------------------------------------------------------------
// Screen 02 — Citizen Dashboard (aggregated feed)
// ---------------------------------------------------------------------------
citizenRouter.get('/dashboard', publicRateLimiter, (req, res, next) =>
  citizenController.getDashboard(req, res, next),
);

// ---------------------------------------------------------------------------
// Alerts & Announcements (used across multiple screens)
// ---------------------------------------------------------------------------
citizenRouter.get('/alerts/active', publicRateLimiter, (req, res, next) =>
  citizenController.getActiveAlerts(req, res, next),
);
citizenRouter.get('/announcements', publicRateLimiter, (req, res, next) =>
  citizenController.getAnnouncements(req, res, next),
);

// ---------------------------------------------------------------------------
// Screens 03–05 — Hazard Overview Map
// ---------------------------------------------------------------------------
citizenRouter.get('/hazards/spatial', publicRateLimiter, (req, res, next) =>
  citizenController.getSpatialHazards(req, res, next),
);
citizenRouter.post('/routes/compare', mapsQueryRateLimiter, validateRequest({ body: compareRoutesSchema }), (req, res, next) =>
  citizenController.compareRoutes(req, res, next),
);
citizenRouter.post('/routes/check-risk', mapsQueryRateLimiter, validateRequest({ body: routeRiskCheckSchema }), (req, res, next) =>
  citizenController.checkRouteRisk(req, res, next),
);

// ---------------------------------------------------------------------------
// Screen 06 — Hazard Reporting (Step 5 in Get-to-Safety wizard)
// Rate-limited + optional multipart photo upload
// ---------------------------------------------------------------------------
citizenRouter.post(
  '/hazards/report',
  hazardReportRateLimiter,
  evidenceUpload.single('photo'),
  validateRequest({ body: reportHazardSchema }),
  (req, res, next) => citizenController.reportHazard(req, res, next),
);

// ---------------------------------------------------------------------------
// Screen 07 — Shelters & Hospitals (Safe Places Directory)
// ---------------------------------------------------------------------------
citizenRouter.get('/facilities', publicRateLimiter, validateRequest({ query: facilitiesQuerySchema }), (req, res, next) =>
  citizenController.getFacilities(req, res, next),
);

// ---------------------------------------------------------------------------
// Screens 08–10 — Emergency Relief Requests & Tracking
// ---------------------------------------------------------------------------
citizenRouter.post(
  '/relief-requests',
  reliefRequestRateLimiter,
  validateRequest({ body: createReliefRequestSchema }),
  (req, res, next) => citizenController.createReliefRequest(req, res, next),
);
citizenRouter.get('/relief-requests/track/:token', publicRateLimiter, (req, res, next) =>
  citizenController.trackRequest(req, res, next),
);

// ---------------------------------------------------------------------------
// Screen 11 — Disaster Preparedness Guides
// ---------------------------------------------------------------------------
citizenRouter.get('/preparedness/guides', publicRateLimiter, (req, res, next) =>
  citizenController.getPreparednessGuides(req, res, next),
);

// ---------------------------------------------------------------------------
// Screen 12 — SOS & Emergency Help (call intent logging only)
// ---------------------------------------------------------------------------
citizenRouter.post(
  '/sos',
  sosRateLimiter,
  validateRequest({ body: sosSchema }),
  (req, res, next) => citizenController.logSos(req, res, next),
);
