- **Backend:** Implement `/api/v1/relief-requests` with opaque 256-bit tracking tokens, multi-stage triage workflow, and `/relief-requests/track/:token`.
# DisasterReady India — Full-Stack Implementation Plan

## 1. Phased Roadmap Overview

This implementation plan bridges the raw Stitch reference designs into a fully integrated, responsive full-stack platform.

In accordance with the **Mandatory Integration Rule**, every feature phase follows the exact sequence:
1. Inspect frontend component -> 2. Implement backend endpoint & logic -> 3. Execute DB operations -> 4. Wire frontend component with loading, error, empty, and success states -> 5. End-to-end integration test.

---

## 2. Phase-by-Phase Execution Breakdown

### Phase 1: Full-Stack Project Scaffolding & Core Foundation [COMPLETED & VERIFIED]
- [x] Initialized Node.js + Express.js + TypeScript modular monolithic architecture.
- [x] Enabled and configured PostgreSQL 16 with PostGIS 3.4 spatial extension via Docker Compose.
- [x] Implemented Prisma 5.22.0 ORM schema covering Districts, Alerts, HazardIncidents, Polygons, Facilities, ReliefRequests, Depots, Staff2FA, and TransparencyLedger.
- [x] Configured Redis 7 and BullMQ emergency queues (`emergency-notifications`, `relief-dispatches`).
- [x] Configured Socket.IO server for real-time district channels and EOC command rooms.
- [x] Configured Zod environment validation with safe fallback defaults.
- [x] Configured Helmet security headers, CORS origin allowlist, Morgan request logger, and centralized AppError handler.
- [x] Configured Swagger UI / OpenAPI docs at `/api/docs`.
- [x] Created and verified healthcheck endpoints (`/api/v1/health`, `/api/v1/health/database`, `/api/v1/health/services`).
- [x] Created Vitest test suite (`tests/health.test.ts`) with 100% passing tests.
- [x] Verified full TypeScript build (`npm run build`) and live server connectivity on port 5001.

### Phase 2: Database Implementation & PostGIS Integration [COMPLETED & VERIFIED]
- [x] Implemented complete PostgreSQL 16 + PostGIS 3.4 relational schema across 19 entities.
- [x] Configured PostGIS geometry columns (`GEOMETRY(Point, 4326)`) and GiST spatial indexes for facilities, hazard incidents, relief requests, and relief depots.
- [x] Seeded authentic demo data for administrative districts (`Central Delhi`, `South 24 Parganas & Kolkata`), operational shelters (LNJP Hospital, Sarvodaya Kanya Vidyalaya), live disaster alerts, flood polygons, and warehouse SKU inventories.
- [x] Initialized super-admin account (`EOC-DIR-001`, Dr. Rajesh Sharma) with secure Argon2id password hashing.
- [x] Verified spatial distance queries using `ST_DWithin` and `ST_Distance` in sub-10ms latency.
- [x] Created database test suite (`tests/database.test.ts`) with 100% passing tests (7/7 total test cases passing).

### Phase 5: Geolocation, Maps & Route Intelligence
- **Backend:** `POST /api/v1/routes/compare` requests Google Routes alternatives, checks PostGIS hazard polygons and recorded closures, applies the documented configurable risk heuristic, and returns explicit provider/data errors without fabricated routes.
- **Frontend Integration:** Page 4 collects GPS/manual origin and geocoded destinations; Page 5 renders API alternatives on Google Maps and monitors material hazard, closure, and freshness changes. Configure separate restricted browser/server keys before live use.

### Phase 4: Citizen Hazard Reporting & Safe Places Directory
- **Backend:** Implement `/api/v1/hazards/report` with file upload handling, and `/api/v1/facilities` with distance sorting and real-time bed capacity counters.
- **Frontend Integration:**
  - Wire **Page 6 (Hazard Reporting - Step 5)** hazard type selector, water depth slider, photo preview, and submission feedback.
  - Wire **Page 7 (Shelters & Hospitals)** category tabs, medical/power filters, live bed availability pills, and direct telephone dialers.

