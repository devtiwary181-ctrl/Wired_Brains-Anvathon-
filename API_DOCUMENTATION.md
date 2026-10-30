# DisasterReady India — Complete API Documentation

Base URL: `/api/v1`  
All JSON request bodies must include `Content-Type: application/json`.  
All authenticated endpoints require an `Authorization: Bearer <TOKEN>` header or signed session cookie.

---

## 🟢 1. Health & Discovery

### `GET /health`
Returns the status of the HTTP server, database connection, and Redis cache.
- **Access:** Public
- **Response `200 OK`:**
  ```json
  {
    "status": "ONLINE",
    "timestamp": "2026-10-31T04:26:00.000Z",
    "database": "CONNECTED",
    "redis": "CONNECTED"
  }
  ```

### `GET /dashboard`
Aggregated dashboard statistics for citizen homepage (active alerts, critical facilities count, open hazards).
- **Access:** Public
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "activeAlerts": 3,
      "unresolvedHazards": 12,
      "operationalShelters": 8,
      "recentAnnouncements": [...]
    }
  }
  ```

---

## 🚨 2. Hazards & Citizen Reporting

### `GET /hazards`
List verified hazard incidents with optional geospatial filtering.
- **Access:** Public
- **Query Params:** `lat`, `lng`, `radiusKm`, `category`, `status`
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "count": 5,
    "data": [
      {
        "id": "c1f77d54-8e3b-4819-bf9d-f2e145e523aa",
        "title": "Severe Waterlogging on S.V. Road",
        "category": "FLOOD",
        "severity": "HIGH",
        "status": "VERIFIED",
        "latitude": 19.076,
        "longitude": 72.877,
        "reportedAt": "2026-10-31T03:00:00.000Z"
      }
    ]
  }
  ```

### `POST /hazards/reports`
Submit an anonymous or citizen-verified hazard report. Supports multipart/form-data for image evidence.
- **Access:** Public
- **Request Body (JSON or FormData):**
  ```json
  {
    "title": "Tree Fallen Blocking Main Highway",
    "category": "LANDSLIDE",
    "severity": "MODERATE",
    "description": "Two lanes completely blocked near bridge",
    "latitude": 19.112,
    "longitude": 72.865,
    "reporterName": "Rohit Verma",
    "reporterPhone": "+919876543210"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "success": true,
    "data": {
      "reportId": "b83ef3c7-...",
      "status": "SUBMITTED",
      "message": "Hazard report submitted for verification."
    }
  }
  ```

---

## 📢 3. Disaster Alerts & CAP Feeds

### `GET /alerts`
Retrieve active multi-agency disaster warnings (aligned with CAP - Common Alerting Protocol).
- **Access:** Public
- **Query Params:** `severity` (`CRITICAL`, `HIGH`, `MODERATE`), `state`, `district`
- **Response `200 OK`:** Returns array of active alerts with affected polygon coordinates and safety instructions.

---

## 🗺️ 4. Evacuation Routes & Route Safety

### `POST /routes/compare`
Calculates and scores evacuation routes between origin and destination against active hazards and road closures.
- **Access:** Public
- **Request Body:**
  ```json
  {
    "origin": { "lat": 19.0760, "lng": 72.8777 },
    "destination": { "lat": 19.1200, "lng": 72.8900 },
    "travelMode": "DRIVING",
    "avoidHighRisk": true
  }
  ```
- **Response `200 OK`:** Returns evaluated routes with risk score (0-100), hazard intersections, distance, and ETA.

---

## 🏥 5. Critical Facilities Search

### `GET /facilities`
Find nearby relief centers, hospitals, fire stations, and supply depots.
- **Access:** Public
- **Query Params:** `lat`, `lng`, `radiusKm` (default: 10), `type` (`HOSPITAL`, `SHELTER`, `FOOD_DEPOT`)
- **Response `200 OK`:** Returns facility details, operational status, occupancy, and contact phone numbers.

---

## 📦 6. Public Relief Requests & Anonymous Tracking

