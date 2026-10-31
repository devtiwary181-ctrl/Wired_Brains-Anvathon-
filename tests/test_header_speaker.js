import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('Navigating to citizen dashboard...');
    await page.goto('http://localhost:3000/screens/02-citizen-dashboard/index.html');
    await page.waitForLoadState('networkidle');

    // Locate header audio button: #headerAudioBtn
    const btn = page.locator('#headerAudioBtn');
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('Found #headerAudioBtn');

    // Verify initial state
    const initialClass = await btn.getAttribute('class');
    console.log('Initial class:', initialClass);

    // Mock speechSynthesis and audio play
    await page.evaluate(() => {
      window._spokenTexts = [];
      window._stopped = false;
      window.speechSynthesis.speak = (u) => {
        window._spokenTexts.push(u.text);
      };
      window.speechSynthesis.cancel = () => {
        window._stopped = true;
      };
    });

    // Click to start reading
    console.log('Clicking header speaker to play...');
    await btn.click();
    await page.waitForTimeout(1000);

    const activeClass = await btn.getAttribute('class');
    const ariaPressed = await btn.getAttribute('aria-pressed');
    console.log('Active class:', activeClass);
    console.log('Aria pressed:', ariaPressed);

    if (!activeClass.includes('bg-[#0B5FA5]') || ariaPressed !== 'true') {
      console.error('FAIL: Button did not show active state!');
      process.exit(1);
    }

    const spoken = await page.evaluate(() => window._spokenTexts);
    console.log('Spoken texts captured:', spoken);

    // Click again to toggle off
    console.log('Clicking header speaker to stop...');
    await btn.click();
    await page.waitForTimeout(500);

    const stoppedClass = await btn.getAttribute('class');
    const stoppedAria = await btn.getAttribute('aria-pressed');
    console.log('Stopped class:', stoppedClass);
    console.log('Stopped aria pressed:', stoppedAria);

    if (stoppedClass.includes('bg-[#0B5FA5]') || stoppedAria !== 'false') {
      console.error('FAIL: Button did not toggle off properly!');
      process.exit(1);
    }

    console.log('PASS: Item 8 verified successfully!');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

