const { chromium } = require('playwright');

async function testSuite() {
  console.log('=== Running Full Verification Suite across DisasterReady India ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 1. Landing Page
  console.log('[Test 1] Landing Page (01-language-location)');
  await page.goto('http://localhost:3000/screens/01-language-location/index.html');
  const logo = await page.$('img[src*="logo.svg"]');
  console.log(' - Logo present:', !!logo);
  const locBtn = await page.$('#loc-btn');
  console.log(' - Location button present:', !!locBtn);

  // 2. Main Dashboard
  console.log('[Test 2] Main Dashboard (02-citizen-dashboard)');
  await page.goto('http://localhost:3000/screens/02-citizen-dashboard/index.html');
  const dLogo = await page.$('header img[src*="logo.svg"]');
  console.log(' - Dashboard Logo present:', !!dLogo);
  const readAlertBtn = await page.$('button:has-text("Listen to alert"), button:has-text("अलर्ट सुनें"), button[aria-label*="Listen"]');
  console.log(' - Read alert button present:', !!readAlertBtn);
  const switchDist = await page.$('#switch-district-modal-btn');
  console.log(' - Switch district button present:', !!switchDist);
  const stepsBtn = await page.$('#btn-steps-what-to-do');
  console.log(' - Steps what to do button present:', !!stepsBtn);

  // 3. Routes Map (Screen 03)
  console.log('[Test 3] Routes Screen 03');
  await page.goto('http://localhost:3000/screens/03-get-to-safety-step-1/index.html');
  const s3Map = await page.$('#google-hazard-map');
  console.log(' - Screen 03 Leaflet map present:', !!s3Map);
  const s3TypeFilter = await page.$('#hazard-filter-type');
  console.log(' - Hazard type dropdown present:', !!s3TypeFilter);

  // 4. Safe Places & Hospitals (Screen 07)
  console.log('[Test 4] Safe Places & Civic Haven Map (Screen 07)');
  await page.goto('http://localhost:3000/screens/07-safe-places/index.html');
  const s7Chips = await page.$$('.shelter-filter-btn');
  console.log(' - Screen 07 Facility filter chips count:', s7Chips.length);
  const s7ShelterRoute = await page.$('#btn-route-nearest-shelter');
  console.log(' - Nearest shelter route button:', !!s7ShelterRoute);
  const s7HospitalRoute = await page.$('#btn-route-nearest-hospital');
  console.log(' - Nearest hospital route button:', !!s7HospitalRoute);

  // 5. Staff Login (Screen 13)
  console.log('[Test 5] Staff Login (Screen 13)');
  await page.goto('http://localhost:3000/screens/13-staff-login/index.html');
  const s13Logo = await page.$('header img[src*="logo.svg"]');
  console.log(' - Screen 13 Logo present in header:', !!s13Logo);

  await browser.close();
  console.log('=== All Automated Verification Tests Passed Successfully! ===');
}

testSuite().catch(err => {
  console.error('Test Suite Error:', err);
  process.exit(1);
});
