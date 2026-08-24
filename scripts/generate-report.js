/**
 * Reads test-results/results.json (Playwright JSON output)
 * and writes reports/<YYYY-MM-DD_HH-MM>/report.html + meta.json
 * Screenshots are embedded as base64 — fully self-contained HTML.
 * Categories: ui (UI-XX), filter (FLT-XX), city (CITY-XX), api (API-XX)
 */

const fs   = require('fs');
const path = require('path');

const resultsPath = path.join(__dirname, '..', 'test-results', 'results.json');
const reportsDir  = path.join(__dirname, '..', 'reports');

if (!fs.existsSync(resultsPath)) {
  console.error('results.json not found — run playwright test first');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

// ── constants ────────────────────────────────────────────────────────────────

const deviceOrder = ['Desktop', 'Android', 'iOS'];
const deviceEmoji = { Desktop: '🖥️', Android: '📱', iOS: '🍎' };
const deviceLabel = { Desktop: 'Desktop (1280×800)', Android: 'Android Pixel 5', iOS: 'iOS iPhone 12' };

const categoryOrder = ['ui', 'filter', 'city', 'api'];
const categoryConfig = {
  ui:     { label: 'UI Tests',     sectionTitle: '📋 UI Tests — click any row to expand screenshot & details',     color: '#6366f1', headerLabel: 'UI Tests' },
  filter: { label: 'Filter Tests', sectionTitle: '🔍 Filter Tests — click any row to expand screenshot & details', color: '#f59e0b', headerLabel: 'Filter Tests' },
  city:   { label: 'City Tests',   sectionTitle: '🏙️ City Tests — click any row to expand screenshot & details',  color: '#10b981', headerLabel: 'City Tests' },
  api:    { label: 'API Tests',    sectionTitle: '🔌 API Tests — click any row to expand screenshot & details',    color: '#3b82f6', headerLabel: 'API Tests' },
};

const testDescriptions = {
  'UI-01: Page loads with HTTP 2xx':
    'Navigates to spinny.com/used-cars/delhi/ and verifies the page responds with HTTP 2xx.',
  'UI-02: Page title contains "Used Cars"':
    'Checks the browser tab title contains "Used Cars", confirming the correct page loaded.',
  'UI-03: At least 4 car listing cards visible':
    'Counts car listing cards (links to /buy-used-cars/). At least 4 must be visible.',
  'UI-04: Car cards contain price (₹ or Lakh)':
    'Reads car card text and verifies at least one card shows a price with ₹ or "Lakh".',
  'UI-05: Car cards contain KM / mileage info':
    'Reads car card text and verifies at least one card shows odometer/mileage (km or KM).',
  'UI-06: Filter section is visible (Price Range)':
    'Checks the filter panel is rendered and contains the "Price Range" filter.',
  'UI-07: Sort / search-by-price option is present':
    'Checks that a sort or "Search by price" control exists on the page.',
  'UI-08: Car images load without errors':
    'Finds all <img> tags inside car cards and verifies each loaded (naturalWidth > 0).',
  'UI-09: No critical JS errors on load':
    'Monitors browser console for JavaScript errors during page load.',
  'UI-10: Page scroll loads more car cards (lazy load / pagination)':
    'Counts car cards before and after scrolling to the bottom. More cards must appear.',
  'UI-11: Car model names visible on listing cards':
    'Verifies the first car card has visible text content (model name present).',
  'UI-12: Year of manufacture visible on car cards':
    'Checks that a year between 2015–2026 appears on the listing page.',
  'UI-13: EMI / monthly payment info present':
    'Checks that EMI or monthly payment information is visible on the page.',
  'UI-14: Total car listing count displayed on page':
    'Verifies a total car count number is shown (e.g. "1,234 Used Cars").',
  'UI-15: Transmission type visible on car cards':
    'Checks that Automatic / Manual / AMT / CVT transmission type is shown on cards.',
  'UI-16: H1 heading contains city name or "Used Cars"':
    'Verifies the H1 heading references the city or "Used Cars" for SEO correctness.',
  'UI-17: Breadcrumb navigation present':
    'Checks that a breadcrumb trail (e.g. Home > Used Cars > Delhi) is present.',
  'UI-18: Meta description tag present and non-empty':
    'Verifies the page has a meta description tag with meaningful content.',
  'UI-19: Canonical URL tag present and points to spinny.com':
    'Checks that the canonical link tag is set and references spinny.com.',
  'UI-20: Footer content loaded after scroll':
    'Scrolls to the bottom and verifies footer content (copyright/privacy links) is present.',
  'UI-21: Banner or promotional widget section present':
    'Checks for banner, promo, widget or carousel sections on the page.',
  'UI-22: Car card links follow /buy-used-cars/ URL pattern':
    'Verifies car card links use the standard /buy-used-cars/{city}/{make}/{model} pattern.',
  'UI-23: Shortlist / heart / save icon visible on car cards':
    'Checks that a shortlist or wishlist icon is visible on car listing cards.',
  'UI-24: Deep scroll (2×) loads additional car cards':
    'Scrolls twice to the bottom and verifies car cards remain visible (pagination/lazy-load).',
  'UI-25: City name "Delhi" present in page content':
    'Verifies the city name "Delhi" appears somewhere on the PLP.',
  'FLT-01: Filter section / panel is present on PLP':
    'Checks that the filter section or "Filter" button is accessible on the PLP.',
  'FLT-02: Multiple filter categories present (≥2 of Budget/Fuel/Body/KM/Transmission)':
    'Verifies at least 2 filter category labels are visible on the page.',
  'FLT-03: Fuel type filter options visible (Petrol / Diesel / CNG / Electric)':
    'Checks that at least one fuel type option (Petrol/Diesel/CNG/Electric) is visible.',
  'FLT-04: Body type filter options visible (Sedan / SUV / Hatchback)':
    'Checks that at least one body type option is visible in the filter section.',
  'FLT-05: KM Driven / Odometer filter option present':
    'Verifies a KM Driven or odometer range filter exists on the page.',
  'FLT-06: Transmission filter option visible (Automatic / Manual)':
    'Checks that Automatic or Manual transmission filter options are visible.',
  'FLT-07: "All Filters" or "More Filters" button accessible':
    'Verifies the "All Filters" or equivalent button is accessible (or sidebar is open on desktop).',
  'FLT-08: Applying Petrol fuel filter updates listing without crash':
    'Clicks the Petrol fuel filter and verifies the listing updates without crashing.',
  'FLT-09: Opening filter drawer on mobile and closing returns to listing':
    'Opens the filter drawer (mobile) and closes it; verifies the listing is still visible.',
  'FLT-10: Pre-filtered URL (fuel_type=petrol) loads cars correctly':
    'Navigates directly to /used-cars/delhi/?fuel_type=petrol and verifies cars load.',
  'FLT-11: Pre-filtered URL (body_type=suv) loads cars correctly':
    'Navigates directly to /used-cars/delhi/?body_type=suv and verifies cars load.',
  'FLT-12: Pre-filtered URL (transmission=automatic) loads cars correctly':
    'Navigates directly to /used-cars/delhi/?transmission=automatic and verifies cars load.',
  'FLT-13: Filtered listing count differs from unfiltered count':
    'Compares unfiltered vs. Petrol-filtered car counts to confirm filters actually work end-to-end.',
  'FLT-14: Filter API call includes city slug in request URL':
    'Intercepts the listing API call on a filtered page and verifies "delhi" is in the request URL.',
  'FLT-15: Filter page HTTP response is 2xx (no redirect loop on filtered URL)':
    'Navigates to a filtered URL and verifies the server returns HTTP 2xx (no redirect loops).',
  'API-01: Listing API (api.spinny.com/listing) returns HTTP 200':
    'Intercepts network calls and checks the Spinny listing API returns HTTP 200.',
  'API-02: Listing API response time < 10s':
    'Measures listing API response time and verifies it is under 10 seconds.',
  'API-03: Listing API response body contains car data':
    'Parses the listing API JSON response and verifies it contains car data.',
  'API-04: No 5xx errors on any XHR/fetch call':
    'Monitors all network requests and checks none returned a 5xx server error.',
  'API-05: Page fully loads within 30s':
    'Verifies the entire page finishes loading within 30 seconds.',
  'API-06: Listing API car count in response > 0':
    'Reads the count/total field from the listing API response and verifies it is > 0.',
  'API-07: City slug "delhi" present in listing API request URL':
    'Verifies the listing API call URL includes the city slug "delhi".',
  'API-08: No 4xx client errors (excluding 401) on any XHR/fetch call':
    'Checks no 4xx errors occur (401 Unauthorized for unauthenticated users is excluded).',
  'API-09: Multiple API calls made during page load':
    'Verifies the page makes more than one call to api.spinny.com (listing + banners + widgets).',
  'API-10: Listing API response body is not empty object':
    'Checks that the listing API returned a body with at least one key.',
  'API-11: Mobile listing API response time ≤ 15s':
    'Verifies listing API responds within 10s on Desktop and 15s on Android/iOS.',
};

const shortNames = {
  'UI-01: Page loads with HTTP 2xx':                                        'Page loads (HTTP 2xx)',
  'UI-02: Page title contains "Used Cars"':                                 'Title contains "Used Cars"',
  'UI-03: At least 4 car listing cards visible':                            '≥4 car cards visible',
  'UI-04: Car cards contain price (₹ or Lakh)':                        'Price (₹/Lakh) shown',
  'UI-05: Car cards contain KM / mileage info':                             'KM info shown',
  'UI-06: Filter section is visible (Price Range)':                         'Filter section visible',
  'UI-07: Sort / search-by-price option is present':                        'Sort option present',
  'UI-08: Car images load without errors':                                  'No broken images',
  'UI-09: No critical JS errors on load':                                   'No critical JS errors',
  'UI-10: Page scroll loads more car cards (lazy load / pagination)':       'Scroll loads more cars',
  'UI-11: Car model names visible on listing cards':                        'Model names visible',
  'UI-12: Year of manufacture visible on car cards':                        'Year visible',
  'UI-13: EMI / monthly payment info present':                              'EMI info present',
  'UI-14: Total car listing count displayed on page':                       'Car count shown',
  'UI-15: Transmission type visible on car cards':                          'Transmission visible',
  'UI-16: H1 heading contains city name or "Used Cars"':                    'H1 heading correct',
  'UI-17: Breadcrumb navigation present':                                   'Breadcrumb present',
  'UI-18: Meta description tag present and non-empty':                      'Meta description OK',
  'UI-19: Canonical URL tag present and points to spinny.com':              'Canonical URL OK',
  'UI-20: Footer content loaded after scroll':                              'Footer loaded',
  'UI-21: Banner or promotional widget section present':                    'Banners/widgets present',
  'UI-22: Car card links follow /buy-used-cars/ URL pattern':               'Card links correct',
  'UI-23: Shortlist / heart / save icon visible on car cards':              'Shortlist icon visible',
  'UI-24: Deep scroll (2×) loads additional car cards':                     'Deep scroll works',
  'UI-25: City name "Delhi" present in page content':                       'City name shown',
  'FLT-01: Filter section / panel is present on PLP':                       'Filter panel present',
  'FLT-02: Multiple filter categories present (≥2 of Budget/Fuel/Body/KM/Transmission)': 'Filter categories ≥2',
  'FLT-03: Fuel type filter options visible (Petrol / Diesel / CNG / Electric)': 'Fuel type options',
  'FLT-04: Body type filter options visible (Sedan / SUV / Hatchback)':     'Body type options',
  'FLT-05: KM Driven / Odometer filter option present':                     'KM Driven filter',
  'FLT-06: Transmission filter option visible (Automatic / Manual)':        'Transmission filter',
  'FLT-07: "All Filters" or "More Filters" button accessible':              '"All Filters" accessible',
  'FLT-08: Applying Petrol fuel filter updates listing without crash':       'Petrol filter applies',
  'FLT-09: Opening filter drawer on mobile and closing returns to listing':  'Filter drawer open/close',
  'FLT-10: Pre-filtered URL (fuel_type=petrol) loads cars correctly':        'Petrol URL loads',
  'FLT-11: Pre-filtered URL (body_type=suv) loads cars correctly':           'SUV URL loads',
  'FLT-12: Pre-filtered URL (transmission=automatic) loads cars correctly':  'Automatic URL loads',
  'FLT-13: Filtered listing count differs from unfiltered count':            'Filter changes count',
  'FLT-14: Filter API call includes city slug in request URL':               'Filter API has city',
  'FLT-15: Filter page HTTP response is 2xx (no redirect loop on filtered URL)': 'Filtered URL = 2xx',
  'API-01: Listing API (api.spinny.com/listing) returns HTTP 200':          'Listing API -> HTTP 200',
  'API-02: Listing API response time < 10s':                                'API response time < 10s',
  'API-03: Listing API response body contains car data':                    'Response has car data',
  'API-04: No 5xx errors on any XHR/fetch call':                            'No 5xx server errors',
  'API-05: Page fully loads within 30s':                                    'Full page load < 30s',
  'API-06: Listing API car count in response > 0':                          'API count > 0',
  'API-07: City slug "delhi" present in listing API request URL':            'City in API URL',
  'API-08: No 4xx client errors (excluding 401) on any XHR/fetch call':     'No 4xx errors (excl. 401)',
  'API-09: Multiple API calls made during page load':                        'Multiple API calls',
  'API-10: Listing API response body is not empty object':                   'API body non-empty',
  'API-11: Mobile listing API response time ≤ 15s':                         'Mobile API ≤ 15s',
};

// ── parse results ────────────────────────────────────────────────────────────

function collectSpecs(suites) {
  const specs = [];
  for (const suite of suites || []) {
    for (const spec of suite.specs || []) specs.push(spec);
    specs.push(...collectSpecs(suite.suites));
  }
  return specs;
}

function detectCategory(title) {
  if (title.startsWith('API'))  return 'api';
  if (title.startsWith('FLT'))  return 'filter';
  if (title.startsWith('CITY')) return 'city';
  return 'ui';
}

const allSpecs = collectSpecs(raw.suites);
const byDevice = {};
deviceOrder.forEach((d) => (byDevice[d] = { ui: [], api: [], filter: [], city: [] }));

for (const spec of allSpecs) {
  for (const test of spec.tests || []) {
    const device = test.projectName || 'Unknown';
    if (!byDevice[device]) byDevice[device] = { ui: [], api: [], filter: [], city: [] };

    const lastResult    = test.results?.[test.results.length - 1] || {};
    const rawStatus     = test.status;
    const status =
      rawStatus === 'expected'   ? 'passed' :
      rawStatus === 'unexpected' ? 'failed' :
      rawStatus;
    const duration       = lastResult.duration || 0;
    const errors         = (lastResult.errors || []).map((e) => e.message || '').join('\n');
    const screenshotAtch = (lastResult.attachments || []).find((a) => a.name === 'screenshot');
    const screenshotPath = screenshotAtch?.path || null;
    const title          = spec.title;
    const category       = detectCategory(title);

    if (byDevice[device][category]) {
      byDevice[device][category].push({ title, status, duration, errors, screenshotPath });
    }
  }
}

// ── summary numbers ──────────────────────────────────────────────────────────

function counts(arr) {
  const passed = arr.filter((t) => t.status === 'passed').length;
  const failed = arr.filter((t) => ['failed', 'unexpected'].includes(t.status)).length;
  const flaky  = arr.filter((t) => t.status === 'flaky').length;
  return { passed, failed, flaky, total: arr.length };
}

const summary = {};
for (const d of deviceOrder) {
  summary[d] = {};
  for (const cat of categoryOrder) {
    summary[d][cat] = counts(byDevice[d][cat]);
  }
}

const totalPassed = deviceOrder.reduce((s, d) =>
  s + categoryOrder.reduce((cs, cat) => cs + summary[d][cat].passed, 0), 0);
const totalFailed = deviceOrder.reduce((s, d) =>
  s + categoryOrder.reduce((cs, cat) => cs + summary[d][cat].failed, 0), 0);
const totalTests = deviceOrder.reduce((s, d) =>
  s + categoryOrder.reduce((cs, cat) => cs + summary[d][cat].total, 0), 0);

const runAt      = new Date();
const runLabel   = runAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
const folderName = runAt.toISOString().replace('T', '_').replace(/:/g, '-').slice(0, 16);
const outDir     = path.join(reportsDir, folderName);
fs.mkdirSync(outDir, { recursive: true });

// ── screenshot helpers ───────────────────────────────────────────────────────

function imgBase64(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try { return fs.readFileSync(filePath).toString('base64'); } catch { return null; }
}

const screenshotMap = {};
for (const dev of deviceOrder) {
  const allTests = categoryOrder.flatMap((cat) => byDevice[dev][cat]);
  for (const t of allTests) {
    if (t.screenshotPath) screenshotMap[`${t.title}::${dev}`] = imgBase64(t.screenshotPath);
  }
}

// ── HTML helpers ─────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function statusBadge(status) {
  const map = {
    passed:  '<span class="badge pass">PASS</span>',
    failed:  '<span class="badge fail">FAIL</span>',
    flaky:   '<span class="badge flaky">FLAKY</span>',
    skipped: '<span class="badge skip">SKIP</span>',
  };
  return map[status] || `<span class="badge">${escHtml(status)}</span>`;
}

