# DisasterReady India — Complete API Contract Specification

## 1. Global Conventions

- **Base URL:** `/api/v1`
- **Content-Type:** `application/json` (except multipart image uploads)
- **Standard Success Response Wrapper:**
  ```json
  {
    "success": true,
    "data": {},
    "message": "Operation completed successfully",
    "timestamp": "2026-10-31T00:30:00Z"
  }
  ```
- **Standard Error Response Wrapper:**
  ```json
  {
    "success": false,
    "error": {
      "code": "RESOURCE_NOT_FOUND",
      "message": "The requested relief tracking reference was not found.",
      "details": []
    },
    "timestamp": "2026-10-31T00:30:00Z"
  }
  ```

---

## 2. Public Citizen API Endpoints (No Authentication Required)

### A. Geospatial & Active Alerts
- `GET /geo/reverse-geocode?lat=28.6139&lng=77.2090`
  - Returns State, District, and administrative codes.
- `GET /alerts/active?districtId={uuid}`
  - Returns active high-priority disaster alerts (IMD / NDMA).
- `GET /hazards/spatial?districtId={uuid}&layers=floods,blocks`
  - Returns GeoJSON FeatureCollection of flood polygons and blocked points.

### B. Safe Routing & Evacuation
- `GET /maps/config`
  - Returns only the browser-restricted Maps JavaScript API key; never returns the private server key.
- `GET /geo/search?q={landmark}`
  - Geocodes a debounced place query through the private server-side Geocoding API credential. Short queries return an empty list without a provider request.
- `POST /routes/compare`
  - **Request:**
    ```json
    {
      "origin": { "lat": 12.9716, "lng": 77.5946 },
      "destination": { "lat": 12.9750, "lng": 77.6000 },
      "travelMode": "WALK"
    }
    ```
  - Calls the Google Routes API for alternatives, intersects returned geometry with active PostGIS hazard polygons and stored road closures, and returns distance, duration, geometry, intersections, risk factors, source, and timestamps.
  - Returns an explicit `ROUTES_NOT_CONFIGURED`, provider error, no-alternatives, or risk-data-unavailable response. It never substitutes an invented route.
- `POST /routes/check-risk`
  - **Request:** selected route coordinates, previously known feature IDs, previous risk score and freshness factor.
  - Checks the saved route geometry against current hazard and closure records. Material changes include a new recorded closure, new verified severe hazard, a score change of at least five points, or a worsening freshness bucket.
  - Monitoring is stateless and only runs while the citizen explicitly enables it on the comparison screen.
- See [ROUTING_DESIGN.md](ROUTING_DESIGN.md) for risk weights, assumptions, freshness thresholds, key restrictions, and known limitations.

### C. Safe Places Directory (Shelters & Hospitals)
- `GET /facilities?districtId={uuid}&type=SHELTER&hasMedical=true&page=1`
  - Returns paginated list of operational shelters, available bed counts, phone numbers, and coordinates.

### D. Citizen Hazard Reporting
- `POST /hazards/report` (Multipart form-data)
  - **Fields:**
    - `hazardType`: `WATERLOGGED_ROAD`
    - `severity`: `SEVERE`
    - `waterDepthCm`: 45
    - `latitude`: 28.6210, `longitude`: 77.2150
    - `addressLandmark`: "Under Railway Bridge, Ward 4"
    - `photo`: File attachment (optional)
  - **Response:**
    ```json
    {
      "reportId": "8f8303e9-a302-401d-937d-ec4831be329c",
      "status": "UNVERIFIED",
      "message": "Hazard report submitted for EOC verification. Thank you for protecting fellow citizens."
    }
    ```

### E. Emergency Supplies Requisition & Tracking
- `POST /relief-requests`
  - **Request:**
    ```json
    {
      "districtId": "c4d1b8e4-18f4-4e7a-9a99-b1d5bf8a4e10",
      "requesterPhone": "+919876543210",
      "headcount": { "adults": 4, "children": 2, "infants": 1, "seniors": 1 },
      "deliveryContext": "ROOFTOP_STRANDED",
      "urgencyLevel": "CRITICAL_LIFE_SAFETY",
      "latitude": 28.6255, "longitude": 77.2198,
      "landmarkNotes": "Yellow terrace house near water tank",
      "itemsRequested": {
        "drinkingWater": true,
        "foodKits": 6,
        "babyFormula": true,
        "firstAidKit": true
      }
    }
    ```
  - **Response:**
    ```json
    {
      "trackingToken": "DR-<43-character-random-base64url-token>",
      "initialStage": "STAGE_1_TRIAGED",
      "estimatedResponseTime": "Within 45-60 mins",
      "smsNotificationSent": true
    }
    ```
- `GET /relief-requests/track/{token}`
  - Returns complete public timeline, assigned depot, delivery ETA, and responder vehicle contact.
- `PATCH /relief-requests/track/{token}`
  - Allows citizen to update their current coordinates if moved to a different shelter or cancel request if already rescued.

### F. DisasterReady AI Copilot (Public Gateway)
- `POST /copilot/chat`
  - **Request:**
    ```json
    {
      "language": "hi",
      "districtId": "c4d1b8e4-18f4-4e7a-9a99-b1d5bf8a4e10",
      "query": "मेरे पास छोटे बच्चे हैं, क्या गांधी नगर का शेल्टर खुला है?",
      "coordinates": { "lat": 28.6139, "lng": 77.2090 }
    }
    ```
  - **Response:**
    ```json
    {
      "response": "हाँ, गांधी नगर कम्युनिटी सेंटर शेल्टर चालू है और वहाँ बच्चों के लिए दूध और प्राथमिक चिकित्सा उपलब्ध है। वहाँ अभी 120 बेड खाली हैं।",
      "actionCard": {
        "type": "FACILITY_CARD",
        "facilityId": "f-8392",
        "name": "Gandhi Nagar Relief Camp",
        "distanceKm": 1.4
      }
    }
    ```

