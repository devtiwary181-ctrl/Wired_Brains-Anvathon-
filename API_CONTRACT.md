  "trackingToken": "DR-<43-character-random-base64url-token>",
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
- `POST /routing/calculate-safe-routes`
  - **Request:**
    ```json
    {
      "origin": { "lat": 28.6139, "lng": 77.2090 },
      "destination": { "lat": 28.6500, "lng": 77.2300 },
      "transitMode": "WALKING",
      "vulnerabilities": { "elderly": true, "infants": false, "wheelchair": true }
    }
    ```
  - **Response:** Array of evaluated routes:
    - Route A: `isSafest: true`, Elevation profile, segment depth risk: `0cm`, ETA: `24 mins`.
    - Route B: `isSafest: false`, Caution: `15cm waterlogged culvert`, ETA: `16 mins`.

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
      "trackingToken": "RELIEF-IN-8492-XQ7",
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
