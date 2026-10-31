# SUPPLIES & EMERGENCY RELIEF AUDIT (Screen 08 & 7-Step Relief Flow)

| Page / Section | Element | Expected Behaviour | Destination | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Header** | Logo & Title | Return to citizen dashboard | `/screens/02-citizen-dashboard/index.html` | WORKING |
| **Header** | Language Dropdown | Translates entire page across 10 Indian languages & persists in localStorage | In-page DOM / localStorage | WORKING |
| **Header** | Speaker Icon | Speaks screen content in active language using Web Speech or `/api/v1/tts` fallback | Audio playback | WORKING |
| **Header** | Profile Avatar & Dropdown | Shows "Login as Admin" (and officer profile if authenticated) | `/screens/13-staff-login/index.html` | WORKING |
| **Header** | Live Status Badge | Shows active incident and last updated time | Information badge | WORKING |
| **Header** | "Ask For Supplies" link/title | Current screen breadcrumb | Active screen | WORKING |
| **Wizard Top** | "Back (वापस)" button | Navigates to previous step preserving all inputs; on Step 1 goes to dashboard | Step $X-1$ or `/screens/02-citizen-dashboard/index.html` | WORKING |
| **Wizard Top** | "Listen (सुनें)" button | Reads the current step directions and form fields aloud | Audio playback toggle | WORKING |
| **Wizard Top** | Progress Bar & Step Tracker | Displays current step (e.g. Step 2 of 7), percentage, and title | Visual state indicator | WORKING |
| **Wizard Top** | "Auto-saved offline" Badge | Shows live save state ("Saving...", "Auto-saved offline") with IndexedDB/localStorage persistence | Status indicator | WORKING |
| **Proxy Helper** | "Active Proxy" Badge | Toggles proxy status on/off | State toggle | WORKING |
| **Proxy Helper** | "Change" Button | Opens Proxy Info modal to edit proxy filer name, phone (+91 validation), relation | Proxy Modal `#proxyModal` | WORKING |
| **AI Request Helper** | "Voice Intake" Button | Uses Web Speech API SpeechRecognition in current language, transcribes speech into needs input | Browser microphone / Needs input | WORKING |
| **AI Request Helper** | Needs Textbox | Accepts natural language disaster needs text | Form input | WORKING |
| **AI Request Helper** | "Analyze" Button | Sends text to `/api/v1/supplies/analyze` (or local rule-based fallback); auto-fills headcount, care groups, items | Live calculation & fields auto-fill | WORKING |
| **AI Request Helper** | AI Calculation Box | Displays standard NDMA emergency relief quota calculation | Dynamic calculation box | WORKING |
| **Nearest Depot** | Depot Title & Distance | Displays real nearest depot loaded from `/api/v1/depots?lat=&lng=` with live distance & verified time | Backend API data | WORKING |
| **Nearest Depot** | Stock Badges Grid | Displays real stock levels for Drinking Water, Food Rations, Baby Milk, Tents with available/low-stock/diverted tags | Dynamic depot inventory | WORKING |
| **Nearest Depot** | "View other depots" Button | Opens Depot Selector modal with depots sorted by distance | Depot Modal `#depotModal` | WORKING |
| **Nearest Depot** | "Directions" Button | Opens Routes page preselecting the depot coordinates | `/screens/05-get-to-safety-step-4/index.html` | WORKING |
| **Step 1: Items** | Drinking Water Card | Selects item, increments count, checks stock availability | Item selection state | WORKING |
| **Step 1: Items** | Food Rations Card | Selects item, increments count, checks stock availability | Item selection state | WORKING |
| **Step 1: Items** | Medicines & Kit Card | Selects item, increments count, checks stock availability | Item selection state | WORKING |
| **Step 1: Items** | Blankets & Wear Card | Selects item, increments count, checks stock availability | Item selection state | WORKING |
| **Step 1: Items** | Emergency Tents Card | Selects item, warns if out-of-stock/diverted | Item selection state | WORKING |
| **Step 1: Items** | Baby Food/Milk Card | Selects item, checks low stock alert | Item selection state | WORKING |
| **Step 1: Items** | Sanitation Kit Card | Selects item, increments count | Item selection state | WORKING |
| **Step 1: Items** | Other Needs Input & Mic | Accepts custom items and voice input | Form input & speech | WORKING |
| **Step 1: Items** | Next / Continue Button | Validates at least 1 item selected, advances to Step 2 | Step 2 (People Count) | WORKING |
| **Step 2: People Count** | Decrease People (-) | Decrements headcount (min 1) | Stepper state | WORKING |
| **Step 2: People Count** | Increase People (+) | Increments headcount (max 50) | Stepper state | WORKING |
| **Step 2: People Count** | Preset "1 Person (अकेले)" | Sets headcount to 1 | Preset shortcut | WORKING |
| **Step 2: People Count** | Preset "2 - 4 Family (परिवार)" | Sets headcount to 4 | Preset shortcut | WORKING |
| **Step 2: People Count** | Preset "5 - 10 Group (समूह)" | Sets headcount to 8 | Preset shortcut | WORKING |
| **Step 2: People Count** | Preset "11+ Community (बस्ती)" | Sets headcount to 15 | Preset shortcut | WORKING |
| **Step 2: People Count** | Back to Step 1 Button | Returns to Step 1 preserving entered values | Step 1 (Items) | WORKING |
| **Step 2: People Count** | Next to Step 3 Button | Validates headcount $\ge 1$, advances to Step 3 | Step 3 (Care Groups) | WORKING |
| **Step 3: Extra Care** | Infant / Newborn Option | Toggles infant care group (updates baby food suggestion) | Care toggle YES/NO | WORKING |
| **Step 3: Extra Care** | Elderly Person Option | Toggles senior citizen group (updates medicine suggestion) | Care toggle YES/NO | WORKING |
| **Step 3: Extra Care** | Pregnant Woman Option | Toggles maternal care priority | Care toggle YES/NO | WORKING |
| **Step 3: Extra Care** | Person with Disability Option | Toggles accessibility priority flag | Care toggle YES/NO | WORKING |
| **Step 3: Extra Care** | Critical Patient Option | Toggles critical bedridden priority flag | Care toggle YES/NO | WORKING |
| **Step 3: Extra Care** | Back to Step 2 Button | Returns to Step 2 | Step 2 (People Count) | WORKING |
| **Step 3: Extra Care** | Next to Step 4 Button | Advances to Step 4 | Step 4 (Urgency) | WORKING |
| **Step 4: Urgency** | "< 6 hours" Option | Selects STANDARD urgency level | Radio selection | WORKING |
| **Step 4: Urgency** | "6 to 24 hours" Option | Selects HIGH urgency level | Radio selection | WORKING |
| **Step 4: Urgency** | "1 to 2 days" Option | Selects HIGH urgency level | Radio selection | WORKING |
| **Step 4: Urgency** | "> 2 days" Option | Selects CRITICAL_LIFE_SAFETY urgency level | Radio selection | WORKING |
| **Step 4: Urgency** | Back to Step 3 Button | Returns to Step 3 | Step 3 (Care Groups) | WORKING |
| **Step 4: Urgency** | Next to Step 5 Button | Advances to Step 5 | Step 5 (Location) | WORKING |
| **Step 5: Location** | "Use my GPS location" | Captures high-accuracy geolocation ($\le 50$m), reverse-geocodes address | Geolocation API | WORKING |
| **Step 5: Location** | "Select Ward/Area" | Opens Ward / District selection modal | Ward Modal `#wardModal` | WORKING |
| **Step 5: Location** | "Tap on Map" | Opens interactive map picker to tap pin | Map Picker Modal `#mapPickerModal` | WORKING |
| **Step 5: Location** | Landmark Textbox & Mic | Accepts text or voice landmark description | Form input & speech | WORKING |
| **Step 5: Location** | Duplicate Batch Callout | "Yes, add my household" merges batch; "No, new request" creates separate | Dispatch option | WORKING |
| **Step 5: Location** | Back to Step 4 Button | Returns to Step 4 | Step 4 (Urgency) | WORKING |
| **Step 5: Location** | Next to Step 6 Button | Validates coordinates exist, advances to Step 6 | Step 6 (Photo & Contact) | WORKING |
| **Step 6: Photo & Contact**| "Upload" Photo Button | Opens native camera or image file picker | Native file input | WORKING |
| **Step 6: Photo & Contact**| "Skip" Photo Button | Proceeds without photo | Step state | WORKING |
| **Step 6: Photo & Contact**| Contact Phone (+91) | Validates 10-digit Indian phone number | Tel input validation | WORKING |
| **Step 6: Photo & Contact**| Back to Step 5 Button | Returns to Step 5 | Step 5 (Location) | WORKING |
| **Step 6: Photo & Contact**| Next to Step 7 Button | Validates phone number, advances to Step 7 | Step 7 (Review) | WORKING |
| **Step 7: Review** | Edit Supplies Button | Jumps back to Step 1 to modify items | Step 1 (Items) | WORKING |
| **Step 7: Review** | Edit People Button | Jumps back to Step 2 to modify headcount | Step 2 (People Count) | WORKING |
| **Step 7: Review** | Edit Urgency Button | Jumps back to Step 4 to modify urgency | Step 4 (Urgency) | WORKING |
| **Step 7: Review** | Edit Location Button | Jumps back to Step 5 to modify address/GPS | Step 5 (Location) | WORKING |
| **Step 7: Review** | Edit Contact Button | Jumps back to Step 6 to modify phone | Step 6 (Photo & Contact) | WORKING |
| **Step 7: Review** | "Send Relief Request" CTA | Submits request to `POST /api/v1/relief-requests` or queues offline; displays Step 7 Confirmation | Backend API / Offline Queue | WORKING |
| **Confirmation** | Tracking Reference Token | Displays high-entropy tracking code (`DR-...`) | Visual code card | WORKING |
| **Confirmation** | "Copy" Token Button | Copies tracking token to system clipboard with toast | Clipboard API | WORKING |
| **Confirmation** | "Listen" Token Button | Reads tracking token aloud | Audio playback | WORKING |
| **Confirmation** | "Share via WhatsApp" | Deep links to WhatsApp with formatted emergency reference message | WhatsApp web / app link | WORKING |
| **Confirmation** | "Share by SMS" | Deep links to `sms:?body=...` | Native SMS URI | WORKING |
| **Confirmation** | "Save as Card Image" / PDF | Generates card print / PDF download | Print / Canvas generator | WORKING |
| **Confirmation** | "Track Status →" Link | Navigates to Screen 09 with pre-filled tracking token | `/screens/09-relief-tracking/index.html?token=...` | WORKING |
| **Confirmation** | "Back to Dashboard" | Returns to citizen dashboard | `/screens/02-citizen-dashboard/index.html` | WORKING |
| **Bottom Navigation**| Dashboard Tab | Navigates to Citizen Dashboard | `/screens/02-citizen-dashboard/index.html` | WORKING |
| **Bottom Navigation**| Shelters Tab | Navigates to Safe Places / Shelters | `/screens/07-safe-places/index.html` | WORKING |
| **Bottom Navigation**| Supplies Tab | Active page highlight | Active screen | WORKING |
| **Bottom Navigation**| Routes Tab | Navigates to Evacuation Routes | `/screens/05-get-to-safety-step-4/index.html` | WORKING |
| **Bottom Navigation**| Helplines Tab | Navigates to Emergency Helplines Directory | `/screens/12-emergency-help/index.html` | WORKING |
| **Floating Action** | SOS 112 Button | Opens SOS modal with `tel:112` call button and logs location to `POST /api/v1/sos` | SOS Confirmation Modal | WORKING |

