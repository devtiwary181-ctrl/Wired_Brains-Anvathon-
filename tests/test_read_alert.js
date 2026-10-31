import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000/screens/02-citizen-dashboard/index.html');
  await page.waitForTimeout(400);

  // Switch to flood tab to ensure active alert card is showing
  const floodTab = await page.$('.state-tab-btn[data-state="flood"]');
  if (floodTab) await floodTab.click();
  await page.waitForTimeout(200);

  const ttsBtn = await page.$('#ttsButtonSub, #ttsButton');
  console.log('Read Alert speaker button exists:', !!ttsBtn);

  if (!ttsBtn) {
    console.error('Button not found');
    process.exit(1);
  }

  // Test click on Read Alert button
  const speakResult = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const origSpeak = window.DisasterReadyAPI.voice.speak.bind(window.DisasterReadyAPI.voice);
      window.DisasterReadyAPI.voice.speak = async (text, lang) => {
        const res = await origSpeak(text, lang);
        resolve({ text: text.substring(0, 80), lang, res });
        return res;
      };
      const btn = document.getElementById('ttsButtonSub') || document.getElementById('ttsButton');
      btn.click();
    });
  });

  console.log('Speaker read-alert result:', speakResult);

  // Click again to toggle off
  const toggleOffResult = await page.evaluate(() => {
    const btn = document.getElementById('ttsButtonSub') || document.getElementById('ttsButton');
    btn.click();
    return !btn.classList.contains('bg-[#EBF5FF]');
  });
  console.log('Button toggled off correctly:', toggleOffResult);

  // Test Clear/No Alert audio message
  const clearTab = await page.$('.state-tab-btn[data-state="clear"]');
  if (clearTab) await clearTab.click();
  await page.waitForTimeout(200);

  const clearSpeakResult = await page.evaluate(async () => {
    return new Promise((resolve) => {
      window.DisasterReadyAPI.voice.speak = async (text, lang) => {
        resolve({ text, lang });
        return { success: true };
      };
      const btn = document.getElementById('ttsButtonClear');
      if (btn) btn.click();
      else resolve({ error: 'ttsButtonClear not found' });
    });
  });
  console.log('Clear state speaker result:', clearSpeakResult);

  await browser.close();
})();