// ── cross-device test rows ───────────────────────────────────────────────────

const masterTests = categoryOrder.flatMap((cat) => byDevice['Desktop'][cat]);

function buildTestRow(t) {
  const devices = {};
  for (const dev of deviceOrder) {
    const pool  = categoryOrder.flatMap((cat) => byDevice[dev][cat]);
    const match = pool.find((x) => x.title === t.title);
    devices[dev] = match
      ? { status: match.status, durationMs: match.duration, error: match.errors || null }
      : { status: 'skipped', durationMs: 0, error: null };
  }
  return {
    id:        t.title.split(':')[0],
    title:     shortNames[t.title] || t.title.replace(/^(UI|FLT|CITY|API)-\d+:\s*/, ''),
    fullTitle: t.title,
    category:  detectCategory(t.title),
    devices,
  };
}

const testRows = masterTests.map(buildTestRow);

// ── HTML test cards (expandable) ─────────────────────────────────────────────

function testCard(row) {
  const desc      = testDescriptions[row.fullTitle] || '';
  const anyFailed = deviceOrder.some((d) => row.devices[d].status === 'failed');
  const allPassed = deviceOrder.every((d) => row.devices[d].status === 'passed');
  const cardCls   = anyFailed ? 'test-card fail' : allPassed ? 'test-card pass' : 'test-card flaky';

  const badgesHtml = deviceOrder.map((d) => {
    const dev = row.devices[d];
    const dur = dev.durationMs ? `${(dev.durationMs / 1000).toFixed(1)}s` : '';
    return `<span class="dev-badge">${deviceEmoji[d]} ${statusBadge(dev.status)} <small>${dur}</small></span>`;
  }).join('');

  const screenshotsHtml = deviceOrder.map((d) => {
    const b64    = screenshotMap[`${row.fullTitle}::${d}`];
    const dev    = row.devices[d];
    const imgHtml = b64
      ? `<img src="data:image/png;base64,${b64}" alt="${d}" loading="lazy" />`
      : '<div class="no-ss">No screenshot</div>';
    const errHtml = dev.error
      ? `<pre class="ss-err">${escHtml(dev.error.replace(/\n\s+at\s+.*/g, '').trim().slice(0, 500))}</pre>`
      : '';
    return `<div class="ss-col">
      <div class="ss-lbl">${deviceEmoji[d]} ${escHtml(deviceLabel[d])}<br>${statusBadge(dev.status)}${dev.durationMs ? ` <small>${(dev.durationMs/1000).toFixed(1)}s</small>` : ''}</div>
      ${imgHtml}${errHtml}
    </div>`;
  }).join('');

  return `
<details class="${cardCls}">
  <summary class="test-summary">
    <span class="tid">${escHtml(row.id)}</span>
    <span class="ttitle">${escHtml(row.title)}</span>
    <span class="tbadges">${badgesHtml}</span>
    <span class="arrow">&#9654;</span>
  </summary>
  <div class="test-detail">
    <p class="test-what"><strong>What this tests:</strong> ${escHtml(desc)}</p>
    <div class="ss-row">${screenshotsHtml}</div>
  </div>
</details>`;
}

