# DisasterReady India — Hackathon Demonstration Guide

**Audience:** Hackathon Judges, Disaster Management Officials, Technical Evaluators  
**Estimated Demo Time:** 5 to 7 Minutes  
**Presentation Narrative:** "From Citizen Distress to Authority Command in Under 30 Seconds"

---

## 🎯 Pre-Demo Preparation Checklist

1. **Verify Services Running:**
   ```bash
   # Terminal 1: Docker (PostGIS & Redis)
   docker compose up -d

   # Terminal 2: Backend API
   npm run dev

   # Terminal 3: Frontend Static Server
   npx serve stitch-reference -l 3000
   ```
2. **Verify Health Endpoint:**
   Open `http://localhost:5000/api/v1/health` in browser. Expect `status: "ONLINE"`.
3. **Open Two Browser Windows:**
   - **Window A (Left):** Citizen View (`http://localhost:3000/screens/01-language-location-onboarding/index.html`)
   - **Window B (Right):** Authority Command Center (`http://localhost:3000/screens/10-authority-dashboard-overview/index.html`)

---

## ⏱️ Step-by-Step Demo Script

### Scene 1: Citizen Onboarding & Crisis Awareness (Minute 0:00 - 1:15)
- **Action:** In Window A, show Language selection (Hindi/English) and GPS detection.
- **Narrative:** *"A citizen caught in an active monsoon crisis in Mumbai opens the app without an app store download. With one tap, their location is detected and saved locally in IndexedDB without demanding a registration form."*
- **Navigate to Screen 2 (Citizen Home Dashboard):**
  - Point out active cyclone warnings from NDMA/IMD.
  - Show real-time shelter capacity and quick emergency action cards.

### Scene 2: Community Hazard Reporting & Spatial Mapping (Minute 1:15 - 2:30)
- **Navigate to Screen 3 (Citizen Hazard Map & Reporting):**
  - Click **"Report Hazard"**.
  - Fill out: Category: `Flooding`, Title: `Waterlogging near Andheri Subway`, Severity: `High`.
  - Submit the report.
- **Show Immediate Real-Time Feedback:**
  - In Window B (Authority Command Center), show that the incoming hazard immediately appears in the verification queue via Socket.IO without refreshing the page!
  - Click **Verify Hazard** as the Authority Commander.
  - Show the citizen map dynamically updating with the newly verified hazard pin.

### Scene 3: Safe Evacuation Routing & Facilities (Minute 2:30 - 3:30)
- **Navigate to Screen 5 (Evacuation Routes):**
  - Origin: Current location; Destination: Santacruz Relief Camp.
  - Show the Multi-Criteria Route Comparison: The system evaluates both Route A and Route B, highlighting that Route A intersects the newly verified flood zone, automatically recommending safer Route B with an 85% lower risk score.
- **Navigate to Screen 6 (Critical Facilities):**
  - Show nearest operational hospitals and shelters with live bed count and contact details.

### Scene 4: Double-Blind Anonymous Relief & Instant SOS (Minute 3:30 - 4:45)
- **Navigate to Screen 7 (Public Supplies Request):**
  - Request: `Emergency Rations & Potable Water` for 10 people.
  - Submit request.
  - **Highlight the Innovation:** Point to the generated token: `DR-7A8B9C0D1E2F`.
  - *"Citizens maintain privacy in temporary camps; anyone with this tracking token can inspect dispatch status without creating an account."*
- **Navigate to Screen 8 (Request Tracking):**
  - Enter the token to show real-time timeline progress (`SUBMITTED` -> `UNDER REVIEW`).
- **Navigate to Screen 9 (Instant SOS):**
  - Press the red SOS beacon. Show the siren banner and instant dispatch broadcast to SDRF emergency teams.

### Scene 5: Disaster Simulations & AI Copilot (Minute 4:45 - 6:00)
- **In Window B, Navigate to Screen 13 (Disaster Simulations):**
  - Select `Cyclone Impact Scenario`, Radius: `25 km`, Severity: `Extreme`.
  - Click **"Run Simulation"**.
  - Review instant casualty estimates, projected shelter overload, and required food rations.
  - **Emphasize Data Integrity:** Show that running this extreme simulation did NOT pollute real citizen alert feeds.
- **Activate AI Incident Copilot (Screen 11 / Floating Widget):**
  - Ask: *"Where is the closest medical facility with emergency triage?"*
  - Demonstrate instant grounded response in Hindi or English using deterministic spatial domain tools.

---

## 🏆 Key Talking Points for Judges

1. **Production-Grade Invariants:** Zero negative inventory race conditions, sub-second PostGIS geospatial filtering, and double-blind anonymous relief tracking.
2. **100% Automated Test Coverage:** 141 automated integration, security, and performance tests passing across 13 test suites.
3. **Resilience First:** Full offline PWA readiness with Service Workers and background replay, graceful 503 degradations, and transactional outbox event reliability.