---

## 3. Staff & Authority API Endpoints (Strict 2FA & Session Protected)

All operational endpoints below are mounted under `/api/v1/authority`, require an active staff session, enforce the listed permission, and apply assigned-district scoping when the user has a district. Mutations are audit-logged; inventory reservations and relief allocations execute in a database transaction.

### Authority Operations
- `GET /authority/dashboard` (`incidents:view`)
  - Returns live incident/hazard/alert/report metrics. SOS, facility, inventory, supply-request, and audit details are omitted or marked unavailable when the caller lacks their corresponding permissions.
- `GET /authority/hazards?status=UNVERIFIED` and `PATCH /authority/hazards/{id}/decision` (`hazards:verify`)
  - Queue returns report coordinates, submitted details, evidence, current status, and district. Decision body is `{ "decision": "VERIFY" | "REJECT", "reason": "..." }`; the reason is required and written to `AuditLog`. Verified reports become `VERIFIED_ACTIVE` and enter the shared citizen hazard feed. Rejected reports are excluded from that feed.
- `GET /authority/incidents`, `POST /authority/incidents`, `PATCH /authority/incidents/{id}`, `GET /authority/incidents/{id}/history` (`incidents:view`, `incidents:create`, `hazards:update`)
  - Incident operations use the existing hazard incident and polygon records. Assignment and operational notes are retained in audit metadata and returned in the incident record/history view.
- `GET /authority/alerts`, `POST /authority/alerts`, `PATCH /authority/alerts/{id}`, `GET /authority/alerts/{id}/history` (`incidents:view`, `alerts:publish`, `audit:view`)
  - Publication body must include `publish: true` and `confirmationText: "PUBLISH"`. Cancellation requires `cancel: true` and `confirmationText: "CANCEL"`. Updating a published alert requires `confirmationText: "UPDATE_AND_PUBLISH"`. Staff-supplied translations are stored in the audit history and returned to citizen alert clients.
- `GET /authority/facilities`, `POST /authority/facilities`, `PATCH /authority/facilities/{id}` (`facilities:view`, `facilities:manage`)
  - Staff can maintain capacity, services, status, and mark capacity/contact/service fields unknown. Unknown fields are masked from citizen facility responses; records older than 24 hours are labeled stale.
- `GET /authority/relief-requests`, `PATCH /authority/relief-requests/{id}/stage` (`relief:triage`)
  - Stage transitions are validated and recorded in request audit history.
- `POST /authority/relief-requests/{id}/allocate` (`inventory:allocate`)
  - Requires a verified request and requested line items. In one serializable transaction, verifies unreserved depot stock, reserves inventory, advances the request, and writes request and authority audit history.
- `GET /authority/inventory` (`inventory:allocate` or `inventory:restock`), `PATCH /authority/inventory/{id}` (`inventory:restock`)
  - Adjustments require a reason and cannot reduce total available stock below reserved stock.
- `GET /authority/sos` (`sos:view`)
  - Returns unresolved SOS records. District-scoped users are served only when usable district boundary geometry exists; otherwise the API returns `SOS_SCOPE_UNAVAILABLE` rather than exposing nationwide locations.
- `GET /authority/staff`, `POST /authority/staff`, `PATCH /authority/staff/{id}`, `GET /authority/staff/{id}/history` (`staff:manage`)
  - Staff creation hashes passwords, role changes use the configured role-permission policy, and disabling an account revokes its active sessions. Only a super administrator can grant the `SUPER_ADMIN` role.

### A. Two-Factor Authentication
- `POST /auth/staff/login-step1`
  - Validates username & password -> Generates 6-digit OTP -> Sends SMS -> Returns `challengeId`.
- `POST /auth/staff/verify-otp`
  - Validates `challengeId` & 6-digit OTP -> Sets HttpOnly secure JWT session cookie.
- `POST /auth/staff/logout`
  - Invalidates session in Redis -> Clears cookie.

### B. EOC Command Center Telemetry & Operations
- `GET /eoc/telemetry?districtId={uuid}`
  - Returns live totals: Affected citizens, active high-priority emergencies, available shelter beds, deployed rescue boats.
- `GET /eoc/requests?stage={stage}&urgency={level}&page=1`
  - Returns paginated list of citizen relief requests for operational triage.
- `POST /eoc/requests/{id}/transition`
  - Transitions request stage (`STAGE_1_TRIAGED` -> `STAGE_2_VERIFIED` -> `STAGE_3_ALLOCATED` -> `STAGE_4_IN_TRANSIT` -> `STAGE_5_DELIVERED`).
  - Automatically reserves stock from specified depot.
- `POST /eoc/bulletins`
  - Posts public alert broadcast to Citizen Portal and pushes WebSocket alert.

### C. Simulator & Inventory Controls
- `POST /simulation/run`
  - Runs scenario calculation (rainfall rate, dam release, wind vector) and returns flooded route segments.
- `PATCH /inventory/depots/{id}/items`
  - Increments or adjusts warehouse relief stock quantities with mandatory audit reason.