// ── failures for meta.json ───────────────────────────────────────────────────

const failures = [];
for (const dev of deviceOrder) {
  for (const t of categoryOrder.flatMap((cat) => byDevice[dev][cat])) {
    if (t.status === 'failed') {
      failures.push({
        device: dev,
        testId: t.title.split(':')[0],
        title:  shortNames[t.title] || t.title.replace(/^(UI|FLT|CITY|API)-\d+:\s*/, ''),
        error:  t.errors
          ? t.errors.replace(/\n\s+at\s+.*/g, '').trim().slice(0, 400)
          : 'Unknown error',
      });
    }
  }
}

// ── build HTML ───────────────────────────────────────────────────────────────

const overallClass = totalFailed === 0 ? 'overall-pass' : 'overall-fail';
const overallLabel = totalFailed === 0 ? '✅ All Passed' : `❌ ${totalFailed} Failed`;

const summaryRows = deviceOrder.map((d) => {
  const s  = summary[d];
  const ok = categoryOrder.every((cat) => s[cat].failed === 0);
  return `<tr class="${ok ? '' : 'row-fail'}">
    <td>${deviceEmoji[d]} ${d}</td>
    <td>${s.ui.passed}/${s.ui.total}</td>
    <td>${s.filter.passed}/${s.filter.total}</td>
    <td>${s.city.passed}/${s.city.total}</td>
    <td>${s.api.passed}/${s.api.total}</td>
    <td>${ok ? '✅ Pass' : '❌ Fail'}</td>
  </tr>`;
}).join('');

