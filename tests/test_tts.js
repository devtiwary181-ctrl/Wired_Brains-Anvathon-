import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000/screens/01-language-location/index.html');

  // Test Hindi, Bengali, Tamil buttons
  const testLangs = [
    { name: 'Hindi', selector: '[data-lang="hi"] button[aria-label="Listen Hindi"]' },
    { name: 'Bengali', selector: '[data-lang="bn"] button[aria-label="Listen Bengali"]' },
    { name: 'Tamil', selector: '[data-lang="ta"] button[aria-label="Listen Tamil"]' }
  ];

  for (const item of testLangs) {
    const btn = await page.$(item.selector);
    console.log(`Speaker button for ${item.name} exists:`, !!btn);
    if (btn) {
      const speakResult = await page.evaluate(async (sel) => {
        const el = document.querySelector(sel);
        return new Promise((resolve) => {
          const origSpeak = window.DisasterReadyAPI.voice.speak.bind(window.DisasterReadyAPI.voice);
          window.DisasterReadyAPI.voice.speak = async (...args) => {
            const res = await origSpeak(...args);
            resolve(res);
            return res;
          };
          el.click();
        });
      }, item.selector);

      console.log(`Result for ${item.name}:`, speakResult);
    }
  }

  await browser.close();
})();
