import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../../middleware/validate.js';
import { PERMISSIONS, ROLES } from '../auth/rbac.js';
import { requireAnyPermission, requireAuth, requirePermission } from '../auth/auth.middleware.js';
import { authorityController } from './authority.controller.js';

export const authorityRouter = Router();
const idParams = z.object({ id: z.string().uuid() });
const point = z.tuple([z.coerce.number().min(-90).max(90), z.coerce.number().min(-180).max(180)]);
const areaSchema = z.object({
  coordinates: z.array(point).min(3).max(200),
  zoneType: z.enum(['INUNDATION_ZONE', 'EVACUATION_CORRIDOR_CLOSED', 'DEBRIS_FIELD']),
  depthM: z.coerce.number().min(0).max(100).optional(),
});

const createIncidentSchema = z.object({
  districtId: z.string().uuid().optional(),
  hazardType: z.enum(['WATERLOGGING', 'FALLEN_TREE', 'LIVE_WIRE', 'BRIDGE_SUBMERGED', 'LANDSLIDE', 'FIRE', 'BUILDING_COLLAPSE']),
  severity: z.enum(['LOW', 'MODERATE', 'SEVERE', 'CRITICAL']),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  addressLandmark: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['UNVERIFIED', 'VERIFIED_ACTIVE']).default('UNVERIFIED'),
  assignedStaffId: z.string().uuid().optional(),
  notes: z.string().min(3).max(2000).optional(),
  affectedArea: areaSchema.optional(),
});
const updateIncidentSchema = z.object({
  severity: z.enum(['LOW', 'MODERATE', 'SEVERE', 'CRITICAL']).optional(),
  status: z.enum(['UNVERIFIED', 'VERIFIED_ACTIVE', 'RESOLVED', 'REJECTED']).optional(),
  assignedStaffId: z.string().uuid().nullable().optional(),
  notes: z.string().min(3).max(2000).optional(),
  affectedArea: areaSchema.optional(),
}).refine(value => Object.keys(value).length > 0, 'At least one incident field is required.');
const hazardQueueQuerySchema = z.object({ status: z.enum(['UNVERIFIED', 'VERIFIED_ACTIVE', 'RESOLVED', 'REJECTED']).optional() });
const hazardDecisionSchema = z.object({
  decision: z.enum(['VERIFY', 'REJECT']),
  reason: z.string().min(5).max(1000),
});
const createAlertSchema = z.object({
  districtId: z.string().uuid().optional(),
  title: z.string().min(4).max(200),
  severity: z.enum(['INFO', 'ADVISORY', 'WARNING', 'DANGER', 'EXTREME', 'CRITICAL']),
  disasterType: z.enum(['FLOOD', 'CYCLONE', 'EARTHQUAKE', 'LANDSLIDE', 'FIRE']),
  summary: z.string().min(5).max(2000),
  instructions: z.string().min(5).max(4000),
  sourceAgency: z.string().min(2).max(200),
  expiresAt: z.string().datetime().optional(),
  translations: z.record(z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/), z.object({ title: z.string().min(4).max(200), summary: z.string().min(5).max(2000), instructions: z.string().min(5).max(4000) })).optional(),
  publish: z.boolean().default(false),
  confirmationText: z.string().optional(),
});
const updateAlertSchema = z.object({
  title: z.string().min(4).max(200).optional(),
  severity: z.enum(['INFO', 'ADVISORY', 'WARNING', 'DANGER', 'EXTREME', 'CRITICAL']).optional(),
  disasterType: z.enum(['FLOOD', 'CYCLONE', 'EARTHQUAKE', 'LANDSLIDE', 'FIRE']).optional(),
  summary: z.string().min(5).max(2000).optional(),
  instructions: z.string().min(5).max(4000).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  translations: z.record(z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/), z.object({ title: z.string().min(4).max(200), summary: z.string().min(5).max(2000), instructions: z.string().min(5).max(4000) })).optional(),
  cancel: z.boolean().optional(),
  confirmationText: z.string().optional(),
}).refine(value => Object.keys(value).length > 0, 'At least one alert field is required.');
const updateFacilitySchema = z.object({
  name: z.string().min(2).max(200).optional(),
  address: z.string().min(2).max(500).optional(),
  contactPhone: z.string().max(30).optional(),
  totalCapacity: z.coerce.number().int().min(0).max(100000).optional(),
  currentOccupancy: z.coerce.number().int().min(0).max(100000).optional(),
  operatingStatus: z.enum(['OPERATIONAL', 'FILLING_UP', 'FULL', 'DAMAGED_CLOSED', 'UNKNOWN']).optional(),
  hasMedicalSupport: z.boolean().optional(),
  hasGeneratorPower: z.boolean().optional(),
  hasDrinkingWater: z.boolean().optional(),
  hasInfantCare: z.boolean().optional(),
  isPetFriendly: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  markUnknown: z.array(z.enum(['contactPhone', 'totalCapacity', 'currentOccupancy', 'hasMedicalSupport', 'hasGeneratorPower', 'hasDrinkingWater', 'hasInfantCare', 'isPetFriendly'])).max(8).optional(),
}).refine(value => Object.keys(value).length > 0, 'At least one facility field is required.');
const createFacilitySchema = z.object({
  districtId: z.string().uuid().optional(),
  facilityType: z.enum(['SHELTER', 'HOSPITAL', 'FOOD_WATER_POINT', 'COMMUNITY_KITCHEN']),
  name: z.string().min(2).max(200),
  address: z.string().min(2).max(500),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  contactPhone: z.string().min(8).max(30),
  totalCapacity: z.coerce.number().int().min(0).max(100000),
  currentOccupancy: z.coerce.number().int().min(0).max(100000),
  operatingStatus: z.enum(['OPERATIONAL', 'FILLING_UP', 'FULL', 'DAMAGED_CLOSED', 'UNKNOWN']),
  hasMedicalSupport: z.boolean(),
  hasGeneratorPower: z.boolean(),
  hasDrinkingWater: z.boolean(),
  hasInfantCare: z.boolean(),
  isPetFriendly: z.boolean(),
}).refine(value => value.currentOccupancy <= value.totalCapacity, 'Current occupancy cannot exceed total capacity.');
const reliefTransitionSchema = z.object({
  stage: z.enum(['STAGE_2_VERIFIED', 'STAGE_3_ALLOCATED', 'STAGE_4_IN_TRANSIT', 'STAGE_5_DELIVERED', 'CANCELLED']),
  notes: z.string().min(3).max(1000),
  etaMinutes: z.coerce.number().int().min(0).max(10080).optional(),
  assignedResponderId: z.string().max(100).optional(),
});
const reliefAllocationSchema = z.object({
  depotId: z.string().uuid(),
  allocations: z.array(z.object({ itemSku: z.string().min(1).max(80), quantity: z.coerce.number().int().positive().max(100000) })).min(1).max(30),
  etaMinutes: z.coerce.number().int().min(0).max(10080).optional(),
  assignedResponderId: z.string().max(100).optional(),
  notes: z.string().min(3).max(1000),
});
const inventoryAdjustmentSchema = z.object({
  quantityAvailable: z.coerce.number().int().min(0).max(10000000),
  reason: z.string().min(5).max(500),
});
const createStaffSchema = z.object({
  username: z.string().min(3).max(80).regex(/^[A-Za-z0-9._-]+$/),
  fullName: z.string().min(2).max(160),
  email: z.string().email().max(200),
  phoneNumber: z.string().regex(/^\+?[0-9]{8,15}$/),
  password: z.string().min(12).max(128),
  role: z.enum(Object.values(ROLES) as [string, ...string[]]),
  districtId: z.string().uuid().optional(),
});
const updateStaffSchema = z.object({
  role: z.enum(Object.values(ROLES) as [string, ...string[]]).optional(),
  isActive: z.boolean().optional(),
  districtId: z.string().uuid().optional(),
}).refine(value => Object.keys(value).length > 0, 'At least one staff field is required.');

