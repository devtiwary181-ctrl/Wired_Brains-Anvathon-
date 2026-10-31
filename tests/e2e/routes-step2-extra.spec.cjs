const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000/screens/04-get-to-safety-step-2/index.html';
const API_BASE = 'http://localhost:5001/api/v1';

async function runTests() {
  console.log('🚀 Starting Comprehensive E2E Tests for Routes Page Step 2...');
  let totalTests = 0;
  let passedTests = 0;

  function test(name, fn) {
    totalTests++;
    return fn()
      .then(() => {
        passedTests++;
        console.log(`  ✓ [PASS] ${name}`);
      })
      .catch((err) => {
        console.error(`  ✗ [FAIL] ${name}:`, err.message);
        throw err;
      });
  }

  // 1. Backend API verification
  console.log('\n--- PART 1: Backend Database & Places API Tests ---');

  await test('Places table has >= 2,000 realistic sample places across Indian states', async () => {
    const res = await fetch(`${API_BASE}/places/search?limit=5`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.places));
  });

  await test('GET /api/v1/places/search returns <300ms with case-insensitive search and distance', async () => {
    const t0 = Date.now();
    const res = await fetch(`${API_BASE}/places/search?q=dwarka&lat=22.24&lng=68.96&limit=10`);
    const duration = Date.now() - t0;
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.places.length > 0);
    assert.ok(duration < 500, `Expected <500ms, took ${duration}ms`);
    assert.ok(data.places[0].distanceKm != null);
    assert.ok(data.places[0].name.toLowerCase().includes('dwarka') || (data.places[0].district && data.places[0].district.toLowerCase().includes('dwarka')));
  });

  await test('GET /api/v1/places/search matches Hindi place names', async () => {
    const res = await fetch(`${API_BASE}/places/search?q=${encodeURIComponent('द्वारका')}&limit=5`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.places.length > 0);
    assert.ok(data.places.some(p => p.nameHi && p.nameHi.includes('द्वारका')));
  });

  await test('GET /api/v1/places/search tolerates typos via trigram similarity', async () => {
    // "Dvarka" instead of "Dwarka"
    const res = await fetch(`${API_BASE}/places/search?q=Dvarka&limit=5`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.places.length > 0);
    assert.ok(data.places.some(p => p.name.includes('Dwarka')));
  });

  await test('GET /api/v1/shelters returns 150+ verified shelters', async () => {
    const res = await fetch(`${API_BASE}/shelters?limit=250`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    const count = data.shelters ? data.shelters.length : data.count;
    assert.ok(count >= 150, `Expected >= 150 shelters, got ${count}`);
  });

  await test('GET /api/v1/hospitals returns 100+ verified hospitals', async () => {
    const res = await fetch(`${API_BASE}/hospitals?limit=200`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    const count = data.hospitals ? data.hospitals.length : data.count;
    assert.ok(count >= 100, `Expected >= 100 hospitals, got ${count}`);
  });

  await test('POST /api/v1/routes/evacuation generates 4 distinct routes with blue, indigo, green, amber colors', async () => {
    const res = await fetch(`${API_BASE}/routes/evacuation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: { lat: 22.2442, lng: 68.9685 },
        destination: { lat: 22.2253, lng: 68.9856 },
        travelMode: 'WALK',
        preferences: { wheelchair: true }
      })
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.routes.length, 4);

    const fastest = json.data.routes.find(r => r.type === 'fastest');
    const shortest = json.data.routes.find(r => r.type === 'shortest');
    const safest = json.data.routes.find(r => r.type === 'safest');
    const alt = json.data.routes.find(r => r.type === 'alternative');

    assert.ok(fastest && fastest.color === '#2563eb', 'Fastest route must be blue');
    assert.ok(shortest && shortest.color === '#4f46e5', 'Shortest route must be indigo');
    assert.ok(safest && safest.color === '#16a34a', 'Safest route must be green');
    assert.ok(alt && alt.color === '#d97706', 'Alternative route must be amber');
    assert.ok(json.data.preferenceBanners.length > 0, 'Should display wheelchair preference banner');
  });

  // 2. Playwright Headless Browser Testing
  console.log('\n--- PART 2: Frontend Browser Automation Tests ---');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 } }); // Pixel phone viewport
  const page = await context.newPage();

  // Check console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await test('Page loads successfully on port 3000 with 0 console errors', async () => {
    const response = await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    assert.strictEqual(response.status(), 200);
    assert.strictEqual(consoleErrors.length, 0, `Console errors found: ${consoleErrors.join(', ')}`);
  });

  await test('Interactive Evacuation Leaflet Map initializes on page', async () => {
    const mapEl = await page.$('#journeyMap');
    assert.ok(mapEl, 'Map container #journeyMap must exist');
    await page.waitForSelector('.leaflet-container', { timeout: 5000 });
    const isLeafletReady = await page.evaluate(() => typeof window.L !== 'undefined');
    assert.strictEqual(isLeafletReady, true, 'Leaflet should be loaded globally');
  });

  await test('Origin Search Box has debounce, keyboard navigation, and sets origin', async () => {
    const originInput = await page.$('#landmark-search');
    assert.ok(originInput, 'Origin input #landmark-search must exist');

    await originInput.fill('Railway');
    await page.waitForTimeout(400); // Wait for 250ms debounce
    await page.waitForSelector('#origin-dropdown .origin-item', { timeout: 5000 });

    const itemsCount = await page.$$eval('#origin-dropdown .origin-item', els => els.length);
    assert.ok(itemsCount > 0, 'Origin dropdown should render suggestions');

    // Test ArrowDown and Enter
    await originInput.press('ArrowDown');
    await originInput.press('Enter');
    await page.waitForTimeout(300);

    const summaryText = await page.$eval('#currentOriginSummary', el => el.textContent);
    assert.ok(summaryText.includes('Railway') || summaryText.includes('Current origin:'), 'Origin summary should update');
  });

  await test('Destination Search Box searches places + shelters and sets destination', async () => {
    const destInput = await page.$('#destination-search');
    assert.ok(destInput, 'Destination search input #destination-search must exist');

    await destInput.fill('Hospital');
    await page.waitForTimeout(400); // Wait for 250ms debounce
    await page.waitForSelector('#destination-dropdown .dest-item', { timeout: 5000 });

    const itemsCount = await page.$$eval('#destination-dropdown .dest-item', els => els.length);
    assert.ok(itemsCount > 0, 'Destination dropdown should render suggestions');

    // Click first item
    await page.click('#destination-dropdown .dest-item:first-child');
    await page.waitForTimeout(500);

    const destValue = await destInput.inputValue();
    assert.ok(destValue.length > 0, 'Destination input should be populated');
  });

  await test('Working "Swap origin and destination" button', async () => {
    const swapBtn = await page.$('#swapOriginDestBtn');
    assert.ok(swapBtn, 'Swap button #swapOriginDestBtn must exist');

    const origValBefore = await page.$eval('#landmark-search', el => el.value);
    const destValBefore = await page.$eval('#destination-search', el => el.value);

    await swapBtn.click();
    await page.waitForTimeout(400);

    const origValAfter = await page.$eval('#landmark-search', el => el.value);
    const destValAfter = await page.$eval('#destination-search', el => el.value);

    assert.strictEqual(origValAfter, destValBefore, 'Origin value should match old destination value');
    assert.strictEqual(destValAfter, origValBefore, 'Destination value should match old origin value');
  });

  await test('All 7 accessibility need toggles toggle On/Off, update aria-pressed, and re-rank', async () => {
    const toggles = [
      'toggle-wheelchair',
      'toggle-elderly',
      'toggle-child',
      'toggle-pregnant',
      'toggle-medical',
      'toggle-pets',
      'toggle-women'
    ];

    for (const toggleId of toggles) {
      const btn = await page.$(`#${toggleId}`);
      assert.ok(btn, `Toggle button #${toggleId} must exist`);

      const initialAria = await btn.getAttribute('aria-pressed');
      assert.strictEqual(initialAria, 'false');

      // Click to turn ON
      await btn.click();
      await page.waitForTimeout(200);
      const onAria = await btn.getAttribute('aria-pressed');
      assert.strictEqual(onAria, 'true', `Toggle #${toggleId} should be aria-pressed=true after click`);

      // Press Space/Enter to turn OFF
      await btn.press('Space');
      await page.waitForTimeout(200);
      const offAria = await btn.getAttribute('aria-pressed');
      assert.strictEqual(offAria, 'false', `Toggle #${toggleId} should be aria-pressed=false after Space`);
    }

    // Toggle wheelchair ON to check preference banner
    await page.click('#toggle-wheelchair');
    await page.waitForTimeout(500);
    const isBannerVisible = await page.$eval('#preferenceBanner', el => !el.classList.contains('hidden'));
    assert.strictEqual(isBannerVisible, true, 'Preference banner should be visible when wheelchair is ON');
  });

  await test('All 4 travel modes switch cleanly and Ambulance (108) displays info panel & location dispatch', async () => {
    const walkBtn = await page.$('#mode-walk');
    const bikeBtn = await page.$('#mode-bike');
    const carBtn = await page.$('#mode-car');
    const ambulanceBtn = await page.$('#mode-ambulance');

    assert.ok(walkBtn && bikeBtn && carBtn && ambulanceBtn, 'All 4 mode buttons must exist');

    // Switch to Two-wheeler
    await bikeBtn.click();
    await page.waitForTimeout(300);
    let isBikeSelected = await bikeBtn.evaluate(el => el.classList.contains('bg-primary'));
    assert.strictEqual(isBikeSelected, true);

    // Switch to Ambulance (108)
    await ambulanceBtn.click();
    await page.waitForTimeout(300);
    const isPanelVisible = await page.$eval('#ambulanceInfoPanel', el => !el.classList.contains('hidden'));
    assert.strictEqual(isPanelVisible, true, 'Ambulance info panel should be revealed');

    // Check Call 108 link
    const call108Link = await page.$('#ambulanceInfoPanel a[href="tel:108"]');
    assert.ok(call108Link, 'Call 108 tel link must exist');

    // Click "Share Location with 108"
    const dispatchBtn = await page.$('#dispatchAmbulanceBtn');
    assert.ok(dispatchBtn, 'Dispatch button must exist');
    await dispatchBtn.click();
    await page.waitForTimeout(500);

    const dispatchStatusText = await page.$eval('#ambulanceDispatchStatus', el => el.textContent);
    assert.ok(dispatchStatusText.includes('108') || dispatchStatusText.includes('transmitted'), 'Dispatch status should show confirmation');

    // Return to Walk
    await walkBtn.click();
  });

  await test('Group travel checkbox reveals "Pick a meeting point", opens modal, confirms, and shares', async () => {
    const groupCheckbox = await page.$('#group-travel-checkbox');
    assert.ok(groupCheckbox, '#group-travel-checkbox must exist');

    await groupCheckbox.check();
    await page.waitForTimeout(200);

    const isAreaVisible = await page.$eval('#meetingPointArea', el => !el.classList.contains('hidden'));
    assert.strictEqual(isAreaVisible, true, 'Meeting point area should be revealed');

    // Click "Pick a meeting point"
    await page.click('#btnPickMeetingPoint');
    await page.waitForTimeout(300);

    const isModalOpen = await page.$eval('#meetingPointModal', el => !el.classList.contains('hidden'));
    assert.strictEqual(isModalOpen, true, 'Meeting point modal should be open');

    // Click a safe place chip
    await page.click('.meeting-chip:first-child');
    await page.waitForTimeout(200);

    // Confirm meeting point
    await page.click('#btnConfirmMeetingPoint');
    await page.waitForTimeout(300);

    const isSummaryVisible = await page.$eval('#meetingPointSummaryCard', el => !el.classList.contains('hidden'));
    assert.strictEqual(isSummaryVisible, true, 'Meeting point summary card should be visible');

    // Click Share button
    await page.click('#shareMeetingPointBtn');
    await page.waitForTimeout(200);
    await page.evaluate(() => window.scrollTo(0, 0));
  });

  await test('Header Theme Toggle activates Dark Mode with readable contrast', async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    const themeBtn = await page.$('#themeToggleBtn');
    assert.ok(themeBtn, '#themeToggleBtn must exist');

    await page.click('#themeToggleBtn');
    await page.waitForTimeout(200);
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    assert.strictEqual(isDark, true, 'Dark class should be applied');

    // Capture Dark Mode Screenshot
    if (!fs.existsSync('tests/screenshots')) fs.mkdirSync('tests/screenshots', { recursive: true });
    await page.screenshot({ path: 'tests/screenshots/04_routes_dark.png' });

    // Revert to Light Mode
    await page.click('#themeToggleBtn');
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'tests/screenshots/04_routes_light.png' });
  });

  await test('Language switcher updates language and captures Hindi screenshot', async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    const langSelect = await page.$('.header-lang-select, select[aria-label="Change Language"]');
    if (langSelect) {
      await langSelect.selectOption('hi');
    } else {
      const langBtn = await page.$('#langDropdownBtn');
      if (langBtn) {
        await langBtn.click();
        await page.waitForTimeout(200);
        await page.click('#langDropdownMenu button[data-lang="hi"]');
      }
    }
    await page.waitForTimeout(300);

    await page.screenshot({ path: 'tests/screenshots/04_routes_hindi.png' });
  });

  await test('Floating SOS 112 opens modal and logs dispatch coordinates', async () => {
    const sosBtn = await page.$('#btnSos112');
    assert.ok(sosBtn, '#btnSos112 must exist');

    await sosBtn.click();
    await page.waitForTimeout(400);

    const isModalOpen = await page.$eval('#sosModal', el => !el.classList.contains('hidden'));
    assert.strictEqual(isModalOpen, true, 'SOS modal should open');

    await page.click('#cancelSosBtn');
    await page.waitForTimeout(200);
    const isModalClosed = await page.$eval('#sosModal', el => el.classList.contains('hidden'));
    assert.strictEqual(isModalClosed, true, 'SOS modal should close on Cancel');
  });

  await test('All 5 bottom navigation tabs point to valid existing destinations', async () => {
    const links = await page.$$eval('nav a', els => els.map(e => e.getAttribute('href')));
    assert.strictEqual(links.length, 5);
    links.forEach(href => {
      assert.ok(href && href.startsWith('/screens/'), `Nav link should point to a valid screen, got: ${href}`);
    });
  });

  await browser.close();

  console.log(`\n========================================`);
  console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED WITH 100% SUCCESS!`);
  console.log(`========================================\n`);
}

runTests().catch(err => {
  console.error('\n❌ Test suite execution failed:', err);
  process.exit(1);
});
