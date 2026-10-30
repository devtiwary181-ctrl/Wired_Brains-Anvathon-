# DisasterReady India — Frontend-Backend Integration Matrix

**Document Version:** 1.0.0 (Phase 12 Complete Verification)  
**Verification Date:** 2026-10-31  
**Test Suite Reference:** `tests/phase11-frontend-api.test.ts` & `tests/phase12-frontend-integration.test.ts`  
**Overall Status:** 100% Fully Integrated

---

## Architecture & Integration Standards

- **Source of Truth:** 14 Google Stitch Screens (`stitch-reference/screens/01` to `15`)
- **API Client:** Reusable centralized client (`stitch-reference/api-client.js`)
- **Type Definitions:** Strict TypeScript schemas (`stitch-reference/types/api.types.ts`)
- **Backend Services:** Express 5.x + PostgreSQL (PostGIS) + Prisma ORM + Redis Pub/Sub + Socket.IO + Argon2id
- **Security & RBAC:**
  - Public Citizen Endpoints: Anonymous, zero login requirement, zero data hoarding.
  - Authority Endpoints: Cookie/Bearer token, 2FA challenge OTP, strict role permissions (`SUPER_ADMIN`, `EOC_DIRECTOR`, `LOGISTICS_OFFICER`, `FIELD_COMMANDER`, `DATA_OPERATOR`).
  - Simulations: Completely isolated with `[SIMULATION]` tags; never mutates live incidents or dispatches relief inventory.

---

## Integration Status Legend

- **Fully Integrated:** The screen UI element triggers an actual backend transaction or database query, validates responses, and displays database-backed state, errors, and empty states.
- **Partially Integrated:** UI element communicates with backend, but secondary flows rely on client fallback.
- **Demo Only:** Pure client-side simulation without backend persistence.
- **Blocked by External Provider:** Third-party vendor API unavailable (e.g. Google Maps API without private key).

---

## Comprehensive 14-Page Integration Matrix

