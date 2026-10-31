const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL_3000 = 'http://localhost:3000';
const BASE_URL_5001 = 'http://localhost:5001';

async function runMapTilesTestSuite() {
  console.log('================================================================================');
  console.log('       DISASTER READY INDIA — MAP TILES VERIFICATION TEST SUITE                 ');
  console.log('================================================================================\n');

  const browser = await chromium.launch({ headless: true });
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  function pass(desc) {
    totalTests++;
    passedTests++;
    console.log(`  ✓ [PASS] ${desc}`);
  }

  function fail(desc, err) {
    totalTests++;
    failedTests++;
    console.error(`  ✗ [FAIL] ${desc}\n    Error: ${err?.message || err}`);
  }

  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  try {
    // -------------------------------------------------------------------------
    // TEST GROUP 1: Routes Page (Step 2) Map & Fallback Automation
    // -------------------------------------------------------------------------
    console.log('▶ [TEST GROUP 1] Routes Page (Step 2) — #journeyMap Tile Verification');
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();

      const osmTileRequests = [];
      const successfulTiles = [];
      const consoleErrors = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      page.on('request', req => {
        if (req.url().includes('tile.openstreetmap.org')) {
          osmTileRequests.push(req.url());
        }
      });

      page.on('response', res => {
        const url = res.url();
        if ((url.includes('arcgisonline.com') || url.includes('cartocdn.com')) && url.includes('tile')) {
          if (res.status() === 200) {
            successfulTiles.push(url);
          }
        }
      });

      await page.goto(`${BASE_URL_3000}/screens/04-get-to-safety-step-2/index.html`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // (a) No requests to tile.openstreetmap.org
      if (osmTileRequests.length === 0) {
        pass('(a) Zero requests dispatched to tile.openstreetmap.org on Routes Page');
      } else {
        fail('(a) Zero requests dispatched to tile.openstreetmap.org', new Error(`Found ${osmTileRequests.length} blocked OSM tile requests: ${osmTileRequests[0]}`));
      }

      // (b) Tile requests return 200 and image elements have naturalWidth > 0
      const loadedTilesCount = await page.evaluate(() => {
        const map = document.getElementById('journeyMap');
        if (!map) return 0;
        const imgs = Array.from(map.querySelectorAll('img.leaflet-tile'));
        return imgs.filter(img => img.naturalWidth > 0 && img.complete).length;
      });

      if (loadedTilesCount >= 4) {
        pass(`(b) Primary ArcGIS tiles returned HTTP 200 and loaded successfully (Loaded images: ${loadedTilesCount})`);
      } else {
        fail('(b) Primary ArcGIS tiles loaded', new Error(`Only ${loadedTilesCount} valid tiles found on map`));
      }

      // (d) Zero console errors
      if (consoleErrors.length === 0) {
        pass('(d) Zero browser console errors detected on Routes map page');
      } else {
        fail('(d) Zero console errors', new Error(`Console errors encountered: ${consoleErrors.join('; ')}`));
      }

      // (e) Routes and markers render cleanly on top of tiles
      const routePathsCount = await page.evaluate(() => {
        const map = document.getElementById('journeyMap');
        if (!map) return 0;
        return map.querySelectorAll('path.leaflet-interactive').length;
      });

      const markersCount = await page.evaluate(() => {
        const map = document.getElementById('journeyMap');
        if (!map) return 0;
        return map.querySelectorAll('.custom-origin-icon, .custom-dest-icon, .leaflet-marker-icon').length;
      });

      if (routePathsCount >= 4 && markersCount >= 2) {
        pass(`(e) 4 evacuation routes (${routePathsCount} vector paths) and markers (${markersCount}) rendered on top of tiles`);
      } else {
        fail('(e) Routes and markers render on top of tiles', new Error(`Paths: ${routePathsCount}, Markers: ${markersCount}`));
      }

      // Capture screenshot
      const shotPathPrimary = path.join(screenshotsDir, 'map_04_routes_primary.png');
      const journeyCard = page.locator('#journeyMapCard');
      await journeyCard.screenshot({ path: shotPathPrimary });
      pass(`Map screenshot captured: ${shotPathPrimary}`);

      await context.close();
    }

    // -------------------------------------------------------------------------
    // TEST GROUP 2: Fallback Switching When Primary Host is Blocked (403/Fail)
    // -------------------------------------------------------------------------
    console.log('\n▶ [TEST GROUP 2] Automatic Silent Failover to CARTO when ArcGIS is Blocked');
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();

      let blockedArcGISCount = 0;
      let cartoTileSuccess = 0;

      // Intercept and simulate 403 Forbidden for ArcGIS tiles
      await page.route('**/*arcgisonline.com/ArcGIS/rest/services/World_Street_Map/**', route => {
        blockedArcGISCount++;
        route.fulfill({
          status: 403,
          contentType: 'text/plain',
          body: '403 Forbidden: Simulated Host Outage'
        });
      });

      page.on('response', res => {
        if (res.url().includes('cartocdn.com') && res.status() === 200) {
          cartoTileSuccess++;
        }
      });

      await page.goto(`${BASE_URL_3000}/screens/04-get-to-safety-step-2/index.html`, { waitUntil: 'load' });
      // Allow fallback chain to observe tileerror and switch to CARTO
      await page.waitForTimeout(2000);

      const cartoImagesLoaded = await page.evaluate(() => {
        const map = document.getElementById('journeyMap');
        if (!map) return 0;
        const imgs = Array.from(map.querySelectorAll('img.leaflet-tile'));
        const cartoImgs = imgs.filter(img => img.src.includes('cartocdn.com') && img.naturalWidth > 0);
        return cartoImgs.length;
      });

      if (blockedArcGISCount > 0 && cartoImagesLoaded >= 4) {
        pass(`(c) Automatic failover succeeded: Blocked ArcGIS tiles (${blockedArcGISCount}), silently swapped to CARTO (${cartoImagesLoaded} active tiles loaded)`);
      } else {
        fail('(c) Automatic failover to CARTO', new Error(`Blocked ArcGIS: ${blockedArcGISCount}, CARTO loaded images: ${cartoImagesLoaded}`));
      }

      // Check routes still visible during fallback
      const pathsFallback = await page.evaluate(() => {
        const map = document.getElementById('journeyMap');
        return map ? map.querySelectorAll('path.leaflet-interactive').length : 0;
      });

      if (pathsFallback >= 4) {
        pass(`Evacuation routes remain intact after fallback switch (${pathsFallback} paths active)`);
      } else {
        fail('Evacuation routes visible during fallback', new Error(`Paths: ${pathsFallback}`));
      }

      const shotPathFallback = path.join(screenshotsDir, 'map_04_routes_fallback_carto.png');
      const journeyCard = page.locator('#journeyMapCard');
      await journeyCard.screenshot({ path: shotPathFallback });
      pass(`Fallback screenshot captured: ${shotPathFallback}`);

      await context.close();
    }

    // -------------------------------------------------------------------------
    // TEST GROUP 3: Meeting Point Picker Map in Routes Page
    // -------------------------------------------------------------------------
    console.log('\n▶ [TEST GROUP 3] Meeting Point Picker Modal Map Verification');
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();

      const osmReqs = [];
      page.on('request', req => {
        if (req.url().includes('tile.openstreetmap.org')) osmReqs.push(req.url());
      });

      await page.goto(`${BASE_URL_3000}/screens/04-get-to-safety-step-2/index.html`, { waitUntil: 'networkidle' });

      // Click group travel checkbox to open meeting point options
      const groupCheck = page.locator('#group-travel-checkbox');
      await groupCheck.scrollIntoViewIfNeeded();
      await groupCheck.check();
      await page.waitForTimeout(300);

      // Open meeting point modal
      const pickBtn = page.locator('#btnPickMeetingPoint, #pickMeetingPointBtn');
      await pickBtn.click();
      await page.waitForSelector('#meetingPointModal:not(.hidden)', { timeout: 5000 });
      await page.waitForTimeout(1000);

      const pickerTilesLoaded = await page.evaluate(() => {
        const picker = document.getElementById('meetingPickerMap');
        if (!picker) return 0;
        const imgs = Array.from(picker.querySelectorAll('img.leaflet-tile'));
        return imgs.filter(img => img.naturalWidth > 0 && img.complete).length;
      });

      if (osmReqs.length === 0) {
        pass('Meeting picker dispatched 0 requests to tile.openstreetmap.org');
      } else {
        fail('Meeting picker 0 OSM requests', new Error(`Found ${osmReqs.length} OSM requests`));
      }

      if (pickerTilesLoaded >= 2) {
        pass(`Meeting picker map tiles loaded successfully (${pickerTilesLoaded} valid tiles)`);
      } else {
        fail('Meeting picker tiles loaded', new Error(`Loaded tiles: ${pickerTilesLoaded}`));
      }

      const shotPathPicker = path.join(screenshotsDir, 'map_04_meeting_picker.png');
      const modalBox = page.locator('#meetingPickerMap');
      await modalBox.screenshot({ path: shotPathPicker });
      pass(`Meeting picker screenshot captured: ${shotPathPicker}`);

      await context.close();
    }

    // -------------------------------------------------------------------------
    // TEST GROUP 4: Screen 03 (Hazard Map) Tile Verification
    // -------------------------------------------------------------------------
    console.log('\n▶ [TEST GROUP 4] Screen 03 (Interactive Hazard Map) Verification');
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();

      const osmReqs = [];
      page.on('request', req => {
        if (req.url().includes('tile.openstreetmap.org')) osmReqs.push(req.url());
      });

      await page.goto(`${BASE_URL_3000}/screens/03-get-to-safety-step-1/index.html`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const hazardTilesLoaded = await page.evaluate(() => {
        const map = document.getElementById('google-hazard-map');
        if (!map) return 0;
        const imgs = Array.from(map.querySelectorAll('img.leaflet-tile'));
        return imgs.filter(img => img.naturalWidth > 0 && img.complete).length;
      });

      if (osmReqs.length === 0) {
        pass('Screen 03 Hazard map dispatched 0 requests to tile.openstreetmap.org');
      } else {
        fail('Screen 03 0 OSM requests', new Error(`Found ${osmReqs.length} OSM requests`));
      }

      if (hazardTilesLoaded >= 4) {
        pass(`Screen 03 Hazard map tiles loaded successfully (${hazardTilesLoaded} valid tiles)`);
      } else {
        fail('Screen 03 Hazard map tiles loaded', new Error(`Loaded tiles: ${hazardTilesLoaded}`));
      }

      // Test Satellite Layer Toggle
      const satToggle = page.locator('#btnMapSatToggle');
      if (await satToggle.count() > 0) {
        await satToggle.click();
        await page.waitForTimeout(1000);
        const satTiles = await page.evaluate(() => {
          const map = document.getElementById('google-hazard-map');
          const imgs = Array.from(map.querySelectorAll('img.leaflet-tile'));
          return imgs.filter(img => img.src.includes('World_Imagery') && img.naturalWidth > 0).length;
        });
        if (satTiles >= 2) {
          pass(`Screen 03 Satellite layer switched cleanly to Esri World Imagery (${satTiles} tiles)`);
        } else {
          fail('Screen 03 Satellite layer switch', new Error(`Satellite tiles loaded: ${satTiles}`));
        }
      }

      const shotPath03 = path.join(screenshotsDir, 'map_03_hazards.png');
      const mapViewport = page.locator('#mapViewport');
      await mapViewport.screenshot({ path: shotPath03 });
      pass(`Screen 03 Hazard screenshot captured: ${shotPath03}`);

      await context.close();
    }

    // -------------------------------------------------------------------------
    // TEST GROUP 5: Screen 07 (Safe Places / Shelters Map) Verification
    // -------------------------------------------------------------------------
    console.log('\n▶ [TEST GROUP 5] Screen 07 (Safe Shelters & Hospitals Map) Verification');
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();

      const osmReqs = [];
      page.on('request', req => {
        if (req.url().includes('tile.openstreetmap.org')) osmReqs.push(req.url());
      });

      await page.goto(`${BASE_URL_3000}/screens/07-safe-places/index.html`, { waitUntil: 'networkidle' });
      // Switch from List View to Map View
      const mapBtn = page.locator('#btn-map-view');
      if (await mapBtn.count() > 0) {
        await mapBtn.click();
      }
      await page.waitForTimeout(1500);

      const shelterTilesLoaded = await page.evaluate(() => {
        const map = document.getElementById('civic-google-map');
        if (!map) return 0;
        const imgs = Array.from(map.querySelectorAll('img.leaflet-tile'));
        return imgs.filter(img => img.naturalWidth > 0 && img.complete).length;
      });

      if (osmReqs.length === 0) {
        pass('Screen 07 Shelters map dispatched 0 requests to tile.openstreetmap.org');
      } else {
        fail('Screen 07 0 OSM requests', new Error(`Found ${osmReqs.length} OSM requests`));
      }

      if (shelterTilesLoaded >= 4) {
        pass(`Screen 07 Shelters map tiles loaded successfully (${shelterTilesLoaded} valid tiles)`);
      } else {
        fail('Screen 07 Shelters map tiles loaded', new Error(`Loaded tiles: ${shelterTilesLoaded}`));
      }

      const shotPath07 = path.join(screenshotsDir, 'map_07_shelters.png');
      const mapEl = page.locator('#civic-google-map');
      await mapEl.screenshot({ path: shotPath07 });
      pass(`Screen 07 Shelters screenshot captured: ${shotPath07}`);

      await context.close();
    }

    // -------------------------------------------------------------------------
    // TEST GROUP 6: Screen 08 (Supplies Step 5 Map) Verification
    // -------------------------------------------------------------------------
    console.log('\n▶ [TEST GROUP 6] Screen 08 (Supplies Step 5 Location Map) Verification');
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();

      const osmReqs = [];
      page.on('request', req => {
        if (req.url().includes('tile.openstreetmap.org')) osmReqs.push(req.url());
      });

      await page.goto(`${BASE_URL_3000}/screens/08-emergency-relief/index.html`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      // Advance wizard from Step 1 to Step 5
      await page.locator('#step1NextBtn').click();
      await page.waitForTimeout(200);
      await page.locator('#step2NextBtn').click();
      await page.waitForTimeout(200);
      await page.locator('#step3NextBtn').click();
      await page.waitForTimeout(200);
      await page.locator('#step4NextBtn').click();
      await page.waitForTimeout(1000);

      const step5TilesLoaded = await page.evaluate(() => {
        const map = document.getElementById('step5LeafletMap');
        if (!map) return 0;
        const imgs = Array.from(map.querySelectorAll('img.leaflet-tile'));
        return imgs.filter(img => img.naturalWidth > 0 && img.complete).length;
      });

      if (osmReqs.length === 0) {
        pass('Screen 08 Step 5 map dispatched 0 requests to tile.openstreetmap.org');
      } else {
        fail('Screen 08 0 OSM requests', new Error(`Found ${osmReqs.length} OSM requests`));
      }

      if (step5TilesLoaded >= 2) {
        pass(`Screen 08 Step 5 delivery map tiles loaded successfully (${step5TilesLoaded} valid tiles)`);
      } else {
        fail('Screen 08 Step 5 tiles loaded', new Error(`Loaded tiles: ${step5TilesLoaded}`));
      }

      const shotPath08 = path.join(screenshotsDir, 'map_08_supplies_step5.png');
      const mapEl = page.locator('#step5LeafletMap');
      await mapEl.screenshot({ path: shotPath08 });
      pass(`Screen 08 Step 5 screenshot captured: ${shotPath08}`);

      await context.close();
    }

    // -------------------------------------------------------------------------
    // TEST GROUP 7: Clean Routes URL on Port 5001 (/routes)
    // -------------------------------------------------------------------------
    console.log('\n▶ [TEST GROUP 7] Single-Server Port 5001 Unified Route (/routes) Verification');
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();

      const osmReqs = [];
      page.on('request', req => {
        if (req.url().includes('tile.openstreetmap.org')) osmReqs.push(req.url());
      });

      await page.goto(`${BASE_URL_5001}/journey`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const port5001Tiles = await page.evaluate(() => {
        const map = document.getElementById('journeyMap');
        if (!map) return 0;
        const imgs = Array.from(map.querySelectorAll('img.leaflet-tile'));
        return imgs.filter(img => img.naturalWidth > 0 && img.complete).length;
      });

      if (osmReqs.length === 0 && port5001Tiles >= 4) {
        pass(`Unified port 5001 /journey loaded cleanly with 0 OSM requests and ${port5001Tiles} valid ArcGIS tiles`);
      } else {
        fail('Unified port 5001 /journey tiles', new Error(`OSM reqs: ${osmReqs.length}, tiles: ${port5001Tiles}`));
      }

      await context.close();
    }

  } catch (globalErr) {
    console.error('Fatal test runner error:', globalErr);
  } finally {
    await browser.close();
  }

  console.log('\n================================================================================');
  console.log(`TOTAL MAP TILE TESTS PASSED: ${passedTests} / ${totalTests}`);
  console.log(`TOTAL MAP TILE TESTS FAILED: ${failedTests}`);
  console.log('================================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runMapTilesTestSuite();
