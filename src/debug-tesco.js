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
await page.goto('https://www.tescomobile.ie/sim-only-plans', { waitUntil: 'domcontentloaded', timeout: 30000 });
await sleep(3000);
await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight * 0.5); });
await sleep(1500);

// Show all plan card blocks
const blocks = await page.evaluate(() => {
  const results = [];
  const priceRe = /€\s*(\d+(?:\.\d{1,2})?)/;
  const candidates = Array.from(document.querySelectorAll(
    'article, section, [class*="plan"], [class*="card"], [class*="tariff"], [class*="bundle"], [class*="deal"], [class*="product"], [class*="tile"], li'
  ));
  for (const el of candidates) {
    const text = el.innerText || '';
    if (!priceRe.test(text)) continue;
    if (text.length < 20 || text.length > 3000) continue;
    results.push(text.trim().slice(0, 600));
  }
  const seen = new Set();
  return results.filter(t => { const k = t.slice(0,80); if(seen.has(k)) return false; seen.add(k); return true; });
});

console.log('=== Tesco plan blocks ===');
blocks.forEach((b, i) => {
  console.log(`\n--- Block ${i+1} ---`);
  console.log(b);
});

// Also show lines mentioning minutes, texts, or 150
const lines = await page.evaluate(() => {
  const root = document.querySelector('main, [role="main"]') || document.body;
  return root.innerText.split('\n').filter(l => /150|minute|text|sms|call/i.test(l)).map(l => l.trim()).filter(Boolean);
});
console.log('\n=== Lines mentioning 150 / minutes / texts / calls ===');
lines.forEach(l => console.log(l));

await browser.close();
