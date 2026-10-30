# DisasterReady India — Frontend to Backend Feature Mapping

## 1. Overview & Architecture Contract

Every single UI feature across the 14 frontend pages maps directly to an active backend service, API endpoint, database entity, and authorization model. 

- **Citizen Features:** 100% public access, zero authentication, rate-limited by IP / fingerprint, zero OTP barrier.
- **Admin / Staff Features:** Strictly protected via Two-Factor Authentication (Username + Password + SMS OTP), issued HttpOnly JWT session cookies, audited with role-based access controls.
- **AI Copilot Features:** Integrated via a controlled backend orchestration gateway that invokes registered tools, enforces domain guardrails, and prevents hallucinations.

---

## 2. Feature Mapping Matrix

| Page & UI Component | Frontend User Interaction | Backend Service / Logic | API Endpoint | DB Entities | Auth Level | Offline / Network Degraded Behavior |
|---|---|---|---|---|---|---|
| **P1: Language Selection** | User clicks language button | Loads localized i18n bundle from static cache or CDN | Client-side bundle (`/locales/{lang}.json`) | `SystemConfig` | Public | Stored in `localStorage`; works 100% offline |
| **P1: Auto-Detect Location** | User clicks GPS detect button | Browser Geolocation API -> Reverse Geocodes coordinate to State & District | `GET /api/v1/geo/reverse-geocode?lat=&lng=` | PostGIS spatial district boundaries | Public | Falls back to cached GPS or manual district picker |
| **P2: Disaster Alert Banner** | Page loads / updates in real-time | Retrieves active government disaster alerts for user's district | `GET /api/v1/alerts/active?districtId=` | `DisasterAlert`, `District` | Public | Caches latest alerts in `IndexedDB`/ServiceWorker with "Cached at HH:MM" banner |
| **P2: Disaster Type Filter** | User clicks Flood, Cyclone, etc. | Filters live hazard pins and shelter counts by disaster type | Client-side store filter / Query param | `HazardIncident`, `Shelter` | Public | Re-filters locally cached dataset |
| **P2: AI Copilot Assistant** | User asks disaster query via text/mic | Copilot gateway parses query, retrieves verified district alerts & guides | `POST /api/v1/copilot/chat` | `CopilotSession`, `DisasterAlert`, `Shelter` | Public (Rate-limited: 30 req/min) | Caches offline Emergency FAQ rules & guides |
| **P3: Active Hazard Map View** | Map loads with layer toggles | PostGIS spatial query returning GeoJSON polygons & points for active hazards | `GET /api/v1/hazards/spatial?districtId=&layers=flood,road_blocks` | `HazardIncident`, `HazardPolygon`, `RoadBlock` | Public | Serves vector tiles or GeoJSON from ServiceWorker cache |
| **P3: Severity Filter** | Toggles Severe, Moderate, Safe | Filters hazard markers and route boundaries | Client-side layer toggle | `HazardIncident` | Public | Operates on client-side map instance |
| **P4: Destination Selection** | User picks shelter or hospital destination | Queries verified open shelters with available beds near origin | `GET /api/v1/facilities/search?type=shelter&lat=&lng=&radiusKm=` | `Shelter`, `Hospital` | Public | Queries cached shelters list sorted by last known coordinates |
| **P4: Mobility Mode & Vulnerabilities** | Selects walking/bike/car & elderly/infants | Passes routing constraints to routing engine | State passed to Step 4 | N/A | Public | Kept in application state |
| **P5: Safe Route Comparison** | Compares Route A (High-ridge) vs Route B | Hazard-aware routing algorithm calculates routes avoiding flooded polygons | `POST /api/v1/routing/calculate-safe-routes` | `HazardPolygon`, `RoadSegment`, `ElevationProfile` | Public | Generates cached step-by-step waypoint instructions; PDF download |
| **P5: Why this Route?** | Expands safety factor accordion | Returns elevation delta, water depth along segment, and NDRF patrol status | `GET /api/v1/routing/segment-hazards?routeId=` | `HazardIncident`, `RoadSegment` | Public | Included in routing response payload |
| **P6: Citizen Hazard Reporting** | Submits waterlogged road / tree fall report | Validates report, processes photo upload (S3/local), inserts unverified report | `POST /api/v1/hazards/report` | `HazardReport`, `HazardMedia` | Public (Spam protected via honeypot + IP limit) | Queues report in `IndexedDB` and syncs via Background Sync API |
| **P7: Shelter Directory** | Searches and filters shelters & hospitals | Paginated query with distance calculation, capacity status, and medical flags | `GET /api/v1/facilities?type=&hasMedical=&hasPower=&page=` | `Shelter`, `Hospital`, `FacilityInventory` | Public | Full directory cached for offline browsing with direct telephone dialers |
| **P7: Smart Haven Finder (AI)** | User asks natural language shelter query | AI parses natural language needs and queries facility database with filters | `POST /api/v1/copilot/facility-finder` | `Shelter`, `Hospital` | Public | Falls back to keyword search over cached shelter list |
| **P8: Emergency Supplies Request** | Fills headcount, checks items, submits request | Validates items, generates secure high-entropy tracking token (e.g., `RELIEF-IN-8492-XQ7`), inserts request into triage queue | `POST /api/v1/relief-requests` | `ReliefRequest`, `ReliefItem`, `RequestTrackingToken` | Public | Saves request in local storage and provides emergency SMS broadcast template |
| **P8: Natural Language Requisition (AI)** | Speaks or pastes needs in plain language | Copilot parses text into structured JSON payload (headcount, dietary, medical) | `POST /api/v1/copilot/parse-request` | N/A (Stateless parser) | Public | Manual form entry always available as fallback |
| **P9/P10: Request Tracking** | Enters tracking token `RELIEF-IN-8492-XQ7` | Verifies token hash, returns current delivery stage, dispatch ETA, assigned team | `GET /api/v1/relief-requests/track/:token` | `ReliefRequest`, `ReliefDispatch`, `ResponderUnit` | Public with Token | Caches last fetched status and timestamp in `localStorage` |
| **P9/P10: Update Location / Cancel** | Updates stranded pin or marks safe | Updates request status or coordinates with audit note | `PATCH /api/v1/relief-requests/track/:token` | `ReliefRequest`, `RequestAuditLog` | Public with Token | Prompts to send cancellation SMS if network offline |
| **P11: 72-Hour Go-Bag Checklist** | Checks items in emergency pack | Persists user checklist state | Local Browser Storage | N/A | Public | 100% offline client-side functionality |
| **P11: Family Emergency Plan Generator** | Fills meeting points & downloads card | Client-side generator produces printable PDF / printable HTML | Client-side jsPDF / Print stylesheet | N/A | Public | 100% offline |
| **P12: 1-Tap SOS Helpline Calls** | Taps 112, 1078, 108, 101 | Standard `tel:` URI opens device native dialer | Native protocol (`tel:112`) | N/A | Public | Functions natively without internet |
| **P12: High-Decibel Siren / Whistle** | Taps siren button | Web Audio API generates oscillating square/sine wave alarm sound | Client-side Web Audio API | N/A | Public | 100% offline; runs via browser audio oscillator |
| **P13: Staff Login - Step 1** | Submits Username & Password | Validates credentials against argon2/bcrypt hash; generates 6-digit OTP; dispatches via SMS | `POST /api/v1/auth/staff/login-step1` | `StaffUser`, `StaffOtpChallenge` | Public endpoint (Rate limited: 5 attempts/15 min) | Requires active network |
| **P13: Staff Login - Step 2** | Submits 6-digit OTP | Verifies OTP and challenge ID within 5-min expiry; issues signed JWT HttpOnly cookie | `POST /api/v1/auth/staff/verify-otp` | `StaffUser`, `StaffSession`, `AuditLog` | Public endpoint (3 OTP attempts allowed) | Requires active network |
| **P14: EOC Telemetry Stats** | Dashboard loads | Aggregates affected counts, open requests, bed occupancy, deployed assets | `GET /api/v1/eoc/telemetry?districtId=` | `ReliefRequest`, `Shelter`, `ResponderUnit` | Staff / Admin | Displays last polled state; reconnects via WebSocket |
| **P14: Stages 1-5 Request Triage** | Staff triages, approves, allocates stock, assigns vehicle | State-machine transitions request status with transactional inventory deduction | `POST /api/v1/eoc/requests/:id/transition` | `ReliefRequest`, `ReliefDispatch`, `DepotInventory`, `AuditLog` | Staff / Admin (Role: Logistics / Officer) | Real-time broadcast to connected staff via Socket.IO |
| **P14: Broadcast Emergency Bulletin** | EOC officer issues public emergency alert | Inserts alert into DB and broadcasts via WebSocket & Firebase Cloud Messaging | `POST /api/v1/eoc/bulletins` | `DisasterAlert`, `BroadcastLog` | Staff / Admin (Role: Director / EOC Lead) | Queues broadcast in database |
| **P15: Scenario Simulator** | Adjusts rainfall, dam release, wind speed sliders | Spatial simulation service models water level rise and marks vulnerable road segments | `POST /api/v1/simulation/run` | `SimulationRun`, `RoadSegment`, `WaterLevelSensor` | Staff / Admin | Runs mathematical run-off model in backend worker |
| **P15: Central Depot Inventory** | Staff updates supply quantities or re-stocks | Updates warehouse SKU stock levels with audit trail | `PATCH /api/v1/inventory/depots/:id/items` | `DepotInventory`, `InventoryAuditLog` | Staff / Admin | Real-time stock recalculation |
| **P15: Public Transparency Audit Log** | View public relief disbursement ledger | Returns cryptographically hashed immutable log of verified deliveries | `GET /api/v1/transparency/ledger?districtId=` | `TransparencyLedger`, `ReliefDispatch` | Public / Staff | Publicly readable ledger of relief deliveries |

---

## 3. UI State Lifecycle Standards

For every single integrated endpoint, the frontend handles five standard states:

1. **Initial / Idle State:** Clean default view showing placeholder instructions, standard filter values, and neutral styling.
2. **Loading State:** Dedicated skeleton loaders, accessible `aria-busy="true"`, disabled interactive buttons with spinner indicators matching `#0B5FA5`.
3. **Success State:** Instant DOM update, verified status chips (`#1B7F4B`), clear notification toasts with dismiss controls, auto-refresh triggers.
4. **Error State:** Accessible error banner (`#B3261E` on `#FCE8E6`), clear non-technical guidance in selected Indian language, retry action button.
5. **Empty State:** Helpful empty state illustration and text (e.g., *"No blocked roads reported in this sector. All corridors clear."*) with quick links to reset filters or report an incident.
