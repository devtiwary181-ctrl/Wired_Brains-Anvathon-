# Comprehensive Screen & Interactive Controls Audit Inventory
**DisasterReady India (Institutional Civic Utility Platform)**

Generated: 2026-10-31  
Scope: Every screen in `stitch-reference/screens/` (01 through 15)  
Verification Status: **100% OPERATIONAL & VERIFIED** across all pages, controls, and backend pipelines.

---

## Complete Element Verification Matrix

| Page / Screen | Interactive Element | Expected Behaviour | Verified Status |
|---------------|---------------------|--------------------|:---------------:|
| **01-language-location** | `#loc-btn` ("Track my location") | High-accuracy GPS detection (`enableHighAccuracy`, `watchPosition` $\le 50$m), accuracy readout, retry option | **WORKING** |
| **01-language-location** | 12 Language Cards & Speaker buttons | Speaks in chosen language (hi, ta, te, bn, mr, gu, kn, ml, pa, as, or, en); highlights card | **WORKING** |
| **01-language-location** | `#submit-btn` ("Continue") | Persists selected language & location, navigates to Dashboard | **WORKING** |
| **01-language-location** | Search manual district | Autocompletes and selects district from list | **WORKING** |
| **01-language-location** | SOS 112 button & modal | Opens emergency call dialog and one-touch dialer | **WORKING** |
| **02-citizen-dashboard** | Unified Project Logo | Displays new institutional SVG logo across top-left bar | **WORKING** |
| **02-citizen-dashboard** | `#headerLangSelect` dropdown | Translates entire page on-the-fly, saves to `localStorage` | **WORKING** |
| **02-citizen-dashboard** | `#headerAudioBtn` (Header Speaker) | Reads district, alert status, and safety tips aloud; toggles playing state | **WORKING** |
| **02-citizen-dashboard** | Profile Avatar & Dropdown | Shows dropdown with only "Login as Admin" leading to Screen 13 | **WORKING** |
| **02-citizen-dashboard** | `#themeToggleBtn` (Dark/Light Mode) | Toggles dark mode; ensures all alert card texts are high-contrast black/dark | **WORKING** |
| **02-citizen-dashboard** | Simulation preview state pills | Switches preview card (Flash flood, clear, offline, stale data) | **WORKING** |
| **02-citizen-dashboard** | `#ttsButton` ("Listen to alert") | Reads active alert title, severity, area & advice in chosen language; stop toggle | **WORKING** |
| **02-citizen-dashboard** | `#switchDistrictBtn` | Opens modal for state selection + searchable district list | **WORKING** |
| **02-citizen-dashboard** | "Steps: What to do" button | Navigates directly to Preparedness Guides (`/screens/11-preparedness/index.html`) | **WORKING** |
| **02-citizen-dashboard** | Quick Action: "Report a Hazard" | Opens Hazard Reporting (`/screens/03-get-to-safety-step-1/index.html`) | **WORKING** |
| **02-citizen-dashboard** | Quick Action: "Find Safe Places" | Navigates to Civic Safe Places directory (`/screens/07-safe-places/index.html`) | **WORKING** |
| **02-citizen-dashboard** | Quick Action: "Ask for Supplies" | Navigates to Emergency Relief Intake (`/screens/08-emergency-relief/index.html`) | **WORKING** |
| **02-citizen-dashboard** | Quick Action: "Track My Request" | Navigates to Request Tracking (`/screens/09-relief-tracking/index.html`) | **WORKING** |
| **02-citizen-dashboard** | Bottom Navigation Bar (5 links) | Routes to Dashboard, Shelters, Supplies, Routes, Helplines | **WORKING** |
| **03-get-to-safety-step-1** | Hazard Leaflet Map | Renders live raster tiles, hazard polygons, shelters & route overlay | **WORKING** |
| **03-get-to-safety-step-1** | Hazard Type filter dropdown | Filters hazard markers & polygons, re-calculates safest route avoiding hazard | **WORKING** |
| **03-get-to-safety-step-1** | Severity, Status & Time filters | Reactive dropdowns filter hazard layers immediately | **WORKING** |
| **03-get-to-safety-step-1** | Shelter popup "Route here" | Plots OSRM route with distance and ETA to that shelter | **WORKING** |
| **03-get-to-safety-step-1** | `#btnChooseJourney` | Navigates to Step 2: Choose journey destination (`/screens/04-get-to-safety-step-2`) | **WORKING** |
| **03-get-to-safety-step-1** | Header Language dropdown | Translates all page labels, filters, headings, and navigation | **WORKING** |
| **04-get-to-safety-step-2** | Origin detection / GPS coords | Pre-fills current location coordinates with high accuracy | **WORKING** |
| **04-get-to-safety-step-2** | Destination facility list | Loads database-seeded shelters and hospitals within 50km radius | **WORKING** |
| **04-get-to-safety-step-2** | "Find routes" CTA | Stores origin, destination & travel mode, routes to comparison (Screen 05) | **WORKING** |
| **05-get-to-safety-step-4** | Route Comparison (Fastest, Safest, Shortest) | Plots multi-color routes on map; displays elevation, hazard avoidance & ETA | **WORKING** |
| **05-get-to-safety-step-4** | Route radio selection | Selecting route updates polyline highlight and navigation parameters | **WORKING** |
| **05-get-to-safety-step-4** | "Start this route" button | Proceeds to turn-by-turn navigation (Screen 06) | **WORKING** |
| **05-get-to-safety-step-4** | "Report a hazard" button | Returns to Screen 03 to report road closure | **WORKING** |
| **06-get-to-safety-step-5** | Turn-by-turn navigation steps | Renders active step-by-step guidance and safety checks | **WORKING** |
| **07-safe-places** | Civic Safe Haven Leaflet Map | Shows user pin, shelters (green S), hospitals (red H) with bed availability | **WORKING** |
| **07-safe-places** | 8 Facility filter chips | Multi-selection (Wheelchair, Women Wing, Milk, DG, Doctor, Pets, Water, All) filters list and map | **WORKING** |
| **07-safe-places** | List View / Map View switcher | Toggles between interactive map and detailed resource card feed | **WORKING** |
| **07-safe-places** | "Nearest Shelter Route" button | Queries closest shelter and draws safest green route polyline on Leaflet map | **WORKING** |
| **07-safe-places** | "Nearest Hospital Route" button | Queries closest hospital and draws safest route polyline on Leaflet map | **WORKING** |
| **07-safe-places** | Safe haven Share buttons | Web Share API with clipboard fallback, URL query params and "Copied!" toast | **WORKING** |
| **08-emergency-relief** | Needs category tiles & checkboxes | Toggles selection of water, food, medicines, infant care, tents | **WORKING** |
| **08-emergency-relief** | People counter (+ / - buttons) | Increments and decrements total headcount (1 to 50) | **WORKING** |
| **08-emergency-relief** | GPS location auto-fill | Fills latitude and longitude coordinates with high accuracy | **WORKING** |
| **08-emergency-relief** | `#submitRequestBtn` | Submits request to `/api/v1/relief/request`, saves tracking token to `localStorage` | **WORKING** |
| **09-relief-tracking** | `#trackForm` & `#reqNumber` input | Accepts private tracking token, queries `/api/v1/relief/track/:token` | **WORKING** |
| **09-relief-tracking** | Status progression tracker | Displays real-time triage status, district, headcount, and volunteer ETA | **WORKING** |
| **10-relief-tracking-alt** | Alternative tracking interface | Displays status, delivery window, and SMS dispatch options | **WORKING** |
| **11-preparedness** | 6 Preparedness guide tabs | Toggles between Alerts, AI guide, First aid, Checklist, Family plan, Check-in | **WORKING** |
| **11-preparedness** | 16 Interactive checklist checkboxes | Persists ticked state in `localStorage` and updates progress indicator | **WORKING** |
| **12-emergency-help** | Emergency Hotlines (112, 108, 1078) | One-touch direct `tel:` dialing links with touch targets $\ge 72$px | **WORKING** |
| **13-staff-login** | 2FA Step 1 & 2 authentication | Validates official employee ID, password, SMS OTP verification, and sets session | **WORKING** |
| **13-staff-login** | "Autofill Staff Credentials" | Demo autofill for rapid official evaluation | **WORKING** |
| **14-authority-dashboard** | EOC Situation & Lifecycle stages | 5 stages (Overview, Prioritise, Plan, Outcome, Simulate) with real-time incident tables | **WORKING** |
| **14-authority-dashboard** | Real-time WebSockets / Socket.IO | Synchronizes with live EOC event stream on port 5001 | **WORKING** |
| **15-staff-tools-settings** | Authority tools, alerts & audit | Simulation scenario controls, broadcast management and activity log | **WORKING** |
