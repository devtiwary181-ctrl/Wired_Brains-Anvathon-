const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000/screens/01-language-location/index.html');
  const logo = await page.$('img[src*="logo.svg"]');
  console.log('Logo element found on landing page:', !!logo);
  if (logo) {
    const isVisible = await logo.isVisible();
    console.log('Landing page logo visible:', isVisible);
  }

  await page.goto('http://localhost:3000/screens/02-citizen-dashboard/index.html');
  const dashLogo = await page.$('img[src*="logo.svg"]');
  console.log('Logo element found on dashboard:', !!dashLogo);
  if (dashLogo) {
    const dashVisible = await dashLogo.isVisible();
    console.log('Dashboard logo visible:', dashVisible);
  }

  await browser.close();
})();