// Every authority endpoint is authenticated and then checks its operation-specific permission.
authorityRouter.use(requireAuth);
authorityRouter.get('/dashboard', requirePermission(PERMISSIONS.INCIDENTS_VIEW), (req, res, next) => authorityController.dashboard(req, res, next));
authorityRouter.get('/sos', requirePermission(PERMISSIONS.SOS_VIEW), (req, res, next) => authorityController.listSos(req, res, next));
authorityRouter.get('/hazards', validateRequest({ query: hazardQueueQuerySchema }), requirePermission(PERMISSIONS.HAZARDS_VERIFY), (req, res, next) => authorityController.listHazards(req, res, next));
authorityRouter.patch('/hazards/:id/decision', validateRequest({ params: idParams, body: hazardDecisionSchema }), requirePermission(PERMISSIONS.HAZARDS_VERIFY), (req, res, next) => authorityController.decideHazard(req, res, next));
authorityRouter.get('/incidents', requirePermission(PERMISSIONS.INCIDENTS_VIEW), (req, res, next) => authorityController.listIncidents(req, res, next));
authorityRouter.post('/incidents', validateRequest({ body: createIncidentSchema }), requirePermission(PERMISSIONS.INCIDENTS_CREATE), (req, res, next) => authorityController.createIncident(req, res, next));
authorityRouter.patch('/incidents/:id', validateRequest({ params: idParams, body: updateIncidentSchema }), requirePermission(PERMISSIONS.HAZARDS_UPDATE), (req, res, next) => authorityController.updateIncident(req, res, next));
authorityRouter.get('/incidents/:id/history', validateRequest({ params: idParams }), requirePermission(PERMISSIONS.INCIDENTS_VIEW), (req, res, next) => authorityController.incidentHistory(req, res, next));
authorityRouter.get('/alerts', requirePermission(PERMISSIONS.INCIDENTS_VIEW), (req, res, next) => authorityController.listAlerts(req, res, next));
authorityRouter.get('/alerts/:id/history', validateRequest({ params: idParams }), requirePermission(PERMISSIONS.AUDIT_LOG_VIEW), (req, res, next) => authorityController.alertHistory(req, res, next));
authorityRouter.post('/alerts', validateRequest({ body: createAlertSchema }), requirePermission(PERMISSIONS.ALERTS_PUBLISH), (req, res, next) => authorityController.createAlert(req, res, next));
authorityRouter.patch('/alerts/:id', validateRequest({ params: idParams, body: updateAlertSchema }), requirePermission(PERMISSIONS.ALERTS_PUBLISH), (req, res, next) => authorityController.updateAlert(req, res, next));
authorityRouter.get('/facilities', requirePermission(PERMISSIONS.FACILITIES_VIEW), (req, res, next) => authorityController.listFacilities(req, res, next));
authorityRouter.post('/facilities', validateRequest({ body: createFacilitySchema }), requirePermission(PERMISSIONS.FACILITIES_MANAGE), (req, res, next) => authorityController.createFacility(req, res, next));
authorityRouter.patch('/facilities/:id', validateRequest({ params: idParams, body: updateFacilitySchema }), requirePermission(PERMISSIONS.FACILITIES_MANAGE), (req, res, next) => authorityController.updateFacility(req, res, next));
authorityRouter.get('/relief-requests', requirePermission(PERMISSIONS.RELIEF_TRIAGE), (req, res, next) => authorityController.listReliefRequests(req, res, next));
authorityRouter.patch('/relief-requests/:id/stage', validateRequest({ params: idParams, body: reliefTransitionSchema }), requirePermission(PERMISSIONS.RELIEF_TRIAGE), (req, res, next) => authorityController.transitionReliefRequest(req, res, next));
authorityRouter.post('/relief-requests/:id/allocate', validateRequest({ params: idParams, body: reliefAllocationSchema }), requirePermission(PERMISSIONS.INVENTORY_ALLOCATE), (req, res, next) => authorityController.allocateReliefRequest(req, res, next));
authorityRouter.get('/inventory', requireAnyPermission(PERMISSIONS.INVENTORY_ALLOCATE, PERMISSIONS.INVENTORY_RESTOCK), (req, res, next) => authorityController.listInventory(req, res, next));
authorityRouter.patch('/inventory/:id', validateRequest({ params: idParams, body: inventoryAdjustmentSchema }), requirePermission(PERMISSIONS.INVENTORY_RESTOCK), (req, res, next) => authorityController.adjustInventory(req, res, next));
authorityRouter.get('/staff', requirePermission(PERMISSIONS.STAFF_MANAGE), (req, res, next) => authorityController.listStaff(req, res, next));
authorityRouter.get('/staff/:id/history', validateRequest({ params: idParams }), requirePermission(PERMISSIONS.STAFF_MANAGE), (req, res, next) => authorityController.staffHistory(req, res, next));
authorityRouter.post('/staff', validateRequest({ body: createStaffSchema }), requirePermission(PERMISSIONS.STAFF_MANAGE), (req, res, next) => authorityController.createStaff(req, res, next));
authorityRouter.patch('/staff/:id', validateRequest({ params: idParams, body: updateStaffSchema }), requirePermission(PERMISSIONS.STAFF_MANAGE), (req, res, next) => authorityController.updateStaff(req, res, next));
