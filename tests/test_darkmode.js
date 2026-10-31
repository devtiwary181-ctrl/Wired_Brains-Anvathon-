import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  
  await page.goto('http://localhost:3000/screens/02-citizen-dashboard/index.html');
  await page.waitForTimeout(500);

  // Take light mode screenshot
  await page.screenshot({ path: 'tests/dashboard-light.png' });
  console.log('Light mode screenshot saved: tests/dashboard-light.png');

  // Toggle dark mode
  const themeBtn = await page.$('#themeToggleBtn');
  if (themeBtn) {
    await themeBtn.click();
    await page.waitForTimeout(400);
  } else {
    await page.evaluate(() => document.documentElement.classList.add('dark'));
  }

  // Verify tab buttons text color in dark mode
  const tabStyles = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.state-tab-btn'));
    return btns.map(b => {
      const comp = window.getComputedStyle(b);
      return {
        text: b.innerText.trim(),
        color: comp.color,
        backgroundColor: comp.backgroundColor
      };
    });
  });
  console.log('Dark mode preview tab button styles:', tabStyles);

  // Take dark mode screenshot
  await page.screenshot({ path: 'tests/dashboard-dark.png' });
  console.log('Dark mode screenshot saved: tests/dashboard-dark.png');

  await browser.close();
})();

