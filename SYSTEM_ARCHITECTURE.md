# DisasterReady India — System Architecture Document

## 1. Architectural Philosophy & Overview

**DisasterReady India** is designed as a **Modular Monolith** engineered for maximum operational reliability, low cognitive overhead, zero microservice network latency, and robust offline capability. 

The system operates as **one unified web application** serving two distinct user experiences:
1. **The Citizen Experience:** Publicly accessible, responsive, zero-login, battery-efficient, accessible in low-bandwidth disaster scenarios.
2. **The EOC Authority Experience:** Protected by strict 2FA (Username/Password + SMS OTP), dense operational telemetry, spatial triage command map, and multi-stage relief allocation.

Both areas share the exact same backend engine, database, PostGIS spatial services, WebSocket server, and AI Copilot gateway.

```
+----------------------------------------------------------------------------------------------------+
|                                    DISASTERREADY INDIA APPLICATION                                 |
+--------------------------------------------------+-------------------------------------------------+
|               CITIZEN PORTAL                     |            EOC AUTHORITY TERMINAL               |
|  - Zero-Login Public Access                      |  - Two-Step Auth (Password + SMS OTP)           |
|  - Safe Routes & Hazard Overview                 |  - District Telemetry & Triage (Stages 1-5)      |
|  - Shelter/Hospital Locator & SOS                |  - Stock Allocation & Responder Dispatch        |
|  - Supplies Request & Token Tracking             |  - Simulation Engine & Policy Controls          |
+--------------------------------------------------+-------------------------------------------------+
                                                   |
                                                   v
+----------------------------------------------------------------------------------------------------+
|                                      MODULAR MONOLITH BACKEND                                      |
|                               (Node.js + Express.js + TypeScript)                                  |
|                                                                                                    |
|  +--------------------+  +--------------------+  +--------------------+  +----------------------+  |
|  |    Geo & Routing   |  |   Relief & Triage  |  |   Hazards & Alerts |  |   Auth & RBAC (2FA)  |  |
|  |       Engine       |  |       Engine       |  |       Service      |  |        Service       |  |
|  +--------------------+  +--------------------+  +--------------------+  +----------------------+  |
|                                                                                                    |
|  +--------------------+  +--------------------+  +--------------------+  +----------------------+  |
|  | DisasterReady AI   |  |   Realtime Engine  |  | Background Worker  |  |  Audit & Transparency|  |
|  |  Copilot Gateway   |  |     (Socket.IO)    |  |  (BullMQ / Redis)  |  |        Ledger        |  |
|  +--------------------+  +--------------------+  +--------------------+  +----------------------+  |
+--------------------------------------------------+-------------------------------------------------+
                                                   |
                                                   v
+----------------------------------------------------------------------------------------------------+
|                                        DATA & STORAGE LAYER                                        |
|                                                                                                    |
|   +----------------------------------------------+   +-------------------------------------------+ |
|   |         PostgreSQL 16 + PostGIS 3.4          |   |                 Redis 7                   | |
|   |   - Spatial Polygons & Inundation Corridors  |   |   - Session & OTP Challenges (5m expiry)  | |
|   |   - Facilities, Relief Requests & Inventory  |   |   - Rate Limiting & Geo-fence Pub/Sub     | |
|   |   - Staff & Audit Logs (Prisma ORM)          |   |   - BullMQ Queue Broker                   | |
|   +----------------------------------------------+   +-------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Layered Component Architecture

### A. Frontend Architecture
- **Framework & View Engine:** Vanilla modern HTML5 + TypeScript / JavaScript with Tailwind CSS utilities mirroring the Stitch design tokens.
- **Client State Management:** Lightweight reactive store handling user language preference, active district, current GPS coordinates, and offline request cache in `localStorage` and `IndexedDB`.
- **Offline & Progressive Web App (PWA):**
  - ServiceWorker precaches core utility bundles, icon libraries, Noto Sans webfonts, and static shelter directories.
  - Background Sync API queues hazard reports and emergency relief requests submitted without an active cellular connection, dispatching them automatically upon signal reconnection.
  - Native Audio Synthesis / Web Audio API for screen-reader TTS and high-decibel audible emergency whistle sirens.

### B. Backend Architecture (Express.js + TypeScript)
- Organized into clean domain modules:
  ```
  src/
  ├── modules/
  │   ├── auth/           # Staff credentials, Argon2 hashing, OTP generation & verification
  │   ├── geo/            # Geocoding, spatial queries, PostGIS boundary intersections
  │   ├── hazards/        # Citizen hazard ingestion, verification workflows, alert broadcasts
  │   ├── routing/        # Hazard-aware multi-modal route evaluation & elevation check
  │   ├── facilities/     # Shelters, hospitals, live bed capacities, inventory lookup
  │   ├── relief/         # Supplies requisition, token generator, 5-stage triage workflow
  │   ├── copilot/        # AI orchestration gateway, tool schemas, safety filters
  │   ├── simulation/     # Disaster flood depth & rainfall impact simulator
  │   └── transparency/   # Immutable delivery audit ledger
  ├── middleware/         # Rate limiting, security headers, role guard, error handler
  └── shared/             # Prisma client, Redis client, Logger (Pino), Socket.IO manager
  ```

### C. Database & Spatial Architecture
- **PostgreSQL 16 with PostGIS Extension:**
  - Coordinates stored as `GEOMETRY(Point, 4326)` for facilities, incidents, and responder units.
  - Hazard zones stored as `GEOMETRY(Polygon, 4326)` or `GEOMETRY(MultiPolygon, 4326)` for flood inundation boundaries and road closures.
  - Spatial indexes (`GIST`) enable sub-millisecond proximity queries (`ST_DWithin`) and point-in-polygon queries (`ST_Contains`).

### D. DisasterReady AI Copilot Architecture
- **Controlled Orchestration Gateway:**
  - Citizen and authority queries pass through an abstraction layer (`CopilotService`).
  - Strict **Tool-Calling Architecture:** The AI cannot generate facts from memory or issue direct SQL queries. It has access to registered backend tools:
    - `get_active_alerts(districtId)`
    - `find_shelters(location, constraints)`
    - `get_route_hazard_status(origin, destination)`
    - `lookup_relief_status(token)`
    - `summarize_district_incidents(districtId)` *(Authority only)*
  - **Human-in-the-Loop Safeguard:** Sensitive authority operations (issuing official alerts, approving supply dispatches, modifying dam outflow simulation parameters) can only be drafted by the Copilot; final activation strictly requires authenticated staff confirmation.

### E. Real-Time & Notification Architecture
- **Socket.IO Real-time Channels:**
  - `public:alerts:{districtId}`: Pushes immediate severe weather and evacuation alerts to connected citizens.
  - `authority:eoc:{districtId}`: Streams incoming hazard reports, new relief requisitions, and responder GPS updates directly to the EOC command board.
- **SMS Gateway Integration:**
  - Pluggable SMS adapter (Twilio, Gupshup, or Indian DLT-compliant SMS gateway) for:
    - 2FA Staff Login OTPs (6-digit, 5-minute expiry).
    - Citizen request tracking reference dispatch (Free SMS).

### F. Offline-First Resilience Strategy
- **Degraded Network Handling:**
  - If network bandwidth drops below 2G speeds or disconnects completely, the frontend automatically displays the sticky banner: `[Working Offline: Cached data loaded at 14:32 IST]`.
  - Core directory pages (Shelters, Helpline Numbers, First Aid Protocols, Go-Bag Checklist) remain 100% interactive using client-side cache.
  - 1-Tap SOS numbers trigger native cellular `tel:` calls that operate over GSM voice circuits even without mobile packet data.
