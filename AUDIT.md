# Comprehensive Screen & Interactive Controls Audit Inventory
**DisasterReady India (Institutional Civic Utility Platform)**

Generated: 2026-10-31
Scope: Every screen in `stitch-reference/screens/` (01 through 15)

---

## 1. Screen 01: `01-language-location`
**Title:** DisasterReady India - Language & Location Onboarding  
**Path:** `/screens/01-language-location/index.html`  
- **Buttons (20):**
  - `#loc-btn` ("Use my location to pick my language"): Triggers high-accuracy geolocation (`enableHighAccuracy`, `watchPosition`).
  - 12 Language Selection Cards / Listen Pronunciation Buttons (`playPronunciation(lang)`): Audio speech in English, Hindi, Tamil, Telugu, Bengali, Marathi, Kannada, Gujarati, Odia, Malayalam, Punjabi, Assamese.
  - `#submit-btn` ("Continue / आगे बढ़ें"): Confirms selected language & district, transitions to `/screens/02-citizen-dashboard/index.html`.
  - SOS 112 Button: Opens SOS Modal dialog.
  - SOS Modal Call 112 & Cancel Buttons.
  - Manual Location Search Result Buttons.
- **Links (3):**
  - Header brand home link.
  - Emergency SOS tel:112 link.
  - Terms & Institutional Privacy Policy link.
- **Dropdowns / Forms:**
  - Manual district / landmark search autocomplete input.

---

## 2. Screen 02: `02-citizen-dashboard`
**Title:** DisasterReady India - National Disaster Management  
**Path:** `/screens/02-citizen-dashboard/index.html`  
- **Buttons (27):**
  - `#themeToggleBtn`: Toggles Light, Dark, System theme.
  - `#headerAudioBtn`: Reads dashboard summary, active alert, and top safety tips aloud.
  - Profile Avatar Button: Opens Admin Portal dropdown ("Login as Admin" -> `/screens/13-staff-login/index.html`).
  - Simulation Preview Pills (`.state-tab-btn`): Active Flash Flood Alert, No Active Alert / Clear, Offline Mode, Location Unavailable / Stale Data.
  - `#ttsButton` / `#ttsButtonSub` / `#ttsButtonClear` / `#ttsButtonOffline` / `#ttsButtonStale`: "Listen to alert (सुनें)".
  - `#switchDistrictBtn`: Opens State-first + Searchable District picker modal.
  - `#toggleSafeView`: Toggles preview alert simulation.
  - `#toggleOriginalTextBtn`: Shows original English / translated announcement.
  - Copilot Chips & Submit / Mic Buttons (`#aiSendBtn`, `#aiMicBtn`).
  - Offline Cache Refresh Button.
- **Links (27):**
  - "Steps: What to do" (`/screens/11-preparedness/index.html?hazard=flood`).
  - Quick Action 1: "Report a Hazard" (`/screens/03-get-to-safety-step-1/index.html` / `#`).
  - Quick Action 2: "Find Safe Places" (`/screens/07-safe-places/index.html`).
  - Quick Action 3: "Ask for Supplies" (`/screens/08-emergency-relief/index.html`).
  - Quick Action 4: "Track My Request" (`/screens/09-relief-tracking/index.html`).
  - Bottom Navigation Bar (Dashboard, Shelters, Supplies, Routes, Helplines).
  - Floating Emergency SOS 112 Link.
- **Dropdowns & Inputs (6):**
  - `#headerLangSelect`: Header language selector (translates page via `i18n.js`).
  - `#langSelect`: Announcement banner language selector.
  - `#aiUserInput`: Copilot natural language prompt input.
  - `#modalStateSelect` & `#districtModalInput`: Switch district modal.

---

## 3. Screen 03: `03-get-to-safety-step-1` (Routes & Interactive Evacuation Map)
**Title:** DisasterReady India - Evacuation Routes & Live Situation  
**Path:** `/screens/03-get-to-safety-step-1/index.html`  
- **Buttons (23):**
  - Top Back to Home Button (`/screens/02-citizen-dashboard/index.html`).
  - Top Header Language Dropdown (`headerLangSelect`): Translates whole page.
  - Header Speaker Button: Reads screen contents in selected language.
  - Profile Avatar Button: Admin login dropdown.
  - 5 Active Hazard Filter Toggle Buttons: Flood (`WATERLOGGING`), Landslide (`LANDSLIDE`), Cyclone (`CYCLONE`), Earthquake (`EARTHQUAKE`), Wildfire (`FIRE`).
  - View Switcher Tabs: `#btnTabMap` (Map View) vs `#btnTabList` (Show as List).
  - Floating Map Controls: `#btnMapSatToggle` (Satellite toggle), `#btnZoomIn`, `#btnZoomOut`, `#btnRecenter` (My Location).
  - `#btnCheckShelterBeds`: Queries nearest open shelters with available beds.
  - Kavach AI Quick Action Buttons: "Ask AI about this hazard", "Avoid Canal Rd route".
  - Offline PDF Download / Export button.
  - `#btnChooseJourney`: Primary CTA leading to Step 2 (`/screens/04-get-to-safety-step-2/index.html`).
