import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { setTimeout as sleep } from 'timers/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const CARRIERS = [
  {
    carrier: 'vodafone',
    carrierDisplay: 'Vodafone',
    url: 'https://www.vodafone.ie/sim-only/bill-pay',
    network: 'Vodafone',
    extraWait: 3000,
  },
  {
    carrier: 'three',
    carrierDisplay: 'Three',
    url: 'https://www.three.ie/deals/sim-only.html',
    network: 'Three',
  },
  {
    carrier: 'gomo',
    carrierDisplay: 'GoMo',
    url: 'https://shop.gomo.ie/mobile-sim-only',
    network: 'Three',
  },
  {
    carrier: 'clearmobile',
    carrierDisplay: 'Clear Mobile',
    url: 'https://www.clearmobile.ie/',
    network: 'Three',
  },
  {
    carrier: 'skymobile',
    carrierDisplay: 'Sky Mobile',
    url: 'https://www.sky.com/ie/shop/mobile/plans/',
    network: 'Vodafone',
  },
  {
    carrier: 'tescomobile',
    carrierDisplay: 'Tesco Mobile',
    url: 'https://www.tescomobile.ie/sim-only-plans',
    network: 'Three',
  },
  {
    carrier: 'virginmedia',
    carrierDisplay: 'Virgin Media Mobile',
    url: 'https://www.virginmedia.ie/mobile/sim-only/',
    network: 'Three',
  },
  {
    carrier: 'eir',
    carrierDisplay: 'eir',
    url: 'https://www.eir.ie/mobile/simonly/',
    network: 'eir',
    extraWait: 3000,
  },
];

// Remove nav/header/footer/cookie banners so text is cleaner
const STRIP_SELECTORS = [
  'header', 'footer', 'nav', '[role="navigation"]', '[role="banner"]',
  '.cookie-banner', '.cookie-bar', '#onetrust-banner-sdk', '#cookie-law-info-bar',
  '.gdpr', '.announcement-bar', '.skip-link', '.breadcrumb',
  '[class*="cookie"]', '[class*="header"]', '[class*="footer"]', '[class*="nav"]',
  '[class*="menu"]', '[class*="sitemap"]', '[id*="cookie"]', '[id*="header"]',
  '[id*="footer"]', '[id*="nav"]', 'script', 'style', 'noscript',
];

async function getCleanText(page) {
  return page.evaluate((selectors) => {
    // Prefer <main> — avoids phone bundle / hero banner sections outside the plan area
    const root = document.querySelector('main, [role="main"], #main-content, #content, .main-content')
      || document.body;
    // Modify the real DOM so innerText computes correctly (React virtual DOM breaks on clones)
    for (const sel of selectors) {
      root.querySelectorAll(sel).forEach((el) => el.remove());
    }
    return root.innerText;
  }, STRIP_SELECTORS);
}

