/**
 * DisasterReady India — Frontend API Contract & Domain Type Definitions
 * Phase 11 Centralized Client Architecture
 */

// ---------------------------------------------------------------------------
// 1. Generic API Response & Error Types
// ---------------------------------------------------------------------------

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  timestamp?: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  status: number;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// 2. Authentication & Staff Session Types
// ---------------------------------------------------------------------------

export type StaffRole =
  | 'SUPER_ADMIN'
  | 'EOC_DIRECTOR'
  | 'LOGISTICS_OFFICER'
  | 'FIELD_COMMANDER'
  | 'DATA_OPERATOR';

export interface StaffUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: StaffRole;
  districtId?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  permissions?: string[];
}

export interface LoginChallengeResponse {
  challengeId: string;
  step: '2FA_REQUIRED';
  phoneMasked: string;
  expiresInSeconds: number;
  devOtp?: string;
}

export interface Verify2faResponse {
  user: StaffUser;
  permissions: string[];
  sessionExpiresAt: string;
}

// ---------------------------------------------------------------------------
// 3. Citizen Dashboard & Location Types
// ---------------------------------------------------------------------------

export interface DistrictInfo {
  id: string;
  code: string;
  name: string;
  state: string;
  eocPhone?: string | null;
  boundary?: unknown;
}

export interface CitizenDashboardData {
  meta?: {
    fetchedAt: string;
    districtId?: string;
    language?: string;
    disclaimer: string;
  };
  summary?: {
    operationalShelterCount: number;
    activeCriticalAlerts: number;
    unverifiedReportsCount?: number;
  };
  alerts: AlertRecord[];
  recentHazards: HazardRecord[];
  nearestShelters: FacilityRecord[];
  announcements: Array<{
    id: string;
    title: string;
    body: string;
    publishedAt: string;
  }>;
}

// ---------------------------------------------------------------------------
// 4. Hazards & Civilian Incident Reports
// ---------------------------------------------------------------------------

export type HazardType =
  | 'WATERLOGGING'
  | 'FALLEN_TREE'
  | 'LIVE_WIRE'
  | 'BRIDGE_SUBMERGED'
  | 'LANDSLIDE'
  | 'FIRE'
  | 'BUILDING_COLLAPSE';

export type HazardSeverity = 'LOW' | 'MODERATE' | 'SEVERE' | 'CRITICAL';
export type HazardStatus = 'UNVERIFIED' | 'VERIFIED_ACTIVE' | 'RESOLVED' | 'REJECTED';

