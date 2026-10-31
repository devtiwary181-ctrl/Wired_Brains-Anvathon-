import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('Navigating to citizen dashboard...');
    await page.goto('http://localhost:3000/screens/02-citizen-dashboard/index.html');
    await page.waitForLoadState('networkidle');

    // Find the person icon container in header: <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center"><span class="material-symbols-outlined text-on-primary text-[18px]">person</span></div>
    const avatar = page.locator('header .w-8.h-8').filter({ has: page.locator('span:has-text("person")') }).first();
    await avatar.waitFor({ state: 'visible', timeout: 5000 });
    console.log('Found profile avatar button. Clicking...');
    await avatar.click();

    // Check dropdown menu
    const dropdown = page.locator('#dr-profile-dropdown');
    await dropdown.waitFor({ state: 'visible', timeout: 3000 });
    const text = await dropdown.innerText();
    console.log('Dropdown visible with text:\n', text);

    // Verify "Direct SEOC Portal" is absent
    if (text.includes('Direct SEOC') || text.includes('SEOC Portal')) {
      console.error('FAIL: Direct SEOC option still present!');
      process.exit(1);
    }
    console.log('PASS: Direct SEOC is absent.');

    // Verify "Login as Admin" is present and points to /screens/13-staff-login/index.html
    const adminLink = dropdown.locator('a[href*="13-staff-login"]');
    if ((await adminLink.count()) === 0) {
      console.error('FAIL: Login as Admin link not found!');
      process.exit(1);
    }
    console.log('PASS: Login as Admin link is present.');

    // Click it and verify navigation
    await Promise.all([
      page.waitForNavigation(),
      adminLink.click()
    ]);
    console.log('Successfully navigated to:', page.url());
    if (!page.url().includes('13-staff-login')) {
      console.error('FAIL: Did not reach 13-staff-login');
      process.exit(1);
    }
    console.log('PASS: Item 7 successfully verified!');
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
