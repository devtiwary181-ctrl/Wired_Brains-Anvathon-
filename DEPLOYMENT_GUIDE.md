# DisasterReady India — Unified Single-Server Production Deployment Guide

This document specifies the consolidated architecture, deployment instructions, environment variables, and verification procedures for running DisasterReady India as a **single-origin, single-server application**.

---

## 1. Unified Architecture Overview

DisasterReady India is consolidated into a single public web origin. A single Node.js Express server process concurrently serves:
1. **Frontend Static Web Application**: All 14 Google Stitch screens, vendor assets (Leaflet open-source mapping), and client-side modules.
2. **REST API Gateway**: Protected and public disaster-management APIs mounted under `/api/v1/...`.
3. **Real-time WebSockets**: Persistent bidirectional Socket.IO communication mounted on `/socket.io/...` on the exact same HTTP server and public port.
4. **Spatial Database & Cache**: PostgreSQL 16 with PostGIS 3.4 for spatial containment/buffering and Redis 7 for real-time pub/sub and state caching.

```
                              [ HTTPS:443 / HTTP:5001 ]
                                         │
                             ┌───────────▼───────────┐
                             │  DisasterReady India  │
                             │  Unified App Server   │
                             │ (Express 5+Socket.IO) │
                             └─────┬───────┬───────┬─┘
                 ┌─────────────────┘       │       └─────────────────┐
                 ▼                         ▼                         ▼
        [ Frontend Static ]         [ REST APIs ]             [ Socket.IO ]
    - 14 Stitch HTML Screens     - /api/v1/citizen/...     - Real-time broadcasts
    - Leaflet.js / OSM CSS       - /api/v1/authority/...   - SOS alert feed
    - SPA Friendly Routes        - /api/v1/auth/...        - Hazard map updates
                 │                         │                         │
                 └─────────────────┬───────┴─────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
       [ PostgreSQL 16 + PostGIS ]          [ Redis 7 ]
       (Spatial Hazard Boundaries)    (Pub/Sub & Event Cache)
```

---

## 2. Public URL & Route Mapping

Every citizen screen and administrative tool is accessible from one public URL through clean routes and direct paths:

| Clean Route | Direct Screen Path | Functionality |
| :--- | :--- | :--- |
| `/` | `screens/01-language-location/index.html` | Language selection, GPS geolocation & district onboarding |
| `/dashboard` | `screens/02-citizen-dashboard/index.html` | Citizen home dashboard, live alerts & emergency status |
| `/hazards` | `screens/03-get-to-safety-step-1/index.html` | Interactive Leaflet hazard map, spatial query & safety steps |
| `/routes` | `screens/04-get-to-safety-step-2/index.html` | Evacuation route safety analysis & multi-modal transport |
| `/routes/step2` | `screens/05-get-to-safety-step-4/index.html` | Step-by-step route directions & safe corridor verification |
| `/report` | `screens/06-get-to-safety-step-5/index.html` | Citizen hazard reporting (waterlogging, live wires, landslides) |
| `/shelters` | `screens/07-safe-places/index.html` | Emergency shelters, relief camps & hospitals directory |
| `/supplies` | `screens/08-emergency-relief/index.html` | Relief supply requests (food, water, infant care, first aid) |
| `/supplies/success` | `screens/09-relief-tracking/index.html` | Order confirmation & relief supply tracking token |
| `/tracking` | `screens/10-relief-tracking-alternative/index.html` | Dispatch status, ETA, and volunteer tracking |
| `/preparedness` | `screens/11-preparedness/index.html` | Pre-disaster checklists, flood kits & family safety protocols |
| `/sos` | `screens/12-emergency-help/index.html` | Emergency 112/108/1078 SOS dispatch trigger & offline SMS |
| `/admin` or `/login` | `screens/13-staff-login/index.html` | Authority authentication & 2FA SMS challenge |
| `/admin/dashboard` | `screens/14-authority-dashboard/index.html` | NDRF / SDMA command center, live hazard triage & inventory |
| `/simulations` | `screens/15-staff-tools-settings/index.html` | Disaster drills, flood surge simulations & system controls |

---

## 3. Deployment Instructions

### Prerequisites
- Docker & Docker Compose (v2.20+) OR Node.js 20+ with PostgreSQL 16 (PostGIS) and Redis 7.

### Option A: Complete Dockerized Production Deployment
Run the entire unified stack (Frontend + Backend + PostGIS + Redis) in isolated containers:

1. **Configure Environment:**
   ```bash
   cp .env.production.example .env.production
   # Update secrets, database credentials, and your public domain in .env.production
   ```

2. **Build and Launch Containers:**
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
   ```

3. **Run Database Migrations & Seed Data:**
   ```bash
   docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
   docker compose -f docker-compose.prod.yml exec app npx prisma db seed
   ```

4. **Verify Application Health:**
   ```bash
   curl -f http://localhost:5001/api/v1/health
   ```

### Option B: Local Demonstration Startup
To start the stack locally for immediate evaluation:

1. **Start all services with the unified script:**
   ```bash
   ./start-all.sh
   ```
   *This starts the PostgreSQL + PostGIS and Redis containers, verifies their health, clears port 5001, and launches the unified single-server application.*

2. **Access the application in your browser:**
   - **Unified Application:** [http://localhost:5001](http://localhost:5001)
   - **Citizen Dashboard:** [http://localhost:5001/dashboard](http://localhost:5001/dashboard)
   - **Authority Dashboard:** [http://localhost:5001/admin](http://localhost:5001/admin)

3. **To stop all services:**
   ```bash
   ./stop-all.sh
   ```

---

## 4. Open-Source Mapping Integration

The application has migrated away from proprietary Google Maps APIs:
- **Base Map Tiles**: OpenStreetMap raster tiles rendered securely over HTTPS (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`).
- **Interactive Map Engine**: Leaflet.js v1.9.4 self-hosted locally under `/vendor/leaflet/`.
- **Road Routing**: Open Source Routing Machine (OSRM) HTTP API (`https://router.project-osrm.org/route/v1/...`) with offline PostGIS straight-line fallback.
- **Geocoding**: OpenStreetMap Nominatim with district polygon and bounding box database caching.
- **Spatial Calculations**: PostgreSQL + PostGIS geometry queries (`ST_DWithin`, `ST_Intersects`, `ST_Buffer`).
- **Zero API Keys Required**: No billing accounts or external map keys needed.

---

## 5. Security & Production Hardening

- **Same-Origin Requests**: All frontend requests default to relative paths (`/api/v1/...`), eliminating cross-origin preflight requests and cookie sharing issues.
- **Security Headers**: Configured via Helmet with HSTS, X-Content-Type-Options, Frame Options, and XSS filtering.
- **Rate Limiting**: Public APIs, hazard reporting, and relief creation are protected by Redis/memory token bucket rate limiters.
- **Secret Isolation**: All credentials, JWT signing keys, and database passwords are read from environment variables; no secrets are committed to the codebase.