export interface HazardRecord {
  id: string;
  districtId?: string | null;
  hazardType: HazardType;
  severity: HazardSeverity;
  latitude: number;
  longitude: number;
  addressLandmark?: string | null;
  description?: string | null;
  waterDepthCm: number;
  status: HazardStatus;
  reportedByCitizen: boolean;
  verifiedAt?: string | null;
  photoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHazardReportInput {
  hazardType: HazardType;
  severity: HazardSeverity;
  latitude: number;
  longitude: number;
  addressLandmark?: string;
  description?: string;
  waterDepthCm?: number;
  contactInfo?: string;
  photo?: File;
}

// ---------------------------------------------------------------------------
// 5. Official Disaster Alerts
// ---------------------------------------------------------------------------

export type AlertSeverity = 'INFO' | 'ADVISORY' | 'WARNING' | 'DANGER' | 'EXTREME' | 'CRITICAL';
export type DisasterType = 'FLOOD' | 'CYCLONE' | 'EARTHQUAKE' | 'LANDSLIDE' | 'FIRE';

export interface AlertRecord {
  id: string;
  districtId: string;
  title: string;
  severity: AlertSeverity;
  disasterType: DisasterType;
  summary: string;
  instructions: string;
  sourceAgency: string;
  isActive: boolean;
  issuedAt: string;
  expiresAt?: string | null;
  translations?: Record<string, { title: string; summary: string; instructions: string }>;
}

// ---------------------------------------------------------------------------
// 6. Safe Places & Facilities
// ---------------------------------------------------------------------------

export type FacilityType = 'SHELTER' | 'HOSPITAL' | 'FOOD_WATER_POINT' | 'COMMUNITY_KITCHEN';
export type OperatingStatus = 'OPERATIONAL' | 'FILLING_UP' | 'FULL' | 'DAMAGED_CLOSED';

export interface FacilityRecord {
  id: string;
  districtId: string;
  facilityType: FacilityType;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  contactPhone: string;
  inChargeName?: string | null;
  totalCapacity: number;
  currentOccupancy: number;
  operatingStatus: OperatingStatus;
  hasMedicalSupport: boolean;
  hasGeneratorPower: boolean;
  hasDrinkingWater: boolean;
  hasInfantCare: boolean;
  isPetFriendly: boolean;
  distanceKm?: number;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 7. Routing & Evacuation Life-lines
// ---------------------------------------------------------------------------

export interface RouteOption {
  id: string;
  name: string;
  travelMode: 'WALK' | 'CAR' | 'HEAVY';
  durationSeconds: number;
  distanceMeters: number;
  riskScore: number;
  hazardCount: number;
  recommended: boolean;
  riskReasons: string[];
  polylineCoordinates: Array<[number, number]>;
}

export interface RouteCompareResponse {
  routes: RouteOption[];
  safetyAdvisory: string;
  evaluatedHazardsCount: number;
}

// ---------------------------------------------------------------------------
// 8. Public Supplies Request & Anonymous Tracking
// ---------------------------------------------------------------------------

export type RequestStage =
  | 'STAGE_1_TRIAGED'
  | 'STAGE_2_VERIFIED'
  | 'STAGE_3_ALLOCATED'
  | 'STAGE_4_IN_TRANSIT'
  | 'STAGE_5_DELIVERED'
  | 'CANCELLED';

export interface ReliefRequestInput {
  headcountAdults: number;
  headcountChildren?: number;
  headcountInfants?: number;
  headcountSeniors?: number;
  deliveryContext: 'ROOFTOP_STRANDED' | 'GROUND_FLOOR' | 'ISOLATED_ROAD' | 'COMMUNITY_CENTER';
  urgencyLevel: 'STANDARD' | 'HIGH' | 'CRITICAL_LIFE_SAFETY';
  latitude: number;
  longitude: number;
  requesterPhone?: string;
  landmarkNotes?: string;
  itemsRequested: {
    drinkingWater?: boolean;
    foodKits?: number;
    babyFormula?: boolean;
    firstAidKit?: boolean;
    tarpaulin?: boolean;
    [sku: string]: unknown;
  };
  specialMedicalNeeds?: string;
}

export interface ReliefRequestCreatedResponse {
  requestId: string;
  trackingToken: string;
  stage: RequestStage;
  createdAt: string;
}

export interface RequestTimelineEvent {
  stage: RequestStage;
  timestamp: string;
  notes?: string;
  actorType: string;
}

export interface TrackReliefRequestResponse {
  requestId: string;
  trackingToken: string;
  stage: RequestStage;
  deliveryContext: string;
  urgencyLevel: string;
  headcount: {
    adults: number;
    children: number;
    infants: number;
    seniors: number;
    total: number;
  };
  itemsRequested: Record<string, unknown>;
  etaMinutes?: number | null;
  timeline: RequestTimelineEvent[];
}

// ---------------------------------------------------------------------------
// 9. Emergency SOS
// ---------------------------------------------------------------------------

export interface LogSosInput {
  serviceType: '112_NATIONAL' | '108_AMBULANCE' | '1078_DISASTER' | '1070_STATE';
  latitude?: number;
  longitude?: number;
  emergencyType?: string;
  gpsAccuracy?: number;
  affectedPeople?: number;
  description?: string;
  contactInfo?: string;
}

export interface LogSosResponse {
  sosId: string;
  status: 'LOGGED' | 'ACKNOWLEDGED' | 'RESPONDER_DISPATCHED' | 'RESOLVED';
  emergency_numbers: {
    '112': string;
    '108': string;
    '1078': string;
    '1070': string;
  };
  directActionNotice: string;
}

// ---------------------------------------------------------------------------
// 10. Preparedness Guides & Checklists
// ---------------------------------------------------------------------------

export interface PreparednessGuideRecord {
  id: string;
  disasterType: DisasterType;
  title: string;
  sections: {
    goBagChecklist: Array<{ item: string; priority: string; packed?: boolean }>;
    evacuationChecklist: Array<{ step: string; instruction: string }>;
    dosAndDonts: { dos: string[]; donts: string[] };
  };
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 11. Depots & Inventory Management
// ---------------------------------------------------------------------------

export interface DepotInventoryRecord {
  id: string;
  depotId: string;
  depotName: string;
  districtId: string;
  itemSku: string;
  itemName: string;
  quantityAvailable: number;
  quantityReserved: number;
  unit: string;
}

// ---------------------------------------------------------------------------
// 12. DisasterReady AI Copilot
// ---------------------------------------------------------------------------

export interface CopilotMessageRecord {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: unknown;
  actionCard?: {
    type: 'ALERT' | 'SHELTER' | 'HOSPITAL' | 'ROUTE' | 'PREPAREDNESS';
    title: string;
    data: unknown;
  };
  createdAt: string;
}

export interface CopilotAskResponse {
  message?: string;
  response: string;
  toolUsed?: string;
  actionCard?: CopilotMessageRecord['actionCard'];
  dataSources?: Array<{
    type: string;
    count: number;
    verified: boolean;
  }>;
  safetyDisclaimer: string;
}

// ---------------------------------------------------------------------------
// 13. Simulations & Analytics
// ---------------------------------------------------------------------------

export interface SimulationScenarioInput {
  name: string;
  disasterType: 'FLOOD' | 'EARTHQUAKE' | 'CYCLONE' | 'LANDSLIDE' | 'WILDFIRE';
  severity: 'MODERATE' | 'SEVERE' | 'CATASTROPHIC';
  affectedAreaNames: string[];
  districtId?: string;
  scenarioParameters?: Record<string, unknown>;
}

export interface SimulationResultRecord {
  simulationId: string;
  name: string;
  disasterType: string;
  severity: string;
  isSimulated: true;
  safetyNotice: string;
  estimatedImpact: {
    affectedPopulation: number;
    vulnerableIndividuals: { infants: number; elderly: number; bedridden: number };
    predictedInundatedKm2: number;
    blockedTransitCorridors: Array<{
      corridorName: string;
      alternateRoute: string;
      additionalTransitMinutes: number;
      status: 'BLOCKED_SIMULATED';
    }>;
  };
  resourceRequirements: {
    potableWaterLiters: number;
    readyMealsPacks: number;
    firstAidKits: number;
    emergencyShelterBedsNeeded: number;
    availableDepotBufferLiters: number;
    netWaterDeficitLiters: number;
    recommendedInterDepotTransfers: Array<{
      sourceDepot: string;
      destinationDepot: string;
      transferQuantityLiters: number;
    }>;
  };
  summaryNarrative: string;
  createdAt: string;
}