// Try to find structured plan blocks using heading + price proximity
async function getStructuredPlans(page) {
  return page.evaluate(() => {
    const results = [];

    // Find elements that look like plan cards (contain a price and some data info)
    const priceRe = /€\s*(\d+(?:\.\d{1,2})?)/;
    const dataRe = /(\d+)\s*GB|unlimited/i;

    // Walk all elements, find ones that have both a price and data mention
    const candidates = Array.from(document.querySelectorAll(
      'article, section, [class*="plan"], [class*="card"], [class*="tariff"], [class*="bundle"], [class*="deal"], [class*="product"], [class*="tile"], li'
    ));

    for (const el of candidates) {
      const text = el.innerText || '';
      if (!priceRe.test(text)) continue;
      if (!dataRe.test(text)) continue;
      // Must be reasonably sized (not the whole page, not tiny)
      if (text.length < 20 || text.length > 3000) continue;

      // Get the heading inside this element if any
      const heading = el.querySelector('h1,h2,h3,h4,h5,h6,[class*="title"],[class*="name"],[class*="heading"]');
      const headingText = heading ? heading.innerText.trim() : '';

      results.push({ text: text.trim(), heading: headingText });
    }

    // Deduplicate by text content
    const seen = new Set();
    return results.filter(({ text }) => {
      const key = text.slice(0, 100);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
}

function cleanName(raw) {
  return raw
    .replace(/\n[\s\S]*/g, '')           // keep only first line
    .replace(/€[\d.,]+(?:\/mo|\s*per\s*month|\s*pm)?/gi, '') // strip prices
    .replace(/\/mo[\s\S]*/gi, '')         // strip /mo and everything after
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseBlock(block, carrierConfig) {
  const { text, heading } = block;

  // Skip non-plan blocks: prepay, add-ons, call packs, accessories
  if (/\bprepay\b|\btop.?up\b|\bpay.as.you.go\b|\bPAYG\b|\badd.?on\b|\bbolt.?on\b|\bcall.?pack\b|\binternational.?pack\b|\broaming.?pack\b|\bdevice\b|\bhandset\b/i.test(text.slice(0, 400))) return null;

  // No heading filter for promo codes — these ARE real plans (e.g. Three's FREEDOM14 deal).
  // We fix the name below if it starts with "USE CODE ...".

  // Must mention data/calls/SIM to be a plan block
  if (!/\bdata\b|\bGB\b|\bunlimited\b|\bSIM\b|\bcalls?\b/i.test(text)) return null;

  const priceRe = /€\s*(\d+(?:\.\d{1,2})?)/g;
  const prices = [];
  let m;
  while ((m = priceRe.exec(text)) !== null) {
    prices.push(parseFloat(m[1]));
  }

  // Bill pay SIM plans in Ireland: €9–€80. Anything below €9 is an add-on or accessory price.
  const validPrices = prices.filter((p) => p >= 9 && p <= 80);
  if (validPrices.length === 0) return null;

  const minPrice = Math.min(...validPrices);
  const maxPrice = Math.max(...validPrices);

  let priceEur = minPrice;
  let promoPrice = null;

  // Two distinct prices → higher is standard, lower is promo
  if (validPrices.length >= 2 && maxPrice !== minPrice) {
    // Treat as promo if there's an explicit promo signal OR a "for X months / thereafter" structure
    const hasPromoSignal = /\bwas\b|\bnow\b|\bsave\b|\bpreviously\b|\bstrike|<s>|strikethrough|\bfor\s+(?:the\s+)?first\s+\d+\s*months?\b|\bthereafter\b|\bafter\s+\d+\s*months?\b|\bthen\s+€/i.test(text);
    if (hasPromoSignal) {
      priceEur = maxPrice;
      promoPrice = minPrice;
    } else {
      priceEur = minPrice;
    }
  }

  // Data — try "Unlimited" first, then XGB
  const unlimitedMatch = /\bunlimited\s+data\b|\bdata[:\s]+unlimited\b|\ball\s+you\s+can\s+eat\b/i.test(text);
  const dataMatch = text.match(/(\d+)\s*GB/i);
  const dataGB = unlimitedMatch ? 9999 : (dataMatch ? parseInt(dataMatch[1], 10) : null);
  const dataDisplay = dataGB === 9999 ? 'Unlimited' : (dataGB ? `${dataGB}GB` : 'Unknown');

  // Contract
  let contractType = '30-day rolling';
  if (/24.month|24\s*month/i.test(text)) contractType = '24-month';
  else if (/12.month|12\s*month/i.test(text)) contractType = '12-month';

  // 5G
  const is5G = /\b5G\b/.test(text);

  // Calls / texts — handle patterns like "150 any network minutes" or "UNLIMITED any network minutes"
  const unlimitedCalls = /unlimited\s+(?:\w+\s+){0,2}(?:calls?|minutes?)/i.test(text)
    || /(?:calls?|minutes?)[:\s]+unlimited/i.test(text);
  // Match "150 any network minutes" or plain "150 minutes" — strip commas for "5,000"
  const minutesMatch = text.match(/(\d[\d,]*)\s+(?:\w+\s+){0,3}(?:calls?|minutes?)/i)
    || text.match(/(\d+)\s*minutes?/i);
  const rawMinutes = minutesMatch ? parseInt(minutesMatch[1].replace(/,/g, ''), 10) : null;
  // Large allowances (≥1000) are effectively unlimited
  const minutes = unlimitedCalls ? 'Unlimited'
    : rawMinutes !== null ? (rawMinutes >= 1000 ? 'Unlimited' : String(rawMinutes))
    : 'Unlimited';

  const unlimitedSMS = /unlimited\s+(?:\w+\s+){0,2}(?:texts?|sms|messages?)/i.test(text)
    || /(?:texts?|sms|messages?)[:\s]+unlimited/i.test(text);
  const smsMatch = text.match(/(\d[\d,]*)\s+(?:\w+\s+){0,3}(?:texts?|sms|messages?)/i)
    || text.match(/(\d+)\s*(?:texts?|sms|messages?)/i);
  const rawSMS = smsMatch ? parseInt(smsMatch[1].replace(/,/g, ''), 10) : null;
  const sms = unlimitedSMS ? 'Unlimited'
    : rawSMS !== null ? (rawSMS >= 1000 ? 'Unlimited' : String(rawSMS))
    : 'Unlimited';

  // Roaming
  const roaming = /EU\s+roaming|roam(?:ing)?\s+(?:in\s+)?EU/i.test(text)
    ? 'EU roaming included' : 'No roaming';

  // Free month / for life
  const freeMonth = /free\s+month|1\s+month\s+free|first\s+month\s+free/i.test(text);
  const forLife = /for\s+life|forever|always\s+€|price\s+for\s+life/i.test(text);

  // Promo note
  let promoNote = null;
  if (freeMonth) {
    promoNote = 'First month free';
  } else if (forLife && promoPrice === null) {
    promoNote = 'Price for life';
  } else if (promoPrice !== null) {
    const noteMatch = text.match(/for\s+(?:the\s+)?first\s+\d+\s*months?|for\s+\d+\s*months?|first\s+\d+\s*months?|for\s+life|forever|introductory/i);
    promoNote = noteMatch ? noteMatch[0].trim() : 'Limited time offer';
  }

  // Plan name
  let name = '';
  if (heading && heading.length > 3) {
    name = cleanName(heading);
  }
  if (!name || name.length < 3) {
    const titleMatch = text.match(/^([A-Z][A-Za-z0-9 &+\-]{2,50})/);
    if (titleMatch) name = cleanName(titleMatch[1]);
  }
  if (!name || name.length < 3) {
    name = dataGB === 9999 ? 'Unlimited Plan'
      : dataGB ? `${dataGB}GB Plan`
      : `€${priceEur}/mo Plan`;
  }
  if (name.length > 55) name = name.slice(0, 55).replace(/\s+\S*$/, '…');

  // If name looks like a promo code instruction, replace with a descriptive name
  if (/^\s*use\s+code\b/i.test(name)) {
    name = dataGB === 9999 ? 'Unlimited 5G Deal'
      : dataGB ? `${dataGB}GB Deal`
      : `€${promoPrice ?? priceEur}/mo Deal`;
  }

  return {
    carrier: carrierConfig.carrier,
    carrierDisplay: carrierConfig.carrierDisplay,
    name,
    priceEur,
    promoPrice,
    promoNote,
    dataGB: dataGB ?? 0,
    dataDisplay,
    minutes,
    sms,
    is5G,
    isUnlimited: dataGB === 9999,
    roaming,
    contractType,
    extras: is5G ? ['5G'] : [],
    url: carrierConfig.url,
    network: carrierConfig.network,
    hasPromo: promoPrice !== null || freeMonth,
    freeMonth,
    forLife,
    unlimitedCalls,
  };
}

async function scrapeCarrier(page, carrierConfig) {
  console.log(`Scraping ${carrierConfig.carrierDisplay}...`);

  try {
    await page.goto(carrierConfig.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Dismiss cookie banners
    await sleep(1500);
    try {
      const cookieBtn = await page.$([
        'button:has-text("Accept All")', 'button:has-text("Accept Cookies")',
        'button:has-text("Accept all")', '#onetrust-accept-btn-handler',
        '[aria-label*="Accept"]',
      ].join(', '));
      if (cookieBtn) { await cookieBtn.click(); await sleep(500); }
    } catch { /* no cookie banner */ }

    // Wait for JS-rendered content, then scroll to trigger lazy loading
    await sleep(2500 + (carrierConfig.extraWait ?? 0));
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight * 0.4);
    });
    await sleep(800);
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight * 0.8);
    });
    await sleep(800);
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await sleep(500);

    // Try structured extraction first
    const blocks = await getStructuredPlans(page);

    if (blocks.length > 0) {
      const plans = blocks
        .map((b) => parseBlock(b, carrierConfig))
        .filter(Boolean);

      // Deduplicate by price+data combo
      const seen = new Set();
      const unique = plans.filter((p) => {
        const key = `${p.priceEur}-${p.promoPrice}-${p.dataGB}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (unique.length > 0) {
        console.log(`  Found ${unique.length} plans for ${carrierConfig.carrierDisplay} (structured)`);
        return unique;
      }
    }

    // Fallback: clean text regex extraction
    const text = await getCleanText(page);
    const plans = parseFallback(text, carrierConfig);
    console.log(`  Found ${plans.length} plans for ${carrierConfig.carrierDisplay} (text fallback)`);
    return plans;
  } catch (err) {
    console.warn(`  Failed to scrape ${carrierConfig.carrierDisplay}: ${err.message}`);
    return [];
  }
}

function parseFallback(text, carrierConfig) {
  // Strip prepay sections from text before parsing
  const clean = text
    .replace(/prepay[\s\S]{0,2000}(?=bill\s*pay|sim.only|\n\n\n)/gi, '')
    .replace(/\s+/g, ' ');
  const priceRe = /€\s*(\d+(?:\.\d{1,2})?)/g;
  const plans = [];
  const seen = new Set();
  const thereafterMergedPrices = new Set(); // prices absorbed into a thereafter plan — exclude from individual loop
  let m;

  // First pass: look for "€X [a month] for Y months, €Z thereafter/after that" and emit ONE merged plan
  const thereafterSentenceRe = /€\s*(\d+(?:\.\d{1,2})?)\s+(?:a\s+month\s+)?for\s+(\d+)\s+months?\s*[,.]?\s*€\s*(\d+(?:\.\d{1,2})?)\s+(?:thereafter|after\s+that|after)([^.€]*)/gi;
  let ts;
  while ((ts = thereafterSentenceRe.exec(clean)) !== null) {
    const promoP = parseFloat(ts[1]);
    const months = ts[2];
    const standardP = parseFloat(ts[3]);
    const suffix = ts[4];
    if (promoP < 9 || standardP < 9 || promoP > 80 || standardP > 80) continue;

    const freeMonth = /free\s+month|1\s+month\s+free/i.test(suffix);
    const nearby = clean.slice(Math.max(0, ts.index - 400), ts.index + 400);

    // Check for unlimited data before looking for any GB figure
    const unlimitedDataNearby = /\bunlimited\s+(?:5G\s+)?data\b|\bdata[:\s]+unlimited\b/i.test(nearby);
    // Find a GB figure NOT followed by "roaming", "EU", or "of your data" — those are roaming allowances
    const nonRoamingGBMatch = nearby.match(/(\d+)\s*GB(?!\s*(?:roaming|EU|of\s+your))/i);
    const dataGB = unlimitedDataNearby ? 9999
      : nonRoamingGBMatch ? parseInt(nonRoamingGBMatch[1], 10)
      : null;

    // Contract type from nearby context
    const contractType = /24.month|24\s*month/i.test(nearby) ? '24-month'
      : /12.month|12\s*month/i.test(nearby) ? '12-month'
      : '30-day rolling';

    const is5G = /\b5G\b/.test(nearby);

    // Roaming: handle "roaming in Europe" and "80GB roaming" as well as "EU roaming"
    const hasEURoaming = /EU\s+roaming|roaming\s+in\s+Europe|\d+\s*GB\s+(?:EU\s+)?roaming/i.test(nearby);

    // Try to extract a plan name from context (e.g. "€20 a month with Ultra SIM Only")
    const nameMatch = nearby.match(/with\s+([A-Z][A-Za-z0-9 ]{3,40}SIM[A-Za-z0-9 ]*)/i)
      || nearby.match(/([A-Z][A-Za-z0-9 ]{2,30}SIM\s*Only)/i);
    const planName = nameMatch ? nameMatch[1].trim()
      : dataGB === 9999 ? 'Unlimited SIM Only'
      : dataGB ? `${dataGB}GB SIM Only`
      : 'SIM Only';

    // Mark both prices so the individual price loop skips them entirely (regardless of dataGB context)
    thereafterMergedPrices.add(promoP);
    thereafterMergedPrices.add(standardP);

    plans.push({
      carrier: carrierConfig.carrier,
      carrierDisplay: carrierConfig.carrierDisplay,
      name: planName,
      priceEur: standardP,
      promoPrice: promoP,
      promoNote: `First ${months} months`,
      dataGB: dataGB ?? 0,
      dataDisplay: dataGB === 9999 ? 'Unlimited' : dataGB ? `${dataGB}GB` : 'Unknown',
      minutes: 'Unlimited',
      sms: 'Unlimited',
      is5G,
      isUnlimited: dataGB === 9999,
      roaming: hasEURoaming ? 'EU roaming included' : 'No roaming',
      contractType,
      extras: is5G ? ['5G'] : [],
      url: carrierConfig.url,
      network: carrierConfig.network,
      hasPromo: true,
      freeMonth,
      forLife: false,
      unlimitedCalls: /unlimited\s+(?:\w+\s+){0,2}(?:calls?|minutes?)/i.test(nearby),
    });
  }

  while ((m = priceRe.exec(clean)) !== null) {
    const price = parseFloat(m[1]);
    if (price < 9 || price > 80) continue;

    // Skip prices already captured by a "thereafter" merged plan
    if (thereafterMergedPrices.has(price)) continue;

    const start = Math.max(0, m.index - 250);
    const end = Math.min(clean.length, m.index + 250);
    const window = clean.slice(start, end);

    // Skip add-on / discount / credit / family cross-sell contexts
    if (/\badd.?on\b|\bbolt.?on\b|\bcall.?pack\b|\binternational.?pack\b|\bdevice\b|\bhandset\b|\bsave\s+€|\b€\s*\d+\s+off\b|\b€\s*\d+\s+credit\b|\bget\s+€\s*\d+\b|\bworth\s+€|\bfamily\s+plan\b|\bfrom\s+€\s*\d+\s+a\s+month\b/i.test(window)) continue;

    // Must have a plan signal in context
    if (!/\bdata\b|\bGB\b|\bunlimited\b|\bSIM\b/i.test(window)) continue;

    // Price must appear in a monthly pricing context somewhere in the surrounding window.
    // This filters out "save €10", "€10 credit" etc. that don't have a per-month signal nearby.
    const monthlyRe = new RegExp(`€\\s*${price.toString().replace('.', '\\.')}\\s*(?:\\/mo|\\/month|per\\s+month|a\\s+month|\\s+pm\\b|\\s+monthly|\\s+per\\s+mo)`, 'i');
    const hasMonthlyContext = monthlyRe.test(window)
      || /(?:per\s+month|a\s+month|\/month|\/mo|\bmonthly\b|\bper\s+mo\b)/.test(window);
    if (!hasMonthlyContext) continue;

    const dataMatch = window.match(/(\d+)\s*GB/i);
    const unlimitedMatch = /\bunlimited\s+data\b/i.test(window);
    const dataGB = unlimitedMatch ? 9999 : (dataMatch ? parseInt(dataMatch[1], 10) : null);
    const key = `${price}-${dataGB}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const name = dataGB === 9999 ? 'Unlimited Plan'
      : dataGB ? `${dataGB}GB Plan`
      : `€${price}/mo Plan`;

    const is5G = /\b5G\b/.test(window);
    const contractType = /24.month/i.test(window) ? '24-month'
      : /12.month/i.test(window) ? '12-month' : '30-day rolling';
    const unlimitedCalls = /unlimited\s+(?:\w+\s+){0,2}(?:calls?|minutes?)/i.test(window)
      || /(?:calls?|minutes?)[:\s]+unlimited/i.test(window);
    const fbMinutesMatch = window.match(/(\d[\d,]*)\s+(?:\w+\s+){0,3}(?:calls?|minutes?)/i)
      || window.match(/(\d+)\s*minutes?/i);
    const fbRawMinutes = fbMinutesMatch ? parseInt(fbMinutesMatch[1].replace(/,/g, ''), 10) : null;
    const unlimitedSMSFb = /unlimited\s+(?:\w+\s+){0,2}(?:texts?|sms|messages?)/i.test(window)
      || /(?:texts?|sms|messages?)[:\s]+unlimited/i.test(window);
    const fbSmsMatch = window.match(/(\d[\d,]*)\s+(?:\w+\s+){0,3}(?:texts?|sms|messages?)/i)
      || window.match(/(\d+)\s*(?:texts?|sms|messages?)/i);
    const fbRawSMS = fbSmsMatch ? parseInt(fbSmsMatch[1].replace(/,/g, ''), 10) : null;
    const roaming = /EU\s+roaming/i.test(window) ? 'EU roaming included' : 'No roaming';
    const freeMonth = /free\s+month/i.test(window);

    plans.push({
      carrier: carrierConfig.carrier,
      carrierDisplay: carrierConfig.carrierDisplay,
      name,
      priceEur: price,
      promoPrice: null,
      promoNote: null,
      dataGB: dataGB ?? 0,
      dataDisplay: dataGB === 9999 ? 'Unlimited' : dataGB ? `${dataGB}GB` : 'Unknown',
      minutes: unlimitedCalls ? 'Unlimited'
        : fbRawMinutes !== null ? (fbRawMinutes >= 1000 ? 'Unlimited' : String(fbRawMinutes))
        : 'Unlimited',
      sms: unlimitedSMSFb ? 'Unlimited'
        : fbRawSMS !== null ? (fbRawSMS >= 1000 ? 'Unlimited' : String(fbRawSMS))
        : 'Unlimited',
      is5G,
      isUnlimited: dataGB === 9999,
      roaming,
      contractType,
      extras: is5G ? ['5G'] : [],
      url: carrierConfig.url,
      network: carrierConfig.network,
      hasPromo: freeMonth,
      freeMonth,
      forLife: false,
      unlimitedCalls,
    });
  }

  return plans;
}

function detectChanges(oldPlans, newPlans) {
  const oldMap = new Map(oldPlans.map((p) => [`${p.carrier}:${p.name}`, p]));
  const newMap = new Map(newPlans.map((p) => [`${p.carrier}:${p.name}`, p]));

  const added = [];
  const removed = [];
  const changed = [];

  for (const [key, newPlan] of newMap) {
    if (!oldMap.has(key)) {
      added.push(newPlan);
    } else {
      const oldPlan = oldMap.get(key);
      const diffs = {};
      for (const field of ['priceEur', 'promoPrice', 'promoNote', 'dataGB', 'is5G', 'contractType', 'roaming']) {
        if (oldPlan[field] !== newPlan[field]) {
          diffs[field] = { from: oldPlan[field], to: newPlan[field] };
        }
      }
      if (Object.keys(diffs).length > 0) changed.push({ plan: newPlan, diffs });
    }
  }

  for (const [key, oldPlan] of oldMap) {
    if (!newMap.has(key)) removed.push(oldPlan);
  }

  return { added, removed, changed };
}

async function main() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  const plansPath = join(DATA_DIR, 'plans.json');
  const changesPath = join(DATA_DIR, 'latest-changes.json');
  const historyPath = join(DATA_DIR, 'history.json');

  const oldPlans = existsSync(plansPath) ? JSON.parse(readFileSync(plansPath, 'utf8')) : [];

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-IE',
  });

  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const newPlans = [];
  for (const carrier of CARRIERS) {
    const plans = await scrapeCarrier(page, carrier);
    newPlans.push(...plans);
    await sleep(2000);
  }

  await browser.close();

  if (newPlans.length === 0) {
    console.error('No plans scraped — aborting');
    process.exit(1);
  }

  const { added, removed, changed } = detectChanges(oldPlans, newPlans);
  const hasChanges = added.length > 0 || removed.length > 0 || changed.length > 0;

  writeFileSync(plansPath, JSON.stringify(newPlans, null, 2));
  console.log(`Wrote ${newPlans.length} plans to data/plans.json`);

  const changeReport = {
    timestamp: new Date().toISOString(),
    hasChanges,
    summary: { added: added.length, removed: removed.length, changed: changed.length },
    added,
    removed,
    changed,
  };
  writeFileSync(changesPath, JSON.stringify(changeReport, null, 2));

  // Cheapest effective acquisition price per carrier (for history charting)
  const carrierPrices = {};
  for (const plan of newPlans) {
    const effPrice = plan.promoPrice ?? plan.priceEur;
    if (carrierPrices[plan.carrier] == null || effPrice < carrierPrices[plan.carrier]) {
      carrierPrices[plan.carrier] = effPrice;
    }
  }

  const history = existsSync(historyPath) ? JSON.parse(readFileSync(historyPath, 'utf8')) : [];
  history.unshift({
    timestamp: changeReport.timestamp,
    planCount: newPlans.length,
    summary: changeReport.summary,
    carrierPrices,
  });
  if (history.length > 90) history.splice(90);
  writeFileSync(historyPath, JSON.stringify(history, null, 2));

  if (hasChanges) {
    console.log(`Changes: +${added.length} added, -${removed.length} removed, ~${changed.length} changed`);
    process.exit(2);
  } else {
    console.log('No changes detected');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
