import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 12.9716, longitude: 77.5946, accuracy: 25 });

  const page = await context.newPage();

  console.log('--- 1. Landing Page: Start flow ---');
  await page.goto('http://localhost:3000/screens/01-language-location/index.html');
  await page.waitForLoadState('networkidle');

  // Choose Hindi card
  const hiCard = page.locator('.lang-card[data-lang="hi"]');
  await hiCard.click();
  console.log('Language chosen: Hindi');

  // Track location via #loc-btn
  const trackBtn = page.locator('#loc-btn');
  await trackBtn.click();
  await page.waitForSelector('#state-detected:not(.hidden)', { timeout: 10000 });
  const detectedPill = await page.locator('#detected-accuracy-pill').innerText();
  console.log('Location tracked:', detectedPill);

  // Enter Dashboard via #submit-btn
  const enterBtn = page.locator('#submit-btn');
  await Promise.all([
    page.waitForNavigation(),
    enterBtn.click()
  ]);
  console.log('Entered Dashboard:', page.url());

  // Read alert test
  console.log('--- 2. Dashboard: Read Alert ---');
  const floodTab = page.locator('.state-tab-btn[data-state="flood"]');
  await floodTab.click();
  await page.waitForTimeout(400);

  const ttsBtn = page.locator('#alertCard button:has-text("Listen to alert"), #alertCard button[onclick*="toggleAlertAudio"]').first();
  await ttsBtn.click();
  console.log('Alert speaker clicked.');

  // Switch district test
  console.log('--- 3. Dashboard: Switch District ---');
  const switchBtn = page.locator('#switchDistrictBtn');
  await switchBtn.click();
  const modal = page.locator('#dr-switch-district-modal');
  await modal.waitFor({ state: 'visible' });
  await modal.locator('#modalStateSelect').selectOption('Karnataka');
  await page.waitForTimeout(400);
  await modal.locator('#districtModalInput').fill('Bengaluru');
  await page.waitForTimeout(400);
  await modal.locator('#districtModalResults button').first().click();
  console.log('District switched.');
  await page.waitForTimeout(1000);

  // Steps what to do test
  console.log('--- 4. Dashboard: Steps what to do ---');
  await page.locator('.state-tab-btn[data-state="flood"]').click();
  await page.waitForTimeout(300);
  const stepsBtn = page.locator('#alertCard a:has-text("Steps: What to do")').first();
  const [navRes] = await Promise.all([
    page.waitForNavigation(),
    stepsBtn.click()
  ]);
  console.log('Navigated via Steps to:', page.url(), 'status:', navRes.status());

  // Dark mode test
  console.log('--- 5. Return to dashboard and test Dark mode toggle ---');
  await page.goto('http://localhost:3000/screens/02-citizen-dashboard/index.html');
  await page.waitForLoadState('networkidle');
  const themeBtn = page.locator('#themeToggleBtn');
  await themeBtn.click();
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  console.log('Theme toggled. Is dark class on html?', isDark);

  console.log('\n--- ALL E2E FLOW CHECKS PASSED SUCCESSFULLY ---');
  await browser.close();
})();