- **Inputs & Filters:**
  - Severity dropdown (All, Danger, Warning, Advisory).
  - Verification dropdown (All, NDMA Verified, Citizen Reports).
  - Time window dropdown (All, Past 1 hour, Past 6 hours, Past 24 hours).
  - Checkboxes: `#hazard-layer-polygons` (Hazard Zones) and `#hazard-layer-markers` (Markers).
  - `#unverifiedToggle`: Avoid unverified hazards switch.

---

## 4. Screen 04: `04-get-to-safety-step-2` (Choose My Journey & Route Options)
**Title:** DisasterReady India - Choose your journey (मार्ग चुनें)  
**Path:** `/screens/04-get-to-safety-step-2/index.html`  
- **Buttons (36):**
  - Header Language Dropdown, Dark Mode Toggle, Header Audio, Profile Avatar.
  - Origin Selector Radio Buttons: Option 1 (Use my GPS), Option 2 (Choose from list), Option 3 (Tap on map).
  - Map Picker Dialog Buttons (`#btn-close-map-picker`, confirm coordinates).
  - Transit Mode Buttons: On foot (Walk), Two-wheeler, Car / Auto, Ambulance (108).
  - Special Needs Toggle Buttons: Wheelchair access, Infant / Milk, Elderly, Medical equipment, Pets, Women safe spaces.
  - Group travel meeting point picker.
  - Kavach AI Destination Suggestion & "Try prompt" / "Review & Apply to Form".
  - Destination Tabs: Shelter Camps vs Emergency Hospitals.
  - Primary Action Button: "Find routes (सुरक्षित मार्ग खोजें)" -> proceeds to Step 4 (`/screens/05-get-to-safety-step-4/index.html`).
- **Inputs:**
  - Origin search input, Destination search input, Group travel checkbox.

---

## 5. Screen 05: `05-get-to-safety-step-4` (Route Comparison & Turn-by-Turn Guidance)
**Title:** DisasterReady India - Route Comparison & Safe Navigation  
**Path:** `/screens/05-get-to-safety-step-4/index.html`  
- **Buttons (31):**
  - Route Card Radio Selections:
    - Route A: Shortest / Direct (Red - High Risk / Canal Road flooded).
    - Route B: Safest / High Ridge Bypass (Green - Recommended / Zero flood exposure).
    - Route C: Fastest / Ring Road Motorway (Blue - Alternative).
  - Expand / Collapse "Why is this route safest?" accordion.
  - "Copy Directions" Button (`copyDirections()`) with clipboard feedback.
  - Turn-by-turn steps expand/collapse.
  - Primary Action: "Proceed to Active Navigation (मार्गदर्शन शुरू करें)" -> `/screens/06-get-to-safety-step-5/index.html`.
  - Offline Map & Satellite Layer controls.

---

## 6. Screen 06: `06-get-to-safety-step-5` (Active Turn-by-Turn GPS Navigation)
**Title:** DisasterReady India - Active Evacuation Navigation  
**Path:** `/screens/06-get-to-safety-step-5/index.html`  
- **Buttons (24):**
  - "Mute / Unmute Voice Guidance", "Recenter GPS", "Report Hazard on Path", "I have arrived safely" button, Emergency SOS trigger.
- **Inputs & Controls:**
  - Real-time GPS accuracy badge, rerouting alert banner.

---

## 7. Screen 07: `07-safe-places` (Civic Safe Haven Map & Shelters Directory)
**Title:** DisasterReady India - Safe Places & Emergency Shelters  
**Path:** `/screens/07-safe-places/index.html`  
- **Buttons (30):**
  - Header Language Dropdown (`headerLangSelect`) & Audio speaker.
  - Facility Category Tabs: Emergency Shelters vs Hospitals / Trauma Centers.
  - Facility Feature Filter Buttons:
    1. All (Resets filters)
    2. Wheelchair Ramp
    3. Women Wing
    4. Infant Milk
    5. Generator Backup
    6. Doctor on Site
    7. Pets Allowed
    8. Clean Water
  - View Switcher: List View vs Map View.
  - Share Feature Button: Native `navigator.share` with fallback to clipboard copying, WhatsApp, and SMS links with query params.
  - "Nearest Shelter" & "Nearest Hospital" Route Buttons: Calculates safest OSRM route with distance, ETA, and turn-by-turn steps.
  - "Route here" button on shelter cards and map popups.