### `POST /supplies/requests`
Submit a request for emergency food, water, medical supplies, or shelter kits.
- **Access:** Public (No login required)
- **Request Body:**
  ```json
  {
    "category": "RATIONS",
    "requiredQuantity": 50,
    "affectedPeople": 25,
    "urgency": "HIGH",
    "deliveryPreference": "DISPATCH",
    "deliveryAddress": "Sector 4 Community Hall, Relief Camp 2",
    "latitude": 19.080,
    "longitude": 72.880,
    "contactPhone": "+919123456789"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "success": true,
    "data": {
      "requestId": "uuid-...",
      "trackingToken": "DR-7A8B9C0D1E2F",
      "status": "SUBMITTED",
      "createdAt": "2026-10-31T04:00:00.000Z"
    }
  }
  ```

### `GET /supplies/track/:token`
Fetch real-time fulfillment status using the high-entropy tracking token.
- **Access:** Public (Token-gated)
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "token": "DR-7A8B9C0D1E2F",
      "status": "DISPATCHED",
      "category": "RATIONS",
      "timeline": [
        { "status": "SUBMITTED", "timestamp": "2026-10-31T04:00:00Z" },
        { "status": "APPROVED", "timestamp": "2026-10-31T04:05:00Z" },
        { "status": "DISPATCHED", "timestamp": "2026-10-31T04:15:00Z" }
      ]
    }
  }
  ```

---

## 🆘 7. Emergency SOS Dispatch

### `POST /sos`
Trigger instant high-priority distress signal with geolocation.
- **Access:** Public
- **Request Body:**
  ```json
  {
    "latitude": 19.0760,
    "longitude": 72.8777,
    "peopleCount": 4,
    "emergencyType": "TRAPPED_WATER",
    "medicalAttention": true,
    "notes": "Water rising above ground floor"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "success": true,
    "data": {
      "sosId": "sos-...",
      "status": "ESCALATED",
      "message": "Distress beacon broadcasted to nearest NDRF team."
    }
  }
  ```

---

## 🤖 8. DisasterReady AI Copilot

### `POST /copilot/query`
Conversational natural language crisis assistant.
- **Access:** Public
- **Request Body:**
  ```json
  {
    "query": "Where is the nearest open hospital with available ICU beds?",
    "userLocation": { "lat": 19.0760, "lng": 72.8777 },
    "language": "hi"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "response": "निकटतम अस्पताल 'लाइफलाइन मल्टीस्पेशलिटी' 1.8 किमी दूर है...",
      "groundedData": [
        { "name": "Lifeline Hospital", "distanceKm": 1.8, "status": "OPERATIONAL" }
      ]
    }
  }
  ```

---

## 🔒 9. Authority & Command Center APIs

### `POST /auth/login`
Step 1 of authority authentication (Argon2id password verification).
- **Request:** `{ "email": "commander@disasterready.in", "password": "..." }`
- **Response `200 OK`:** `{ "challengeId": "uuid-...", "message": "OTP sent to registered mobile" }`

### `POST /auth/verify-otp`
Step 2 of authority authentication (2FA SMS OTP).
- **Request:** `{ "challengeId": "uuid-...", "otp": "123456" }`
- **Response `200 OK`:** Returns signed JWT and sets HTTP-only session cookie.

### `GET /authority/hazards`
List citizen hazard reports awaiting NDMA/SDRF verification.
- **Permissions Required:** `hazards:verify`

### `PATCH /authority/hazards/:id/decision`
Verify, escalate, or reject citizen hazard report.
- **Permissions Required:** `hazards:verify`
- **Request:** `{ "decision": "VERIFIED", "severity": "CRITICAL" }`

### `POST /authority/inventory/allocate`
Allocate relief stock with atomic transactional locking.
- **Permissions Required:** `relief:manage`
- **Request Body:**
  ```json
  {
    "requestId": "uuid-...",
    "depotId": "uuid-...",
    "allocations": [
      { "item": "RATIONS_PACK", "quantity": 50 }
    ]
  }
  ```
- **Response `200 OK`** or **`409 Conflict`** if stock is insufficient.

### `POST /authority/simulations`
Run a sandboxed disaster scenario.
- **Permissions Required:** `simulations:run`
- **Request Body:**
  ```json
  {
    "disasterType": "FLOOD",
    "severity": "EXTREME",
    "epicenter": { "lat": 19.076, "lng": 72.877 },
    "radiusKm": 15
  }
  ```
- **Response `201 Created`:** Returns estimated casualties, shelter capacity demand, and simulated supply requirements.