### Phase 5: Supplies Requisition, High-Entropy Tracking & SOS Toolkit
- **Backend:** Implement `/api/v1/relief-requests` with opaque 256-bit tracking tokens, multi-stage triage workflow, and `/relief-requests/track/:token`.
- **Frontend Integration:**
  - Wire **Page 8 (Supplies Request)** headcount steppers, emergency item checkboxes, stranded context selector, and submission confirmation.
  - Wire **Page 9 & 10 (Request Tracking)** real-time delivery timeline, ETA countdown, and location update modal.
  - Wire **Page 11 (Disaster Preparedness)** 72-Hour Go-Bag checklist and printable Family Plan.
  - Wire **Page 12 (SOS & Emergency Help)** 1-tap emergency calling cards and Web Audio siren generator.

### Phase 6: Authority Dashboard & Admin Operations
- **Backend:** Protected `/api/v1/authority` APIs use the existing staff session and granular role permissions, district scoping, transactional relief allocation, and audit history.
- **Frontend Integration:** The existing Page 14 dashboard loads live metrics, the hazard verification queue, incident map/table, alerts, facility quality, relief requests, inventory, SOS scope, and staff operations. Demo hazard cards are removed in the live view.

### Phase 3: Admin & Staff Authentication (2FA) [COMPLETED & VERIFIED]
- [x] Implemented exact two-step staff authentication flow (Step 1: Username & Argon2id Password -> Step 2: 6-digit SMS OTP).
- [x] Cryptographically secure OTP generation (`crypto.randomInt`), Argon2id hashing, 5-minute expiry, max 3 verification attempts, and Redis cooldown rate limiting.
- [x] Issued HttpOnly, SameSite=Lax, Secure signed JWT cookies and Authorization Bearer tokens upon successful verification.
- [x] Implemented granular Role-Based Access Control (RBAC) with 5 roles (`SUPER_ADMIN`, `EOC_DIRECTOR`, `LOGISTICS_OFFICER`, `FIELD_COMMANDER`, `DATA_OPERATOR`) and 12 permissions.
- [x] Implemented immutable audit logging recording login attempts, failed credentials, OTP validations, and session revocations.
- [x] Wired live backend endpoints directly into the existing **Staff Sign-in** screen ([`stitch-reference/screens/13-staff-login/index.html`](file:///Users/devsmaccie/Desktop/anvathon/stitch-reference/screens/13-staff-login/index.html)), preserving the original UI design while adding dynamic loading states and error notifications.
- [x] Created automated test suite ([`tests/auth.test.ts`](file:///Users/devsmaccie/Desktop/anvathon/tests/auth.test.ts)) with 100% passing tests (11/11 total tests passing).

### Phase 7: Simulation Engine, Inventory Management & Transparency Ledger
- **Backend:** Implement rainfall & dam release flood simulation service, depot inventory update endpoints, and SHA-256 transparency ledger.
- **Frontend Integration:**
  - Wire **Page 15 (Staff Tools & Simulator)** scenario sliders (rainfall mm/hr, dam discharge cusecs), warehouse SKU stock editors, and public transparency audit feed.

### Phase 8: DisasterReady AI Copilot Integration & Domain Guardrails
- **Backend:** Build the AI Copilot Orchestration Service with registered tool calling schemas (`find_shelters`, `get_active_alerts`, `check_route_safety`, `parse_request_needs`).
- **Frontend Integration:**
  - Connect embedded Copilot cards across Citizen Dashboard, Safe Route Assist, Smart Haven Finder, and EOC Decision Support.
  - Enforce human-in-the-loop approval on all authority actions.

### Phase 9: End-to-End Verification, Performance & Polishing
- Perform end-to-end testing across all 14 pages.
- Verify offline behavior, ServiceWorker caching, and responsive desktop/mobile layouts.
- Validate security headers, rate limiting, and zero-leakage of administrative data.

---

## 3. Deliverables Summary

1. `FRONTEND_AUDIT.md`: Complete audit of all 14 frontend screens and components.
2. `FEATURE_MAPPING.md`: Complete UI-to-API-to-Database mapping contract.
3. `SYSTEM_ARCHITECTURE.md`: Architecture diagrams, layer designs, and resilience strategy.
4. `DATABASE_DESIGN.md`: Complete SQL relational schema, PostGIS types, constraints, and indexes.
5. `API_CONTRACT.md`: Complete REST & WebSocket API specification.
6. `SECURITY_PLAN.md`: 2FA authentication, rate limiting, and RBAC matrix.
7. `IMPLEMENTATION_PLAN.md`: Phased engineering roadmap and verification milestones.