---

## 8. Screen 08: `08-emergency-relief` (Ask for Supplies / Emergency Relief Request)
**Title:** DisasterReady India - Emergency Relief & Supplies  
**Path:** `/screens/08-emergency-relief/index.html`  
- **Buttons (54):**
  - Back Button (`/screens/02-citizen-dashboard/index.html`), Listen audio button.
  - Step 1 Items Multi-Select Tiles: Drinking water, Food rations, Medicines & Kit, Blankets & Wear, Emergency Tents, Baby food/Milk, Sanitation Kit, Other.
  - Step 2 Quantity Stepper: `#decrementPeople`, `#incrementPeople`, and Quick Presets (1 Person, 2-4 Family, 5-10 Group, 11+ Community).
  - Step 3 Extra Care Toggle Buttons: Infant, Elderly, Pregnant woman, PwD, Critical patient.
  - Step 4 Urgency Timeline Buttons: <6 hours, 6 to 24 hours, 1-2 days, >2 days.
  - Step 5 Location Buttons: "Use my GPS location", "Select Ward/Area", "Tap on Map".
  - Step 6 Photo Upload & Skip buttons.
  - Step 7 Submit Button (`#submitRequestBtn`): Submits relief request to backend (`/api/v1/relief/request`), stores tracking token in localStorage, displays confirmation, and links to `/screens/09-relief-tracking/index.html`.
- **Inputs:**
  - Custom supplies specification, Landmark description textarea, Contact Phone Number (+91 input).

---

## 9. Screen 09 & 10: `09-relief-tracking` & `10-relief-tracking-alternative`
**Title:** DisasterReady India - Relief Request Tracking  
**Path:** `/screens/09-relief-tracking/index.html` & `/screens/10-relief-tracking-alternative/index.html`  
- **Buttons (23 each):**
  - Tracking Token Search Input & "Track Request" button.
  - Status Stepper: Submitted -> Verified -> Dispatched -> Out for Delivery -> Delivered.
  - "Call NDRF / Delivery Marshal" action button.
  - Cancel / Modify Request button.
  - Bottom navigation bar.

---

## 10. Screen 11: `11-preparedness` (Preparedness & Survival Guides)
**Title:** DisasterReady India - Preparedness & Survival Guides  
**Path:** `/screens/11-preparedness/index.html`  
- **Buttons (21):**
  - Hazard Scenario Tabs: Flood & Waterlogging, Cyclone / High Winds, Earthquake, Landslides, Heatwave.
  - 72-Hour Grab Bag Checklist checkboxes with auto-calculated progress percentage.
  - First Aid Walkthrough cards.
  - Family Emergency Plan download / print / share buttons.
  - Encrypted Offline Document Vault link.

---

## 11. Screen 12: `12-emergency-help` (Emergency Helplines & SOS Directory)
**Title:** DisasterReady India - Emergency Helplines & SOS Directory  
**Path:** `/screens/12-emergency-help/index.html`  
- **Buttons (36):**
  - Direct 1-Click Call Buttons: 112 (National Emergency), 1078 (NDMA Disaster Helpline), 108 (Ambulance), 101 (Fire), 1091 (Women Helpline), 1070 (State Relief Commissioner).
  - District EOC Helpline Quick Lookup by state & district.
  - Emergency SMS Broadcast format generator.

---

## 12. Screen 13: `13-staff-login` (Staff & Officer Secure Login)
**Title:** DisasterReady India - Staff & Officer Secure Login  
**Path:** `/screens/13-staff-login/index.html`  
- **Buttons (31):**
  - Government ID / Username input, Password input.
  - Request SMS OTP button, Submit Login button (authenticates against `/api/v1/auth/login`).
  - Redirects to `/screens/14-authority-dashboard/index.html` on success.

---

## 13. Screen 14 & 15: `14-authority-dashboard` & `15-staff-tools-settings`
**Title:** State Emergency Operations Center (SEOC) & Staff Tools  
**Path:** `/screens/14-authority-dashboard/index.html` & `/screens/15-staff-tools-settings/index.html`  
- **Buttons & Controls (58 and 41):**
  - SEOC Incident Commander tools: Verify citizen hazard reports, broadcast emergency alerts, update shelter occupancy, dispatch relief trucks, run dam release / rainfall evacuation simulations.

