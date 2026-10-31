const { chromium } = require('playwright');

const screens = [
  "01-language-location", "02-citizen-dashboard", "03-get-to-safety-step-1",
  "04-get-to-safety-step-2", "05-get-to-safety-step-4", "06-get-to-safety-step-5",
  "07-safe-places", "08-emergency-relief", "09-relief-tracking",
  "10-relief-tracking-alternative", "11-preparedness", "12-emergency-help",
  "13-staff-login", "14-authority-dashboard", "15-staff-tools-settings"
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  let totalErrors = 0;

  for (const s of screens) {
    const page = await browser.newPage();
    const errors = [];
    const failedReqs = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('requestfailed', req => {
      // ignore chrome-extension or external analytics if any
      failedReqs.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
    });

    try {
      await page.goto(`http://localhost:3000/screens/${s}/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      console.log(`[${s}] Errors: ${errors.length}, FailedReqs: ${failedReqs.length}`);
      if (errors.length > 0) {
        console.log(`   Console Errors:`, errors);
        totalErrors += errors.length;
      }
      if (failedReqs.length > 0) {
        console.log(`   Failed Requests:`, failedReqs);
        totalErrors += failedReqs.length;
      }
    } catch (e) {
      console.log(`[${s}] Crash: ${e.message}`);
      totalErrors++;
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log(`\nTotal Issues Across All 15 Screens: ${totalErrors}`);
})();
