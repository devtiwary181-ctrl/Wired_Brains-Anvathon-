import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('Navigating to citizen dashboard...');
    await page.goto('http://localhost:3000/screens/02-citizen-dashboard/index.html');
    await page.waitForLoadState('networkidle');

    // Click Active Flash Flood Alert preview tab
    console.log('Clicking Flood preview tab...');
    const floodTab = page.locator('.state-tab-btn[data-state="flood"]');
    await floodTab.click();
    await page.waitForTimeout(500);

    // Verify Steps button in flood alert points to ?hazard=flood
    const floodStepsBtn = page.locator('#alertCard a:has-text("Steps: What to do")');
    await floodStepsBtn.waitFor({ state: 'visible', timeout: 3000 });
    const floodHref = await floodStepsBtn.getAttribute('href');
    console.log('Flood Steps button href:', floodHref);
    if (!floodHref.includes('hazard=flood')) {
      console.error('FAIL: Flood steps button does not link to hazard=flood');
      process.exit(1);
    }

    // Click and verify navigation to flood hazard guide
    const [res] = await Promise.all([
      page.waitForNavigation(),
      floodStepsBtn.click()
    ]);
    console.log('Navigated to:', page.url(), 'with status:', res.status());
    if (res.status() !== 200 || !page.url().includes('11-preparedness') || !page.url().includes('hazard=flood')) {
      console.error('FAIL: Expected 200 navigation to 11-preparedness?hazard=flood');
      process.exit(1);
    }

    console.log('PASS: Item 9 flood and default hazard routing verified successfully!');
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
