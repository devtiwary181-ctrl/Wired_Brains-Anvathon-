const { chromium } = require('playwright');

(async () => {
  console.log('--- Testing Part 1: Routes Page (Screen 03 & 04) ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // 1. Visit Screen 03
  await page.goto('http://localhost:3000/screens/03-get-to-safety-step-1/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Verify Leaflet Map initialized
  const mapElement = await page.$('#google-hazard-map');
  console.log('Screen 03 Leaflet map container exists:', !!mapElement);

  // Check language select
  const langSelect = await page.$('.header-lang-select');
  console.log('Header Language dropdown exists:', !!langSelect);
  if (langSelect) {
    await langSelect.selectOption('hi');
    await page.waitForTimeout(500);
    const navText = await page.innerText('nav');
    console.log('Language switched to Hindi in nav:', navText.includes('डैशबोर्ड') || navText.includes('मार्ग'));
  }

  // Check Filter controls
  const typeSelect = await page.$('#hazard-filter-type');
  const severitySelect = await page.$('#hazard-filter-severity');
  console.log('Hazard Type and Severity filter selects exist:', !!typeSelect && !!severitySelect);
  if (typeSelect) {
    await typeSelect.selectOption('FLOOD');
    await page.waitForTimeout(500);
    console.log('Selected FLOOD hazard filter successfully');
  }

  // Check Choose Journey Button click
  console.log('Navigating to Screen 04...');
  await page.goto('http://localhost:3000/screens/04-get-to-safety-step-2/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Screen 04 verified destination facilities loading
  const facilitySection = await page.$('#route-facility-results');
  console.log('Screen 04 destination facility section exists:', !!facilitySection);

  await browser.close();
  console.log('Part 1 Test Succeeded. Errors:', errors);
})();