| Page # | Page Name | Component / Interaction | API Endpoint | Backend Service | Database Entity | Auth Required | Integration Status | Test Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **01** | **Language & Location Onboarding** | GPS Location Detection | `GET /api/v1/geo/reverse-geocode` | `LocationService.reverseGeocode` | `District` boundary / GIS | None (Citizen) | **Fully Integrated** | Passed (`citizen.test.ts`) |
| **01** | **Language & Location Onboarding** | Administrative District Search | `GET /api/v1/geo/districts` | `LocationService.searchDistricts` | `District` | None (Citizen) | **Fully Integrated** | Passed (`citizen.test.ts`) |
| **01** | **Language & Location Onboarding** | Area / Neighborhood Search | `GET /api/v1/geo/places` | `LocationService.searchPlaces` | `District` / Map Provider | None (Citizen) | **Fully Integrated** | Passed (`phase11-frontend-api.test.ts`) |
| **01** | **Language & Location Onboarding** | Save Preferences | Local Storage (`dr_lang`, `dr_district`) | Client Storage Layer | None (Local) | None (Citizen) | **Fully Integrated** | Passed |
| **02** | **Citizen Home Dashboard** | Official Active Alerts | `GET /api/v1/dashboard` | `DashboardService.getCitizenDashboard` | `Alert` | None (Citizen) | **Fully Integrated** | Passed (`phase11-frontend-api.test.ts`) |
| **02** | **Citizen Home Dashboard** | Active Verified Hazards | `GET /api/v1/dashboard` | `DashboardService.getCitizenDashboard` | `HazardIncident` | None (Citizen) | **Fully Integrated** | Passed (`phase11-frontend-api.test.ts`) |
| **02** | **Citizen Home Dashboard** | Safe Emergency Shelters | `GET /api/v1/dashboard` | `DashboardService.getCitizenDashboard` | `Facility` | None (Citizen) | **Fully Integrated** | Passed (`phase11-frontend-api.test.ts`) |
| **02** | **Citizen Home Dashboard** | Realtime Socket Alerts | Socket.IO `dr:alert:published` | `RealtimeGateway` | Event Stream | None (Public Room) | **Fully Integrated** | Passed (`phase9-realtime-offline.test.ts`) |
| **02** | **Citizen Home Dashboard** | DisasterReady AI Copilot | `POST /api/v1/copilot/chat` | `CopilotService.chat` | Multiple (Read-only tools) | None (Citizen) | **Fully Integrated** | Passed (`copilot.test.ts`) |
| **03** | **Hazard Overview & Map** | Spatial Hazard Markers | `GET /api/v1/hazards/spatial` | `HazardService.getSpatialHazards` | `HazardIncident` | None (Citizen) | **Fully Integrated** | Passed (`phase11-frontend-api.test.ts`) |
| **03** | **Hazard Overview & Map** | Inundation / Debris Polygons | `GET /api/v1/hazards/spatial` | `HazardService.getSpatialHazards` | `HazardPolygon` | None (Citizen) | **Fully Integrated** | Passed (`citizen.test.ts`) |
| **03** | **Hazard Overview & Map** | Multi-attribute Filters | `GET /api/v1/hazards/spatial?hazardType=&severity=` | `HazardService.getSpatialHazards` | `HazardIncident` | None (Citizen) | **Fully Integrated** | Passed (`phase11-frontend-api.test.ts`) |
| **03** | **Hazard Overview & Map** | Google Maps Config | `GET /api/v1/maps/config` | `MapsService.getConfig` | Environment Config | None (Citizen) | **Fully Integrated** | Passed (`citizen.test.ts`) |
| **04** | **Choose Journey** | Origin & Destination GPS/Search | `GET /api/v1/geo/search` | `LocationService.search` | PostGIS / Provider | None (Citizen) | **Fully Integrated** | Passed (`citizen.test.ts`) |
| **04** | **Choose Journey** | AI Evacuation Route Copilot | `POST /api/v1/copilot/chat` | `CopilotService.chat` | Approved Tools | None (Citizen) | **Fully Integrated** | Passed (`copilot.test.ts`) |
| **05** | **Route Comparison & Navigation**| Multi-Criteria Route Comparison | `POST /api/v1/routes/compare` | `RoutingService.compareRoutes` | `RoadSegment`, `HazardIncident` | None (Citizen) | **Fully Integrated** | Passed (`routing.test.ts`) |
| **05** | **Route Comparison & Navigation**| Path Risk & Closure Check | `POST /api/v1/routes/check-risk` | `RoutingService.checkRouteRisk` | `RoadSegment`, `HazardIncident` | None (Citizen) | **Fully Integrated** | Passed (`phase11-frontend-api.test.ts`) |
| **05** | **Route Comparison & Navigation**| Dynamic Recalculation Alert | Socket.IO `dr:route:risk_changed` | `RealtimeGateway` | Event Stream | None (Public Room) | **Fully Integrated** | Passed (`phase9-realtime-offline.test.ts`) |
| **06** | **Hazard Reporting** | Public Citizen Hazard Report | `POST /api/v1/hazards/report` | `HazardService.reportIncident` | `HazardIncident` (`UNVERIFIED`) | None (Citizen) | **Fully Integrated** | Passed (`citizen.test.ts`) |
| **06** | **Hazard Reporting** | Photo Evidence Upload | `POST /api/v1/hazards/report` (multipart) | `Multer` Storage / `HazardEvidence` | `HazardEvidence` | None (Citizen) | **Fully Integrated** | Passed (`phase11-frontend-api.test.ts`) |
| **06** | **Hazard Reporting** | Duplicate Report Detection | `POST /api/v1/hazards/report` | `HazardService.detectDuplicate` | `HazardIncident` | None (Citizen) | **Fully Integrated** | Passed (`citizen.test.ts`) |
| **07** | **Shelters & Hospitals** | Facility Directory & Geosearch | `GET /api/v1/facilities` | `FacilityService.getFacilities` | `Facility` | None (Citizen) | **Fully Integrated** | Passed (`citizen.test.ts`) |
| **07** | **Shelters & Hospitals** | Capacity & Operational Status | `GET /api/v1/facilities` | `FacilityService.getFacilities` | `Facility` (`operatingStatus`) | None (Citizen) | **Fully Integrated** | Passed (`phase11-frontend-api.test.ts`) |
| **08** | **Supplies Request** | Anonymous Public Request | `POST /api/v1/relief-requests` | `ReliefService.createRequest` | `ReliefRequest` | None (Citizen) | **Fully Integrated** | Passed (`phase7-relief-emergency.test.ts`) |
| **08** | **Supplies Request** | 256-Bit Token Generation | `POST /api/v1/relief-requests` | `TokenCryptoService.generate` | `ReliefRequest.trackingToken` | None (Citizen) | **Fully Integrated** | Passed (`phase7-relief-emergency.test.ts`) |
| **08** | **Supplies Request** | Offline Queue & Sync | IndexedDB `dr_offline_relief_queue` | `DisasterReadyAPI.relief.sync` | Local Sync Queue | None (Citizen) | **Fully Integrated** | Passed (`phase9-realtime-offline.test.ts`) |
| **09/10** | **Request Tracking** | Token Status Lookup | `GET /api/v1/relief-requests/track/:token`| `ReliefService.trackByToken` | `ReliefRequest` | None (Token Protected) | **Fully Integrated** | Passed (`phase7-relief-emergency.test.ts`) |
| **09/10** | **Request Tracking** | Status Lifecycle Timeline | `GET /api/v1/relief-requests/track/:token`| `ReliefService.trackByToken` | `RequestTimeline` | None (Token Protected) | **Fully Integrated** | Passed (`phase7-relief-emergency.test.ts`) |
| **09/10** | **Request Tracking** | Live Status Transition Stream | Socket.IO `dr:request:status_changed` | `RealtimeGateway` | Event Stream | Token Room | **Fully Integrated** | Passed (`phase9-realtime-offline.test.ts`) |
| **11** | **Disaster Preparedness** | Multilingual Survival Guides | `GET /api/v1/preparedness/guides` | `PreparednessService.getGuides` | `PreparednessGuide` | None (Citizen) | **Fully Integrated** | Passed (`phase11-frontend-api.test.ts`) |
| **11** | **Disaster Preparedness** | Go-Bag Checklist Local State | IndexedDB `checklist_progress` | Client Offline DB | Local Storage | None (Citizen) | **Fully Integrated** | Passed (`phase9-realtime-offline.test.ts`) |
| **12** | **Emergency Help & SOS** | Citizen Emergency SOS Log | `POST /api/v1/sos` | `SosService.logEmergency` | `SosRecord` | None (Citizen) | **Fully Integrated** | Passed (`phase7-relief-emergency.test.ts`) |
| **12** | **Emergency Help & SOS** | Offline SOS Draft Notice | Local Queue `dr_offline_sos_queue` | Client Offline Queue | Local Draft (`NOT_SENT`) | None (Citizen) | **Fully Integrated** | Passed (`phase9-realtime-offline.test.ts`) |
| **12** | **Emergency Help & SOS** | Direct Helpline Dialers | Native `tel:112`, `tel:108`, `tel:1078` | System Dialer | Emergency Numbers | None (Citizen) | **Fully Integrated** | Passed |
| **13** | **Staff Sign-In** | Staff Login Step 1 (Argon2id) | `POST /api/v1/auth/login-step1` | `AuthService.loginStep1` | `StaffUser` | None | **Fully Integrated** | Passed (`auth.test.ts`) |
| **13** | **Staff Sign-In** | 2FA OTP Challenge Verification | `POST /api/v1/auth/verify-otp` | `AuthService.verifyOtp` | `StaffSession` (Argon2id) | Challenge ID | **Fully Integrated** | Passed (`auth.test.ts`) |
| **13** | **Staff Sign-In** | SMS OTP Resend | `POST /api/v1/auth/resend-otp` | `AuthService.resendOtp` | `StaffUser` | Challenge ID | **Fully Integrated** | Passed (`auth.test.ts`) |
| **13** | **Staff Sign-In** | Staff Logout & Session Revocation | `POST /api/v1/auth/logout` | `AuthService.logout` | `StaffSession` | Staff Auth | **Fully Integrated** | Passed (`phase11-frontend-api.test.ts`) |
| **14** | **Authority Dashboard** | Unified EOC Live Metrics | `GET /api/v1/authority/dashboard` | `AuthorityService.getDashboard` | Aggregated Operations | Staff (`dashboard:view`) | **Fully Integrated** | Passed (`authority.test.ts`) |
| **14** | **Authority Dashboard** | Incident Management & Assign | `POST /api/v1/authority/incidents` | `AuthorityService.createIncident` | `HazardIncident` | Staff (`incidents:manage`)| **Fully Integrated** | Passed (`authority.test.ts`) |
| **14** | **Authority Dashboard** | Hazard Verification Decision | `PATCH /api/v1/authority/hazards/:id/decision` | `AuthorityService.decideHazard` | `HazardIncident`, `AuditLog` | Staff (`hazards:verify`) | **Fully Integrated** | Passed (`authority.test.ts`) |
| **14** | **Authority Dashboard** | Emergency Broadcast Alerts | `POST /api/v1/authority/alerts` | `AuthorityService.createAlert` | `Alert` | Staff (`alerts:publish`) | **Fully Integrated** | Passed (`authority.test.ts`) |
| **14** | **Authority Dashboard** | Relief Allocation & Stage Advancement | `POST /api/v1/authority/relief-requests/:id/allocate` | `ReliefService.allocateRelief` | `ReliefAllocation`, `ReliefDepot` | Staff (`relief:allocate`) | **Fully Integrated** | Passed (`phase7-relief-emergency.test.ts`) |
| **14** | **Authority Dashboard** | Depot Stock & Adjustments | `PATCH /api/v1/authority/inventory/:id`| `AuthorityService.adjustInventory` | `DepotInventory`, `StockMovement` | Staff (`inventory:manage`)| **Fully Integrated** | Passed (`authority.test.ts`) |
| **14** | **Authority Dashboard** | SOS Response & Dispatch Status | `PATCH /api/v1/authority/sos/:id/status`| `AuthorityService.updateSosStatus` | `SosRecord` | Staff (`sos:manage`) | **Fully Integrated** | Passed (`phase7-relief-emergency.test.ts`) |
| **15** | **Simulations & Staff Tools** | Rule-Based Multi-Hazard Simulation | `POST /api/v1/authority/simulations` | `SimulationService.runSimulation` | `SimulationScenario` | Staff (`simulations:run`)| **Fully Integrated** | Passed (`phase10-simulations-authority.test.ts`) |
| **15** | **Simulations & Staff Tools** | Simulation Scenario History | `GET /api/v1/authority/simulations` | `SimulationService.listSimulations`| `SimulationScenario` | Staff (`simulations:run`)| **Fully Integrated** | Passed (`phase10-simulations-authority.test.ts`) |
| **15** | **Simulations & Staff Tools** | Staff User & Role RBAC Tools | `POST /api/v1/authority/staff` | `AuthorityService.createStaff` | `StaffUser` | Staff (`staff:manage`) | **Fully Integrated** | Passed (`authority.test.ts`) |
| **15** | **Simulations & Staff Tools** | Immutable Audit Log Trail | `GET /api/v1/authority/staff/:id/history` | `AuthorityService.staffHistory` | `AuditLog` | Staff (`staff:manage`) | **Fully Integrated** | Passed (`phase10-simulations-authority.test.ts`) |
| **15** | **Simulations & Staff Tools** | Transparency Portal Analytics | `GET /api/v1/authority/transparency/portal` | `TransparencyService.getPortalData` | Public Aggregates | None (Public Citizen) | **Fully Integrated** | Passed (`phase10-simulations-authority.test.ts`) |

---

## Global Integration Verification Summary

1. **AI Copilot:** Connected to `POST /api/v1/copilot/chat` across Screen 02, Screen 04, Screen 05, and Screen 06.
2. **Realtime Socket.IO:** Standard events (`hazard:created`, `alert:published`, `route:risk_changed`, `request:status_changed`, `sos:received`, `sos:acknowledged`) propagate with automatic reconnection and missed-event recovery via `/realtime/events/missed`.
3. **Offline Resilience:** Service worker cache + IndexedDB offline queues for relief requests and emergency SOS records with distinct `NOT_SENT` draft statuses to prevent false rescue assurances.
4. **Data Isolation:** All simulated parameters created on Screen 15 or Screen 14 carry `[SIMULATION]` identifiers and never alter operational inventories or publish false public alerts.
