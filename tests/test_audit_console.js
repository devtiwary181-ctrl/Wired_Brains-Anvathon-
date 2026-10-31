import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });

  const urls = [
    'http://localhost:3000/screens/01-language-location/index.html',
    'http://localhost:3000/screens/02-citizen-dashboard/index.html'
  ];

  let hasFatalErrors = false;

  for (const url of urls) {
    console.log(`\n--- Auditing: ${url} ---`);
    const page = await browser.newPage();

    const consoleErrors = [];
    const failedRequests = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        // Exclude benign missing favicon or font warnings if any
        consoleErrors.push(msg.text());
      }
    });

    page.on('requestfailed', req => {
      failedRequests.push(`${req.method()} ${req.url()} (${req.failure()?.errorText})`);
    });

    page.on('response', resp => {
      if (resp.status() >= 400) {
        failedRequests.push(`${resp.status()} ${resp.url()}`);
      }
    });

    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    console.log(`Console Errors (${consoleErrors.length}):`, consoleErrors);
    console.log(`Failed Requests / 404s (${failedRequests.length}):`, failedRequests);

    if (consoleErrors.length > 0 || failedRequests.length > 0) {
      hasFatalErrors = true;
    }

    await page.close();
  }

  await browser.close();

  if (hasFatalErrors) {
    console.log('\n[NOTICE] Some console errors or failed requests were observed (inspecting details above).');
  } else {
    console.log('\n[CLEAN] Zero console errors or 404s observed across audited screens!');
  }
})();

