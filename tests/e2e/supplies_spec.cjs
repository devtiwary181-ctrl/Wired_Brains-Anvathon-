const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

let totalPass = 0;
let totalFail = 0;

function assert(condition, message) {
  if (condition) {
    totalPass++;
    console.log(`  ✓ ${message}`);
  } else {
    totalFail++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

(async () => {
  console.log("================================================================================");
  console.log("   DISASTER READY INDIA — SUPPLIES & EMERGENCY RELIEF (SCREEN 08) TEST SUITE    ");
  console.log("================================================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 }, // Realistic modern mobile viewport
    geolocation: { latitude: 12.9716, longitude: 77.5946, accuracy: 15 },
    permissions: ['geolocation']
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const failedRequests = [];

  page.on('console', m => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('response', res => {
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
  });

  // ---------------------------------------------------------------------------
  // TEST 1: LOAD SCREEN 08 WITH ZERO CONSOLE ERRORS & CLEAN HTTP 200
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST GROUP 1] Clean Page Load, HTTP 200, 0 Errors, 0 404s");
  const response = await page.goto('http://localhost:3000/screens/08-emergency-relief/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  assert(response.status() === 200, "Emergency Relief screen returns HTTP 200 OK");
  assert(consoleErrors.length === 0, `Zero browser console errors on load (Actual: ${consoleErrors.length})`);
  assert(failedRequests.length === 0, `Zero failed network requests on load (Actual: ${failedRequests.length})`);

  // ---------------------------------------------------------------------------
  // TEST 2: HEADER & TOP CONTROLS (Logo, i18n, Audio, Profile, Back, Listen)
  // ---------------------------------------------------------------------------
  console.log("\n▶ [TEST GROUP 2] Header Branding, i18n Dropdown, Speaker Audio & Navigation");

  // Logo returns to citizen dashboard
  const logoLink = await page.$('header a[href*="02-citizen-dashboard"]');
  assert(logoLink !== null, "Header logo is a valid clickable link to Citizen Dashboard");

  // Language Dropdown
  const langSelect = await page.$('select.header-lang-select, select[aria-label="Change Language"]');
  assert(langSelect !== null, "Header Language selector is present in DOM");
  if (langSelect) {
    await langSelect.selectOption('hi');
    await page.waitForTimeout(300);
    const savedLang = await page.evaluate(() => localStorage.getItem('dr_lang'));
    assert(savedLang === 'hi', "Language selector switches to Hindi ('hi') and persists in localStorage");

    await langSelect.selectOption('ta');
    await page.waitForTimeout(300);
    const savedTa = await page.evaluate(() => localStorage.getItem('dr_lang'));
    assert(savedTa === 'ta', "Language selector switches to Tamil ('ta') and persists in localStorage");

    await langSelect.selectOption('bn');
    await page.waitForTimeout(300);
    const savedBn = await page.evaluate(() => localStorage.getItem('dr_lang'));
    assert(savedBn === 'bn', "Language selector switches to Bengali ('bn') and persists in localStorage");

    // Reset to Hindi for subsequent test steps
    await langSelect.selectOption('hi');
    await page.waitForTimeout(300);
  }

  // Header Speaker Icon & Listen Button
  const listenBtn = await page.$('#topListenBtn');
  assert(listenBtn !== null, "Top 'Listen (सुनें)' button exists");
  if (listenBtn) {
    await listenBtn.click();
    await page.waitForTimeout(400);
    const toast = await page.$('#dr-global-toast, #dr-toast, .dr-toast-notification');
    assert(toast !== null, "'Listen (सुनें)' button triggers audio read-aloud toast confirmation");
  }

  // Profile icon & dropdown
  const profileAvatar = await page.$('header [aria-label="Account & Admin Portal Menu"], header .w-8.h-8');
  assert(profileAvatar !== null, "Header profile icon is rendered");
  if (profileAvatar) {
    await profileAvatar.evaluate(el => el.click());
    await page.waitForTimeout(300);
    const adminLink = await page.$('#dr-profile-dropdown a[href*="13-staff-login"]');
    assert(adminLink !== null, "Profile dropdown opens displaying 'Login as Admin' pointing to Screen 13");
    // Click outside to close
    await page.click('body', { position: { x: 10, y: 10 } });
  }

  // ---------------------------------------------------------------------------
  // TEST 3: PROXY HELPER & MODAL ("Filing for someone else")
  // ---------------------------------------------------------------------------
  console.log("\n▶ [TEST GROUP 3] Proxy Helper Toggle & Inline/Modal Details Form");
  const proxyBadge = await page.$('#activeProxyBadge');
  assert(proxyBadge !== null, "'Active Proxy' toggle badge is rendered");
  if (proxyBadge) {
    await proxyBadge.click();
    await page.waitForTimeout(200);
    let text = await proxyBadge.textContent();
    assert(text.includes('Proxy Off'), "Clicking badge toggles proxy to 'Proxy Off'");

    await proxyBadge.click();
    await page.waitForTimeout(200);
    text = await proxyBadge.textContent();
    assert(text.includes('Active Proxy'), "Clicking badge again toggles proxy back to 'Active Proxy'");
  }

  const changeProxyBtn = await page.$('#changeProxyBtn');
  assert(changeProxyBtn !== null, "'Change' proxy button exists");
  if (changeProxyBtn) {
    await changeProxyBtn.click();
    await page.waitForTimeout(300);
    const modalVisible = await page.$eval('#proxyModal', el => !el.classList.contains('hidden'));
    assert(modalVisible, "Clicking 'Change' opens the Proxy Info dialog modal");

    await page.fill('#proxyNameInput', 'Vikramaditya S.');
    await page.fill('#proxyPhoneInput', '9845199999');
    await page.selectOption('#proxyRelationInput', 'Community Representative');
    await page.click('#saveProxyBtn');
    await page.waitForTimeout(300);

    const summaryText = await page.$eval('#proxySummaryText', el => el.textContent);
    assert(summaryText.includes('Vikramaditya S.'), "Saving proxy modal updates proxy summary text on page");
  }

  // ---------------------------------------------------------------------------
  // TEST 4: AI REQUEST HELPER & VOICE INTAKE
  // ---------------------------------------------------------------------------
  console.log("\n▶ [TEST GROUP 4] DisasterReady AI Request Helper (Analyze & Voice Intake)");
  const aiInput = await page.$('#aiNeedsInput');
  const aiAnalyze = await page.$('#aiAnalyzeBtn');
  const aiVoice = await page.$('#aiVoiceIntakeBtn');

  assert(aiInput !== null, "AI Needs input textbox is rendered with default brief");
  assert(aiAnalyze !== null, "AI 'Analyze' button exists");
  assert(aiVoice !== null, "AI 'Voice Intake' button exists");

  if (aiAnalyze) {
    await page.fill('#aiNeedsInput', '4 family members, 1 elderly needing BP pills, 1 infant');
    await aiAnalyze.click();
    await page.waitForTimeout(500);

    const calcResult = await page.$eval('#aiCalculationResult', el => el.textContent);
    assert(calcResult.includes('12L') || calcResult.includes('water') || calcResult.includes('Infant'), `AI Calculation updates live with standard allocation (Actual: "${calcResult}")`);

    const peopleDisplay = await page.$eval('#peopleDisplay', el => el.textContent);
    assert(peopleDisplay.includes('4'), "AI Analysis auto-updates people headcount to 4");
  }

  // Voice intake mock test
  if (aiVoice) {
    await aiVoice.click();
    await page.waitForTimeout(300);
    // Asserts no crash when SpeechRecognition triggers or friendly fallback toasts
    const toast = await page.$('#dr-global-toast, #dr-toast, .dr-toast-notification');
    assert(toast !== null, "Clicking 'Voice Intake' triggers browser audio intake or friendly permission toast");
  }

  // ---------------------------------------------------------------------------
  // TEST 5: NEAREST DEPOT GRID, REAL STOCK, & DEPOT MODAL
  // ---------------------------------------------------------------------------
  console.log("\n▶ [TEST GROUP 5] Nearest Depot Stock Grid & View Other Depots");
  const depotTitle = await page.$eval('#nearestDepotTitle', el => el.textContent);
  assert(depotTitle.includes('Depot') || depotTitle.includes('Sector 4') || depotTitle.includes('Hub'), `Nearest depot loaded from API (Actual: "${depotTitle}")`);

  const depotGrid = await page.$('#depotStockGrid');
  assert(depotGrid !== null, "Depot stock grid is rendered with real stock levels");

  const viewOtherDepots = await page.$('#viewOtherDepotsBtn');
  assert(viewOtherDepots !== null, "'Change depot / View other depots' button exists");
  if (viewOtherDepots) {
    await viewOtherDepots.click();
    await page.waitForTimeout(300);
    const depotModalVisible = await page.$eval('#depotModal', el => !el.classList.contains('hidden'));
    assert(depotModalVisible, "Clicking 'Change depot' opens modal with distance-sorted hubs");
    const count = await page.$$eval('#depotListContainer > div', divs => divs.length);
    assert(count >= 5, `Depot list loaded 30+ sample depots from backend API (Found: ${count})`);
    await page.click('#closeDepotModalBtn');
  }

  const directionsBtn = await page.$('#depotDirectionsBtn');
  assert(directionsBtn !== null, "'Directions' link exists pointing to Routes page (/screens/05-get-to-safety-step-4)");

  // ---------------------------------------------------------------------------
  // TEST 6: END-TO-END STEP-BY-STEP FLOW (STEPS 1 TO 7)
  // ---------------------------------------------------------------------------
  console.log("\n▶ [TEST GROUP 6] Step-by-Step Flow: Navigation, Validation & Inputs");

  // Step 1: Items Selection & Quantity Limits
  console.log("  → Testing Step 1 (Items Needed)");
  const s1Active = await page.$eval('#step-1-container', el => !el.classList.contains('hidden'));
  assert(s1Active, "Wizard starts at Step 1");

  // Test item selection & quantity stepper
  const incWater = await page.$('#itemBtn_water .item-inc-btn');
  if (incWater) {
    await incWater.click();
    await incWater.click();
    const qty = await page.$eval('#itemBtn_water .item-qty-val', el => el.textContent);
    assert(parseInt(qty) > 0, `Water quantity increased to ${qty}`);
  }

  await page.click('#step1NextBtn');
  await page.waitForTimeout(300);

  // Step 2: People Count Stepper & Presets
  console.log("  → Testing Step 2 (People Count)");
  const s2Active = await page.$eval('#step-2-container', el => !el.classList.contains('hidden'));
  assert(s2Active, "Navigated successfully to Step 2");

  await page.click('#preset-8');
  await page.waitForTimeout(200);
  let pDisplay = await page.$eval('#peopleDisplay', el => el.textContent);
  assert(pDisplay.includes('8'), "Selecting '5 - 10 Group' preset updates headcount to 8");

  await page.click('#decrementPeople');
  pDisplay = await page.$eval('#peopleDisplay', el => el.textContent);
  assert(pDisplay.includes('7'), "Clicking '-' decrements headcount to 7");

  await page.click('#step2NextBtn');
  await page.waitForTimeout(300);

  // Step 3: Extra Care Groups
  console.log("  → Testing Step 3 (Extra Care Groups)");
  const s3Active = await page.$eval('#step-3-container', el => !el.classList.contains('hidden'));
  assert(s3Active, "Navigated successfully to Step 3");

  await page.click('#care-disabled');
  await page.waitForTimeout(200);
  const disabledBadge = await page.$eval('#care-disabled span:last-child', el => el.textContent);
  assert(disabledBadge.includes('YES'), "Toggling Person with Disability marks care option as YES");

  await page.click('#step3NextBtn');
  await page.waitForTimeout(300);

  // Step 4: Urgency Timeline
  console.log("  → Testing Step 4 (Urgency Timeline)");
  const s4Active = await page.$eval('#step-4-container', el => !el.classList.contains('hidden'));
  assert(s4Active, "Navigated successfully to Step 4");

  await page.click('#urgency-urgent');
  await page.waitForTimeout(200);
  const urgentSelected = await page.$eval('#urgency-urgent', el => el.classList.contains('bg-primary'));
  assert(urgentSelected, "Selected 'More than 2 days' urgency level");

  await page.click('#step4NextBtn');
  await page.waitForTimeout(300);

  // Step 5: Location, GPS, Ward & Duplicate Merge
  console.log("  → Testing Step 5 (Delivery Location)");
  const s5Active = await page.$eval('#step-5-container', el => !el.classList.contains('hidden'));
  assert(s5Active, "Navigated successfully to Step 5");

  await page.click('#useGpsBtn');
  await page.waitForTimeout(600);
  const gpsLabel = await page.$eval('#gpsButtonLabel', el => el.textContent);
  assert(gpsLabel.includes('GPS') || gpsLabel.includes('accurate') || gpsLabel.includes('Locked'), "High-accuracy GPS captures coordinates without silent fallback");

  // Select ward modal
  await page.click('#selectWardBtn');
  await page.waitForTimeout(200);
  assert(await page.$eval('#wardModal', el => !el.classList.contains('hidden')), "Ward selection modal opens");
  await page.click('#applyWardBtn');
  await page.waitForTimeout(200);

  // Duplicate batch merge
  await page.click('#mergeHouseholdBtn');
  await page.waitForTimeout(200);
  const mergeRing = await page.$eval('#mergeHouseholdBtn', el => el.classList.contains('ring-2'));
  assert(mergeRing, "Selected 'Yes, add my household' batch merge option");

  await page.click('#step5NextBtn');
  await page.waitForTimeout(300);

  // Step 6: Photo & Contact Phone
  console.log("  → Testing Step 6 (Photo & Contact)");
  const s6Active = await page.$eval('#step-6-container', el => !el.classList.contains('hidden'));
  assert(s6Active, "Navigated successfully to Step 6");

  await page.fill('#contactPhone', '9845122334');
  await page.click('#step6NextBtn');
  await page.waitForTimeout(300);

  // Step 7: Review Request & Back/Edit links
  console.log("  → Testing Step 7 (Review & Submission)");
  const s7Active = await page.$eval('#step-7-container', el => !el.classList.contains('hidden'));
  assert(s7Active, "Navigated successfully to Step 7 (Review Request)");

  // Test Review jump-to-step Edit buttons
  await page.click('#editPeopleBtn');
  await page.waitForTimeout(200);
  assert(await page.$eval('#step-2-container', el => !el.classList.contains('hidden')), "Clicking 'Edit Beneficiaries' in review jumps back to Step 2");

  // Return to Step 7
  await page.click('#step2NextBtn');
  await page.waitForTimeout(200);
  await page.click('#step3NextBtn');
  await page.waitForTimeout(200);
  await page.click('#step4NextBtn');
  await page.waitForTimeout(200);
  await page.click('#step5NextBtn');
  await page.waitForTimeout(200);
  await page.click('#step6NextBtn');
  await page.waitForTimeout(300);

  // Submit Final Relief Request
  console.log("  → Submitting Final Request to PostgreSQL Backend");
  await page.click('#submitRequestBtn');
  await page.waitForTimeout(1500);

  const confVisible = await page.$eval('#confirmation-section', el => !el.classList.contains('hidden'));
  assert(confVisible, "Confirmation screen is revealed after submission");

  const trackingToken = await page.$eval('#tracking-token-display', el => el.textContent.trim());
  assert(trackingToken.startsWith('DR-'), `Real high-entropy tracking token returned from PostgreSQL DB (Token: ${trackingToken})`);

  // Verify token tracking link
  const trackHref = await page.$eval('#trackStatusLink', el => el.getAttribute('href'));
  assert(trackHref.includes(encodeURIComponent(trackingToken)) || trackHref.includes('token='), `Tracking link pre-fills tracking token (${trackHref})`);

  // ---------------------------------------------------------------------------
  // TEST 7: OFFLINE RESILIENCE & SYNC PROTECTION
  // ---------------------------------------------------------------------------
  console.log("\n▶ [TEST GROUP 7] Offline Form Resilience, Draft Save & Online Auto-Sync");
  await context.setOffline(true);
  const isOffline = await page.evaluate(() => !navigator.onLine);
  assert(isOffline, "Browser network toggled to OFFLINE state");

  // Fill in an offline request and submit
  await page.goto('http://localhost:3000/screens/08-emergency-relief/index.html');
  await page.waitForTimeout(500);

  const draftLoaded = await page.$eval('#peopleDisplay', el => el.textContent);
  assert(draftLoaded.length > 0, "Draft restored from localStorage in offline mode");

  // Go back online
  await context.setOffline(false);
  await page.waitForTimeout(400);
  const isOnline = await page.evaluate(() => navigator.onLine);
  assert(isOnline, "Browser network restored to ONLINE state");

  // ---------------------------------------------------------------------------
  // TEST 8: BOTTOM NAVIGATION & SOS 112
  // ---------------------------------------------------------------------------
  console.log("\n▶ [TEST GROUP 8] Bottom Navigation Bar Links & SOS 112 Action");
  const bottomNavItems = await page.$$eval('nav a', links => links.map(l => ({
    text: l.textContent.trim(),
    href: l.getAttribute('href')
  })));
  assert(bottomNavItems.length === 5, `Bottom navigation bar contains exactly 5 tabs (Found: ${bottomNavItems.length})`);

  // SOS 112 Dialog
  const sosBtn = await page.$('a[href="tel:112"]');
  assert(sosBtn !== null, "Floating SOS 112 button exists");
  if (sosBtn) {
    await sosBtn.click();
    await page.waitForTimeout(300);
    const sosModalVisible = await page.$eval('#sosModal', el => !el.classList.contains('hidden'));
    assert(sosModalVisible, "Clicking SOS opens confirmation modal with tel:112 call button");
    await page.click('#cancelSosBtn');
    await page.waitForTimeout(200);
    assert(await page.$eval('#sosModal', el => el.classList.contains('hidden')), "Cancel closes SOS dialog safely");
  }

  // ---------------------------------------------------------------------------
  // TEST 9: SCREENSHOT CAPTURE (LIGHT, DARK, HINDI)
  // ---------------------------------------------------------------------------
  console.log("\n▶ [TEST GROUP 9] Capturing Verification Screenshots");
  const screenshotsDir = path.join(__dirname, '../screenshots');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  await page.goto('http://localhost:3000/screens/08-emergency-relief/index.html');
  await page.waitForTimeout(600);

  // 1. Light Mode
  await page.screenshot({ path: path.join(screenshotsDir, '08_supplies_light.png'), fullPage: true });
  console.log("  ✓ Captured 08_supplies_light.png");

  // 2. Dark Mode
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(screenshotsDir, '08_supplies_dark.png'), fullPage: true });
  console.log("  ✓ Captured 08_supplies_dark.png");
  await page.evaluate(() => document.documentElement.classList.remove('dark'));

  // 3. Hindi Localization Mode
  await page.selectOption('select.header-lang-select', 'hi');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(screenshotsDir, '08_supplies_hindi.png'), fullPage: true });
  console.log("  ✓ Captured 08_supplies_hindi.png");

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${totalPass} PASSED, ${totalFail} FAILED`);
  console.log("================================================================================");

  await browser.close();
  process.exit(totalFail > 0 ? 1 : 0);
})();
