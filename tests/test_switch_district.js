import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('Navigating to citizen dashboard...');
    await page.goto('http://localhost:3000/screens/02-citizen-dashboard/index.html');
    await page.waitForLoadState('networkidle');

    // Click "Switch district" button
    const switchBtn = page.locator('#switchDistrictBtn');
    await switchBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('Clicking Switch district button...');
    await switchBtn.click();

    // Verify modal appears
    const modal = page.locator('#dr-switch-district-modal');
    await modal.waitFor({ state: 'visible', timeout: 3000 });
    console.log('PASS: Switch district modal is visible.');

    // Verify State selector
    const stateSelect = modal.locator('#modalStateSelect');
    await stateSelect.waitFor({ state: 'visible', timeout: 2000 });
    console.log('Selecting state "Karnataka"...');
    await stateSelect.selectOption('Karnataka');

    // Wait for districts to populate
    await page.waitForTimeout(500);

    // Search for "Bengaluru" in district search input
    const input = modal.locator('#districtModalInput');
    await input.fill('Bengaluru');
    await page.waitForTimeout(600);

    // Check results
    const results = modal.locator('#districtModalResults button');
    const count = await results.count();
    console.log(`Found ${count} matching district buttons in modal.`);
    if (count === 0) {
      console.error('FAIL: No districts rendered in modal!');
      process.exit(1);
    }

    const firstDistrictText = await results.first().innerText();
    console.log('Selecting first district:\n', firstDistrictText);

    // Click the district button
    await results.first().click();

    // Wait for reload / storage persistence
    await page.waitForTimeout(1000);

    // Verify localStorage has persisted district
    const storedDistrict = await page.evaluate(() => localStorage.getItem('dr_district'));
    console.log('Persisted dr_district in localStorage:', storedDistrict);

    if (!storedDistrict || !storedDistrict.includes('Bengaluru')) {
      console.error('FAIL: District was not correctly stored in localStorage!');
      process.exit(1);
    }

    console.log('PASS: Item 10 verified successfully!');
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