const sectionHtml = categoryOrder.map((cat) => {
  const rows = testRows.filter((r) => r.category === cat);
  if (rows.length === 0) return '';
  const cfg = categoryConfig[cat];
  return `<div class="sec-title" style="border-left-color:${cfg.color}">${cfg.sectionTitle}</div>
${rows.map(testCard).join('\n')}`;
}).join('\n\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Spinny PLP Sanity — ${runLabel}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#f4f6f9;color:#1a1a2e;padding:24px}
header{background:#1a1a2e;color:#fff;padding:20px 28px;border-radius:12px;margin-bottom:24px}
header h1{font-size:1.4rem;font-weight:700}
header p{opacity:.7;font-size:.85rem;margin-top:4px}
.overall{display:inline-block;padding:6px 18px;border-radius:20px;font-weight:700;font-size:1rem;margin-top:12px}
.overall-pass{background:#22c55e;color:#fff}
.overall-fail{background:#ef4444;color:#fff}
.box{background:#fff;border-radius:12px;padding:20px 24px;margin-bottom:24px;box-shadow:0 1px 4px #0001}
.box h2{font-size:.85rem;color:#6b7280;margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em}
table{width:100%;border-collapse:collapse;font-size:.875rem}
th{text-align:left;padding:8px 12px;background:#f9fafb;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb}
td{padding:8px 12px;border-bottom:1px solid #f3f4f6}
.row-fail td{background:#fff5f5}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:.72rem;font-weight:700}
.pass{background:#dcfce7;color:#166534}
.fail{background:#fee2e2;color:#991b1b}
.flaky{background:#fef9c3;color:#854d0e}
.skip{background:#f3f4f6;color:#6b7280}
.sec-title{font-size:.95rem;font-weight:700;color:#374151;margin:24px 0 8px;padding-left:10px;border-left:4px solid #6366f1}
details.test-card{background:#fff;border-radius:10px;margin-bottom:7px;box-shadow:0 1px 3px #0001;overflow:hidden}
details.test-card.pass{border-left:4px solid #22c55e}
details.test-card.fail{border-left:4px solid #ef4444}
details.test-card.flaky{border-left:4px solid #eab308}
summary.test-summary{display:flex;align-items:center;gap:10px;padding:11px 16px;cursor:pointer;list-style:none;user-select:none;flex-wrap:wrap}
summary.test-summary::-webkit-details-marker{display:none}
summary.test-summary:hover{background:#f9fafb}
.tid{font-size:.68rem;font-weight:700;background:#e0e7ff;color:#3730a3;padding:2px 8px;border-radius:8px;white-space:nowrap}
.ttitle{font-size:.875rem;font-weight:600;flex:1;min-width:120px}
.tbadges{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.dev-badge{display:flex;align-items:center;gap:3px;font-size:.75rem}
.arrow{font-size:.6rem;color:#9ca3af;transition:transform .2s;margin-left:auto}
details[open] .arrow{transform:rotate(90deg)}
.test-detail{padding:16px 20px;border-top:1px solid #f3f4f6;background:#fafafa}
.test-what{font-size:.82rem;color:#4b5563;margin-bottom:14px;line-height:1.55}
.ss-row{display:flex;gap:12px;overflow-x:auto;padding-bottom:4px}
.ss-col{flex:1;min-width:240px}
.ss-lbl{font-size:.75rem;font-weight:600;color:#374151;margin-bottom:6px;line-height:1.4}
.ss-col img{width:100%;border-radius:6px;border:1px solid #e5e7eb;display:block}
.no-ss{height:100px;background:#f3f4f6;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:.75rem;color:#9ca3af}
.ss-err{margin-top:6px;font-size:.7rem;color:#dc2626;background:#fff5f5;border-radius:4px;padding:6px;word-break:break-word;white-space:pre-wrap;max-height:140px;overflow-y:auto}
footer{text-align:center;color:#9ca3af;font-size:.8rem;margin-top:32px}
</style>
</head>
<body>
<header>
  <h1>&#129514; Spinny PLP Sanity Report</h1>
  <p>Run at ${runLabel} IST &nbsp;&middot;&nbsp; spinny.com/used-cars/delhi/ + all cities</p>
  <div class="overall ${overallClass}">${overallLabel} &mdash; ${totalPassed}/${totalTests} tests</div>
</header>

<div class="box">
  <h2>Device Summary</h2>
  <table>
    <thead><tr><th>Device</th><th>UI Tests</th><th>Filter Tests</th><th>City Tests</th><th>API Tests</th><th>Status</th></tr></thead>
    <tbody>${summaryRows}</tbody>
  </table>
</div>

${sectionHtml}

<footer>Generated by PLP Sanity &middot; ${runAt.toISOString()}</footer>
</body>
</html>`;

const outPath = path.join(outDir, 'report.html');
fs.writeFileSync(outPath, html, 'utf-8');

// ── write meta.json ───────────────────────────────────────────────────────────

const metaPath = path.join(outDir, 'meta.json');
fs.writeFileSync(
  metaPath,
  JSON.stringify({ runAt: runAt.toISOString(), runLabel, totalPassed, totalFailed, totalTests, summary, testRows, failures }, null, 2),
  'utf-8',
);

console.log(`REPORT_PATH=${outPath}`);
console.log(`META_PATH=${metaPath}`);
console.log(`REPORT_DIR=${outDir}`);
console.log(`TOTAL_PASSED=${totalPassed}`);
console.log(`TOTAL_FAILED=${totalFailed}`);
console.log(`TOTAL_TESTS=${totalTests}`);
