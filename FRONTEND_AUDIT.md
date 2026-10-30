# DisasterReady India — Comprehensive Frontend Audit

## 1. Executive Summary & Repository Scope

The **DisasterReady India — Safe Routes and Smart Relief Distribution** platform frontend comprises 15 raw template screens (representing 14 core functional pages + 1 alternative view for tracking) generated using Google Stitch. The visual design establishes an authentic, high-reliability Indian public utility interface (modeled on NDMA, IMD, and Indian Railways/IRCTC) featuring Noto Sans typography, high-contrast accessible color tokens (`#0B5FA5` primary action blue, `#1B7F4B` safe green, `#8A4B00` alert orange, `#B3261E` emergency red), and clean 1px solid boundaries without decorative blurs or non-essential dropshadows.

Every screen has been verified for its exact component inventory, DOM structure, inputs, buttons, modals, interactive micro-scripts, mock datasets, and embedded **DisasterReady AI Copilot** controls.

---

## 2. Page-by-Page Audit of the 14 Frontend Pages

### Page 1: Language & Location Onboarding
- **Folder / File:** [`stitch-reference/screens/01-language-location/index.html`](file:///Users/devsmaccie/Desktop/anvathon/stitch-reference/screens/01-language-location/index.html)
- **Title / Role:** Language & Location Start Screen (Entry Gateway)
- **Core Components:**
  - Official national emblem and Tricolor ribbon header.
  - Indian Language Grid (9 initial languages: English, हिन्दी, বাংলা, తెలుగు, தமிழ், मराठी, ગુજરાતી, ಕನ್ನಡ, മലയാളം).
  - State & District selector cards with auto-detected GPS location prompt.
  - Offline mode cached indicator badge (`[Offline Ready: 14:32 IST]`).
  - Emergency SOS persistent quick-dial banner (`Call 112`).
- **Interactive Elements & Buttons (19 buttons):**
  - Language selection toggle buttons with active state border `#0B5FA5`.
  - "Detect My Current Location" GPS trigger.
  - "Confirm & Enter DisasterReady India" primary CTA button.
  - Quick-emergency access bypass button.
- **Inputs & Selects:**
  - District dropdown selector (with state pre-filter).
- **Embedded AI Copilot:**
  - Quick voice prompt trigger: *"Speak in your mother tongue for emergency assistance."*

---

### Page 2: Citizen Home Dashboard
- **Folder / File:** [`stitch-reference/screens/02-citizen-dashboard/index.html`](file:///Users/devsmaccie/Desktop/anvathon/stitch-reference/screens/02-citizen-dashboard/index.html)
- **Title / Role:** National Disaster Awareness & Citizen Home Dashboard
- **Core Components:**
  - Operational Alert Banner (Severe Cyclone / Flood Warning with active IMD alert level).
  - Disaster Category Cards (Floods, Cyclones, Earthquakes, Landslides, Wildfires).
  - Primary Action Grid:
    - *Get to Safety (5-step safe navigation)*
    - *Find Shelters & Hospitals*
    - *Request Emergency Relief Supplies*
    - *Track My Relief Request*
    - *Emergency SOS & Helpline Directory*
  - Live Hazard Map preview with zoom and layer controls.
  - Audio Listen / Text-to-Speech (TTS) banner for low-literacy accessibility.
- **Buttons (21 buttons) & Inputs (2 inputs, 1 select):**
  - Search input: Emergency shelter or incident search.
  - Disaster type filter buttons.
  - Audio playback button (`[Speaker Icon] Read aloud alerts`).
  - Direct navigation buttons to sub-journeys.
- **DisasterReady AI Copilot Card:**
  - Embedded Copilot card with quick conversational chips:
    - *"Where is the nearest dry relief camp?"*
    - *"Is the bypass bridge passable on foot?"*
    - *"What supplies can I request for infants?"*
  - Text input for natural language query with audio mic button.

---

### Page 3: Hazard Overview & Map (Get to Safety - Step 1 of 5)
- **Folder / File:** [`stitch-reference/screens/03-get-to-safety-step-1/index.html`](file:///Users/devsmaccie/Desktop/anvathon/stitch-reference/screens/03-get-to-safety-step-1/index.html)
- **Title / Role:** See the Situation — Active Hazard Assessment & Geospatial Layers
- **Core Components:**
  - Multi-step progress stepper (Step 1 active: Situation -> Journey -> Routes -> Navigation -> Report).
  - Interactive Hazard Map viewport displaying flood inundation zones, landslide risk corridors, waterlogged roads, and safe zones.
  - Hazard severity breakdown cards with verified timestamps (`NDRF Verified 12 mins ago`).
  - Community incident ticker.
- **Interactive Buttons (23 buttons) & Inputs (1 input):**
  - Map layer toggles: `Flood Zones`, `Blocked Roads`, `Active Shelters`, `Medical Posts`.
  - Severity filter chips (`Red / Severe`, `Orange / Moderate`, `Green / Safe`).
  - "Proceed to Choose Journey (Step 2)" CTA button.
- **DisasterReady AI Copilot Integration:**
  - "AI Area Intelligence Summary" generating plain-language risk briefs:
    - *"Ward 4 is experiencing 1.2m waterlogging. North evacuation corridor remains clear."*

---

### Page 4: Choose Journey (Get to Safety - Step 2 of 5)
- **Folder / File:** [`stitch-reference/screens/04-get-to-safety-step-2/index.html`](file:///Users/devsmaccie/Desktop/anvathon/stitch-reference/screens/04-get-to-safety-step-2/index.html)
- **Title / Role:** Evacuation Destination & Mobility Mode Selection
- **Core Components:**
  - Origin location pin (GPS current location or manual landmark input).
  - Recommended destination cards (Designated NDRF Relief Camps, District General Hospital, Elevated Community Center).
  - Transit Mode Selector: `Walking on Foot`, `Two-Wheeler / Bike`, `Car / Light Vehicle`, `Heavy Vehicle / Bus`.
  - Vulnerability profile toggles: `Senior Citizens in Group`, `Infant / Children`, `Disabled / Wheelchair`, `Critical Medical Condition`.
- **Interactive Buttons (35 buttons) & Inputs (2 inputs):**
  - Origin / Destination search text inputs with autocomplete.
  - Mobility mode radio-cards.
  - Vulnerability checklist buttons.
  - "Compare Safe Routes (Step 3/4)" primary CTA.
- **DisasterReady AI Copilot Integration:**
  - Natural Language Destination Assist:
    - *"I have elderly family members and need a dry shelter with oxygen support within 3 km."*

---

### Page 5: Route Comparison & Navigation (Get to Safety - Step 4 of 5)
- **Folder / File:** [`stitch-reference/screens/05-get-to-safety-step-4/index.html`](file:///Users/devsmaccie/Desktop/anvathon/stitch-reference/screens/05-get-to-safety-step-4/index.html)
- **Title / Role:** Safe Route Comparison & Turn-by-Turn Hazard Avoidance
- **Core Components:**
  - Side-by-side / stacked Route Cards:
    - **Route A (Safest • Recommended):** High-ridge route, zero waterlogging, +8 mins travel time, 100% paved.
    - **Route B (Shortest • Caution):** Low-lying culvert, 15cm moving water risk, congested.
    - **Route C (Blocked • Closed):** Inundated bridge, closed by Police / SDRF.
  - Elevation profile graph and live water level depth indicators along route segments.
  - Step-by-step waypoint turn instructions.
  - Offline SMS / Turn-by-turn text export for low-battery situations.
- **Interactive Buttons (31 buttons) & Inputs (4 inputs):**
  - "Start Turn-by-Turn Safe Navigation" CTA.
  - "Download Route for Offline Use (PDF/Cache)".
  - "Why this route?" expandable accordion explaining risk factors.
- **DisasterReady AI Copilot Integration:**
  - Live route safety monitoring assistant:
    - *"Copilot is monitoring water levels on High Ridge Road. Re-routing enabled if culvert level rises."*

---

### Page 6: Hazard Reporting (Get to Safety - Step 5 of 5)
- **Folder / File:** [`stitch-reference/screens/06-get-to-safety-step-5/index.html`](file:///Users/devsmaccie/Desktop/anvathon/stitch-reference/screens/06-get-to-safety-step-5/index.html)
- **Title / Role:** Citizen Hazard & Road Impact Reporting
- **Core Components:**
  - Rapid 1-tap hazard categories:
    - `Waterlogged / Flooded Road`
    - `Fallen Tree / Blocked Path`
    - `Collapsed Wire / Electrical Sparking`
    - `Bridge Submerged / Damaged`
    - `Landslide / Mud Debris`
  - Severity Stepper (`Low / Passable`, `Medium / Caution`, `Severe / Total Block`).
  - Water depth estimator slider (Ankle depth, Knee depth, Waist depth, Submerged vehicle).
  - Photo upload attachment box (with camera trigger and compression warning).
  - Geolocation pin grabber with landmark description.
- **Interactive Buttons (23 buttons):**
  - Hazard icon cards with instant selection feedback.
  - "Submit Hazard Report (No Sign-in Required)" CTA.
  - "Submit via Free SMS" fallback trigger.
- **DisasterReady AI Copilot Integration:**
  - Voice-to-report conversational intake:
    - *"Describe what you see and the AI formats the report for District EOC review."*

---

### Page 7: Shelters & Hospitals
- **Folder / File:** [`stitch-reference/screens/07-safe-places/index.html`](file:///Users/devsmaccie/Desktop/anvathon/stitch-reference/screens/07-safe-places/index.html)
- **Title / Role:** Verified Safe Places Directory (Relief Camps & Emergency Medical Centers)
- **Core Components:**
  - Category switch tabs: `All Facilities`, `Relief Shelters`, `Hospitals & Trauma Centers`, `Food & Water Points`.
  - Filter bar: Distance slider, Bed Availability (`Available > 50`, `Filling Up < 10`, `Full`), Medical Support, Pet-friendly, Generator Power.
  - Facility Cards:
    - Official verification checkmark (`NDMA Verified 20m ago`).
    - Real-time capacity counter (`342 / 500 Beds Occupied`).
    - Available supplies (Clean water, hot meals, emergency maternal care).
    - Distance, navigation button, and direct landline contact.
- **Interactive Buttons (30 buttons) & Inputs (2 inputs):**
  - Facility search input.
  - Filter pills and category switchers.
  - "Navigate Safely to Shelter" and "Call Camp In-Charge" buttons.
- **DisasterReady AI Copilot Integration:**
  - "Smart Haven Finder" query bar:
    - *"Find hospital with operational neonatal ICU that does not require traversing flooded south sector."*

---

### Page 8: Supplies Request
- **Folder / File:** [`stitch-reference/screens/08-emergency-relief/index.html`](file:///Users/devsmaccie/Desktop/anvathon/stitch-reference/screens/08-emergency-relief/index.html)
- **Title / Role:** Emergency Relief Supply & Life Support Request
- **Core Components:**
  - Zero-login emergency requisition form.
  - People counter stepper (`Number of adults, children, infants, senior citizens`).
  - Categorized supply checklist:
    - `Drinking Water (20L Jerrycans)`
    - `Dry Ration Kits (Rice, Dal, Biscuits)`
    - `Infant Food & Milk Formula`
    - `Emergency First Aid & Chronic Meds (Insulin, BP)`
    - `Tarpaulins & Warm Blankets`
    - `Sanitary & Hygiene Kits`
  - Delivery context: `Stranded on Rooftop`, `At Community Center`, `In Ground Floor House`, `Isolated with Blocked Road`.
  - Urgency level selector (`Standard / 12-24h`, `High Priority / 4-6h`, `Critical Life Safety / Immediate`).
  - Contact number (optional for tracking SMS) + Landmark input.
- **Interactive Buttons (53 buttons) & Inputs (3 inputs):**
  - Numeric increment/decrement buttons for headcount.
  - Supply category toggle chips.
  - "Submit Emergency Relief Request" prominent button.
- **DisasterReady AI Copilot Integration:**
  - Plain language natural intake:
    - *"We are 6 people including an 8-month baby and diabetic grandmother stranded near Gandhi Chowk water tank."*
    - Automatically populates the item checklist and headcounts.

---

### Page 9 & 10: Request Tracking (Primary & Alternative Refined Views)
- **Folders / Files:**
  - [`stitch-reference/screens/09-relief-tracking/index.html`](file:///Users/devsmaccie/Desktop/anvathon/stitch-reference/screens/09-relief-tracking/index.html)
  - [`stitch-reference/screens/10-relief-tracking-alternative/index.html`](file:///Users/devsmaccie/Desktop/anvathon/stitch-reference/screens/10-relief-tracking-alternative/index.html)
- **Title / Role:** No-Login High-Entropy Token Tracking
- **Core Components:**
  - Token input box for the private opaque token returned by a relief request.
  - Multi-stage vertical delivery timeline:
    - `Step 1: Request Logged & Triaged (Verified)`
    - `Step 2: NDRF / SDRF Supply Depot Allocated`
    - `Step 3: Vehicle In-Transit (Boat / 4x4 Drone Dispatch)`
    - `Step 4: Field Responder Delivered & Confirmed`
  - Assigned field officer phone link and rescue boat dispatch ID.
  - Live status badge: `In Transit • ETA 42 Mins`.
  - Audio status read-aloud button.
- **Interactive Buttons (21/23 buttons) & Inputs (2 inputs):**
  - Token lookup input and search CTA.
  - "Update Location if Evacuated" modal trigger.
  - "Cancel / Mark Already Rescued" button to free emergency resources.
- **DisasterReady AI Copilot Integration:**
  - Telemetry Explainer: AI explains delay causes (e.g., *"Dispatch boat delayed 15 minutes due to high current under Railway Bridge; alternate route taken via Canal Bank"*).

---

### Page 11: Disaster Preparedness
- **Folder / File:** [`stitch-reference/screens/11-preparedness/index.html`](file:///Users/devsmaccie/Desktop/anvathon/stitch-reference/screens/11-preparedness/index.html)
- **Title / Role:** Emergency Preparedness, First-Aid Guides & Family Plan
- **Core Components:**
  - Disaster tabs: `Cyclone / Flood`, `Earthquake`, `Landslide`, `Fire Safety`.
  - Interactive 72-Hour "Go-Bag" Checklist with interactive checkable items.
  - Offline first-aid protocols (CPR, flood water safety, wound care, snakes & reptile hazards).
  - Printable Family Evacuation Meeting Point Card generator.
- **Interactive Buttons (21 buttons) & Inputs (12 checkboxes/inputs):**
  - Checkbox items for Go-Bag (Water, documents, torch, battery, radio).
  - "Download Preparedness Guide (Offline PDF)" CTA.
- **DisasterReady AI Copilot Integration:**
  - Custom Emergency Plan Builder:
    - *"Generate a 3-step action plan for flood preparedness in an apartment on the 1st floor."*

---

### Page 12: SOS & Emergency Support
- **Folder / File:** [`stitch-reference/screens/12-emergency-help/index.html`](file:///Users/devsmaccie/Desktop/anvathon/stitch-reference/screens/12-emergency-help/index.html)
- **Title / Role:** Emergency Helpline Directory, SOS Broadcast & Offline Toolkit
- **Core Components:**
  - 1-Tap Emergency Calling Blocks:
    - `National Emergency: 112`
    - `NDRF Control Room: 1078`
    - `State Disaster Management (SDMA): 1070`
    - `Ambulance: 108`
    - `Fire & Rescue: 101`
    - `Women Helpline: 1091`
  - High-decibel audible emergency whistle / siren simulator.
  - Screen strobe / flashlight rescue signaling tool.
  - Pre-formatted SOS SMS generator with GPS coordinates.
- **Interactive Buttons (36 buttons):**
  - Calling cards with direct `tel:` integration.
  - Audio whistle trigger.
  - Pre-filled SMS copy button.

---

### Page 13: Staff Sign-in
- **Folder / File:** [`stitch-reference/screens/13-staff-login/index.html`](file:///Users/devsmaccie/Desktop/anvathon/stitch-reference/screens/13-staff-login/index.html)
- **Title / Role:** Two-Step Staff & EOC Authority Authentication
- **Core Components:**
  - Step 1 Card: Official credentials (Government Employee ID / Username, Password).
  - Step 2 Card: 6-digit OTP verification box with 6 split digit inputs, resend countdown timer, and masked phone display (`+91 98*** **412`).
  - Security notices (NDMA / CERT-In compliance notice, unauthorized access warning).
  - Institutional seal and departmental login notice.
- **Interactive Buttons (32 buttons) & Inputs (12 inputs):**
  - Step 1: Username & Password inputs with password reveal toggle.
  - Step 2: 6 auto-advancing OTP digit boxes.
  - "Verify & Launch Authority EOC Terminal" CTA.

---

### Page 14: Authority Dashboard (EOC Command Center)
- **Folder / File:** [`stitch-reference/screens/14-authority-dashboard/index.html`](file:///Users/devsmaccie/Desktop/anvathon/stitch-reference/screens/14-authority-dashboard/index.html)
- **Title / Role:** Emergency Operations Center (EOC) District Command Terminal
- **Core Components:**
  - High-density operational telemetry:
    - Total Affected Population, Active High-Priority Incidents, Available Shelter Beds, Deployed Rescue Boats / Drone Units.
  - Multi-stage relief triage workflow (Stages 1 through 5):
    - `Stage 1: Incoming Citizen Requests Triage`
    - `Stage 2: Verification & Duplicate Deduction`
    - `Stage 3: Supply Inventory Allocation from Depots`
    - `Stage 4: Dispatch Vehicle Assignment & Driver Route Brief`
    - `Stage 5: Proof-of-Delivery & Geo-Tagged Confirmation`
  - Live District Geospatial Command Map with incident clustering, flood boundary polygons, and rescue team breadcrumbs.
  - Official Broadcast Bulletin Composer (Push alerts to Citizen Portal).
- **Interactive Buttons (58 buttons), Inputs (10) & Selects (10):**
  - Stage filter tabs, district dropdowns, bulk request status modifiers, inventory dispatch triggers, incident escalation buttons.
- **DisasterReady AI Copilot Integration:**
  - EOC Decision Support AI:
    - *"AI identifies 3 cluster requests in Ward 8 near breached bund. Suggest combining dispatch payload on NDRF Boat Unit 4."*

---

### Page 15: Simulation, Staff Tools, Settings & Transparency
- **Folder / File:** [`stitch-reference/screens/15-staff-tools-settings/index.html`](file:///Users/devsmaccie/Desktop/anvathon/stitch-reference/screens/15-staff-tools-settings/index.html)
- **Title / Role:** Staff Tools, Disaster Simulator, Audit Log & Public Transparency
- **Core Components:**
  - **Tab 1: Disaster Scenario Simulator:** Sliders to adjust rainfall rate (mm/hr), dam release discharge (cusecs), river cresting level, and wind speed; simulates road inundation in real-time.
  - **Tab 2: Staff Tools & Inventory Manager:** Central depot stock balances (food kits, clean water, medical packs, life vests), re-stock requisition triggers.
  - **Tab 3: System Settings & Role-Based Access Control:** EOC staff user roles, district boundary configurations, SMS gateway health check.
  - **Tab 4: Public Transparency & Audit Log:** Immutable ledger of all emergency relief disbursements, donations, supplier dispatches, and authority action logs.
- **Interactive Buttons (41 buttons), Inputs (15) & Selects (5):**
  - Simulation run / reset controls.
  - Inventory quantity incrementors.
  - Audit filter and date range selectors.
- **DisasterReady AI Copilot Integration:**
  - Predictive Simulation Explainer:
    - *"Simulated 85mm/hr rainfall will flood South Culvert within 38 minutes, affecting 4 relief routes."*
