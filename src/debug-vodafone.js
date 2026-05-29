import { chromium } from 'playwright';
import { setTimeout as sleep } from 'timers/promises';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  locale: 'en-IE',
});
const page = await context.newPage();
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
});
await page.goto('https://www.vodafone.ie/sim-only/bill-pay', { waitUntil: 'domcontentloaded', timeout: 30000 });
await sleep(6000);
await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight * 0.5); });
await sleep(1500);

const mainText = await page.evaluate(() => {
  const root = document.querySelector('main, [role="main"]') || document.body;
  return root.innerText;
});

// Show lines mentioning GB, unlimited, data, month, contract
console.log('=== Lines mentioning GB / unlimited / data / month / contract ===');
mainText.split('\n')
  .map(l => l.trim()).filter(Boolean)
  .filter(l => /GB|unlimited|data|month|contract|roaming|12|24|30.day/i.test(l))
  .forEach(l => console.log(l));

// Show 600 chars either side of the price sentence
const idx = mainText.search(/€\s*20.*?for.*?6.*?months/i);
if (idx >= 0) {
  console.log('\n=== Context around the promo sentence ===');
  console.log(mainText.slice(Math.max(0, idx - 300), idx + 600));
}

await browser.close();
