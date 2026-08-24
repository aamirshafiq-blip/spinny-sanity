/**
 * Debug script — visits the Spinny PLP and dumps:
 *  1. All XHR/fetch URLs intercepted
 *  2. Relevant DOM selectors found
 * Run: node scripts/debug-page.js
 */

const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });

  const captured = [];
  page.on('response', async (res) => {
    try {
      const type = res.request().resourceType();
      if (!['xhr', 'fetch'].includes(type)) return;
      const url = res.url();
      captured.push({ url, status: res.status() });
    } catch (_) {}
  });

  console.log('\n=== visiting /used-cars/delhi/ ===');
  await page.goto('https://www.spinny.com/used-cars/delhi/', {
    waitUntil: 'networkidle',
    timeout: 60000,
  });

  console.log('\n--- XHR / fetch calls intercepted ---');
  if (captured.length === 0) {
    console.log('  (none — page is likely SSR/Next.js with no client-side API calls)');
  }
  captured.forEach((r) => console.log(`  [${r.status}] ${r.url.slice(0, 120)}`));

  // dump relevant text snippet
  const bodySnippet = await page.locator('body').innerText();
  const lines = bodySnippet.split('\n').filter(l => l.trim()).slice(0, 60);
  console.log('\n--- first 60 non-empty lines of body text ---');
  lines.forEach((l, i) => console.log(`  ${i + 1}: ${l.trim()}`));

  // check price pattern
  console.log('\n--- price pattern check ---');
  const hasRupee = /₹/.test(bodySnippet);
  const hasLakh = /\d+\.\d+\s*Lakh/i.test(bodySnippet);
  const hasLakhOnwards = /Lakhonwards/i.test(bodySnippet);
  console.log('  ₹ symbol:', hasRupee);
  console.log('  X.XX Lakh:', hasLakh);
  console.log('  Lakhonwards:', hasLakhOnwards);

  // check km pattern
  console.log('\n--- km pattern check ---');
  const hasKm = /\d[\d,]+\s*km/i.test(bodySnippet);
  console.log('  digits+km:', hasKm);

  // try to find actual car card links
  const cardLinks = await page.locator('a[href*="/used-"]').count();
  console.log('\n--- a[href*="/used-"] count:', cardLinks);

  // look for filter-like elements
  const filterCount = await page.locator('[class*="filter" i]').count();
  console.log('--- [class*="filter"] count:', filterCount);

  await browser.close();
})();
