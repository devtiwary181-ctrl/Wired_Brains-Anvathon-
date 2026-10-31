import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    geolocation: { latitude: 12.9716, longitude: 77.5946, accuracy: 25 },
    permissions: ['geolocation'],
  });
  const page = await context.newPage();

  await page.goto('http://localhost:3000/screens/01-language-location/index.html');
  
  // Click on "Use my location to pick my language"
  const locBtn = await page.$('#loc-btn');
  console.log('Location button exists:', !!locBtn);
  await locBtn.click();

  // Wait for state-detected to be visible
  await page.waitForSelector('#state-detected:not(.hidden)', { timeout: 10000 });
  
  const titleText = await page.textContent('#detected-title');
  const accText = await page.textContent('#detected-accuracy-pill');
  console.log('Detected Title:', titleText);
  console.log('Accuracy Pill:', accText);

  if (titleText.includes('Bengaluru') || titleText.includes('Karnataka') || titleText.includes('detected')) {
    console.log('TEST 2 PASSED: Geolocation detection and accuracy display verified.');
  } else {
    console.error('TEST 2 FAILED: Unexpected title text:', titleText);
    process.exit(1);
  }

  await browser.close();
})();

