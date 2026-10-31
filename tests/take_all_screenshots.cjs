const { chromium } = require('playwright');
const fs = require('fs');

const screens = [
  "01-language-location", "02-citizen-dashboard", "03-get-to-safety-step-1",
  "04-get-to-safety-step-2", "05-get-to-safety-step-4", "06-get-to-safety-step-5",
  "07-safe-places", "08-emergency-relief", "09-relief-tracking",
  "10-relief-tracking-alternative", "11-preparedness", "12-emergency-help",
  "13-staff-login", "14-authority-dashboard", "15-staff-tools-settings"
];

(async () => {
  const browser = await chromium.launch({ headless: true });

  for (const s of screens) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`http://localhost:3000/screens/${s}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    // 1. Light Mode
    await page.screenshot({ path: `tests/screenshots/${s}-light.png`, fullPage: false });

    // 2. Dark Mode
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `tests/screenshots/${s}-dark.png`, fullPage: false });

    // 3. Hindi Mode
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      if (window.DisasterReadyI18n) window.DisasterReadyI18n.applyLanguage('hi');
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `tests/screenshots/${s}-hindi.png`, fullPage: false });

    console.log(`Captured light, dark, and hindi screenshots for [${s}]`);
    await page.close();
  }

  await browser.close();
  console.log("All screenshots captured in tests/screenshots/!");
})();
