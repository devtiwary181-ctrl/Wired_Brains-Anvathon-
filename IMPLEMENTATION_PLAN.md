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

### Phase 2: Public Geospatial, Hazards & Active Alert Services
- **Backend:** Implement PostGIS reverse geocoding, active disaster alerts retrieval, and spatial hazard polygon queries.
- **Frontend Integration:**
  - Wire **Page 1 (Language & Location)** GPS auto-detect and district selector.
  - Wire **Page 2 (Citizen Dashboard)** live alert banner, disaster filters, and live hazard map preview.
  - Wire **Page 3 (Hazard Overview - Step 1)** interactive map layer toggles (`Flood Zones`, `Blocked Roads`, `Shelters`).

### Phase 3: Safe Route Navigation & Hazard-Aware Engine
- **Backend:** Implement `/api/v1/routing/calculate-safe-routes` evaluating routes against flood polygons and elevation profiles.
- **Frontend Integration:**
  - Wire **Page 4 (Choose Journey - Step 2)** destination search, mobility mode selector, and vulnerability profile checklist.
  - Wire **Page 5 (Route Comparison - Step 4)** side-by-side route cards (Safest vs Shortest), elevation profile visualization, turn-by-turn waypoint list, and offline PDF/Text export.

### Phase 4: Citizen Hazard Reporting & Safe Places Directory
- **Backend:** Implement `/api/v1/hazards/report` with file upload handling, and `/api/v1/facilities` with distance sorting and real-time bed capacity counters.
- **Frontend Integration:**
  - Wire **Page 6 (Hazard Reporting - Step 5)** hazard type selector, water depth slider, photo preview, and submission feedback.
  - Wire **Page 7 (Shelters & Hospitals)** category tabs, medical/power filters, live bed availability pills, and direct telephone dialers.

### Phase 5: Supplies Requisition, High-Entropy Tracking & SOS Toolkit
- **Backend:** Implement `/api/v1/relief-requests` token generator (`RELIEF-IN-8492-XQ7`), multi-stage triage workflow, and `/relief-requests/track/:token`.
- **Frontend Integration:**
  - Wire **Page 8 (Supplies Request)** headcount steppers, emergency item checkboxes, stranded context selector, and submission confirmation.
  - Wire **Page 9 & 10 (Request Tracking)** real-time delivery timeline, ETA countdown, and location update modal.
  - Wire **Page 11 (Disaster Preparedness)** 72-Hour Go-Bag checklist and printable Family Plan.
  - Wire **Page 12 (SOS & Emergency Help)** 1-tap emergency calling cards and Web Audio siren generator.

### Phase 6: Staff Authentication (2FA) & EOC Command Center
- **Backend:** Implement Argon2 credential verification, 6-digit SMS OTP challenge flow, JWT HttpOnly session cookies, and RBAC middleware.
- **Frontend Integration:**
  - Wire **Page 13 (Staff Sign-in)** Step 1 username/password form and Step 2 split 6-digit OTP boxes with resend countdown.
  - Wire **Page 14 (Authority Dashboard)** live telemetry summary, district spatial incident map, and Stages 1-5 relief request triage workflow.

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
