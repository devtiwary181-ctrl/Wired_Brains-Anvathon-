const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  console.log("Navigating to Screen 08 (Emergency Relief)...");
  await page.goto("http://localhost:3000/screens/08-emergency-relief/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  // Check interactive elements on supplies screen
  const categoryTabs = await page.$$("button[role='tab'], [data-category]");
  console.log("Category tabs/filters:", categoryTabs.length);

  const peopleCountButtons = await page.$$("button:has-text('+'), button:has-text('-')");
  console.log("People count +/- buttons:", peopleCountButtons.length);

  const checkboxes = await page.$$("input[type='checkbox']");
  console.log("Supply check boxes:", checkboxes.length);

  const submitBtn = await page.$("button[type='submit'], #submit-relief-btn, button:has-text('Submit Request'), button:has-text('Send Request')");
  console.log("Submit button present:", !!submitBtn);

  await browser.close();
  console.log("Errors:", errors);
})();
