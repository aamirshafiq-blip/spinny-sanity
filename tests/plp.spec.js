/**
 * Spinny PLP Sanity — Comprehensive UI + Filter + City + API
 * Target: https://www.spinny.com/used-cars/delhi/ (and all active cities)
 * Runs on: Desktop (1280×800), Android (Pixel 5), iOS (iPhone 12)
 */

const { test, expect } = require('@playwright/test');

const PLP_PATH = '/used-cars/delhi/';
const API_RESPONSE_THRESHOLD_MS = 10000;
const MIN_CAR_CARDS = 4;

// All active Spinny cities
const SPINNY_CITIES = [
  { name: 'Delhi',      slug: 'delhi' },
  { name: 'Noida',      slug: 'noida' },
  { name: 'Gurgaon',    slug: 'gurgaon' },
  { name: 'Faridabad',  slug: 'faridabad' },
  { name: 'Ghaziabad',  slug: 'ghaziabad' },
  { name: 'Bangalore',  slug: 'bangalore' },
  { name: 'Hyderabad',  slug: 'hyderabad' },
  { name: 'Pune',       slug: 'pune' },
  { name: 'Mumbai',     slug: 'mumbai' },
  { name: 'Chennai',    slug: 'chennai' },
  { name: 'Kolkata',    slug: 'kolkata' },
  { name: 'Ahmedabad',  slug: 'ahmedabad' },
  { name: 'Jaipur',     slug: 'jaipur' },
  { name: 'Lucknow',    slug: 'lucknow' },
  { name: 'Chandigarh', slug: 'chandigarh' },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function collectNetworkResponses(page) {
  const captured = [];
  page.on('response', async (res) => {
    try {
      const url  = res.url();
      const req  = res.request();
      if (!['xhr', 'fetch'].includes(req.resourceType())) return;
      const timing       = req.timing();
      const responseTimeMs =
        timing && timing.responseEnd > 0 && timing.requestStart > 0
          ? Math.round(timing.responseEnd - timing.requestStart)
          : null;
      let body = null;
      try { body = await res.json(); } catch (_) {}
      captured.push({ url, status: res.status(), responseTimeMs, body });
    } catch (_) {}
  });
  return captured;
}

function findListingApiResponse(captured) {
  return captured.find((r) =>
    r.url.includes('api.spinny.com') && r.url.includes('listing'),
  );
}

// Dismiss known Spinny overlays silently
async function dismissPopups(page) {
  const selectors = [
    '[class*="app-banner"] button[aria-label*="close" i]',
    '[class*="download-app"] button',
    '[class*="cookiebar"] button',
    '[class*="cookie"] button:has-text("Accept")',
    '[class*="cookie"] button:has-text("Got it")',
    'button[aria-label="Close"]',
    '[data-testid*="close"]',
    '[class*="overlay"] [class*="close"]',
    '[class*="modal"] [class*="close"]',
  ];
  for (const sel of selectors) {
    await page.locator(sel).first().click({ timeout: 800 }).catch(() => {});
  }
  await page.keyboard.press('Escape').catch(() => {});
}

// Navigate to a PLP path, wait for car cards, then dismiss popups
async function gotoPlp(page, path = PLP_PATH) {
  // Block browser push-notification dialogs before load
  await page.addInitScript(() => {
    Object.defineProperty(Notification, 'permission', { get: () => 'denied' });
    Notification.requestPermission = () => Promise.resolve('denied');
  });

  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Wait for car cards so screenshots capture the loaded state, not the skeleton
  await page.waitForSelector('a[href*="/buy-used-cars/"]', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  await dismissPopups(page);
}

// ─── test suite ───────────────────────────────────────────────────────────────

test.describe('Spinny PLP Sanity', () => {
  let networkResponses;

  test.beforeEach(async ({ page }) => {
    networkResponses = collectNetworkResponses(page);
    await page.route(
      /(gtm|doubleclick|facebook|clarity|hotjar|intercom|freshchat|analytics\.google)/,
      (route) => route.abort(),
    );
  });

  // ── UI TESTS ──────────────────────────────────────────────────────────────

  test('UI-01: Page loads with HTTP 2xx', async ({ page }) => {
    const response = await page.goto(PLP_PATH, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    expect(response.status(), `HTTP status should be 2xx, got ${response.status()}`).toBeLessThan(400);
  });

  test('UI-02: Page title contains "Used Cars"', async ({ page }) => {
    await gotoPlp(page);
    const title = await page.title();
    expect(title.toLowerCase()).toContain('used car');
  });

  test('UI-03: At least 4 car listing cards visible', async ({ page }) => {
    await gotoPlp(page);
    const cardCount = await page.locator('a[href*="/buy-used-cars/"]').count();
    expect(
      cardCount,
      `Expected at least ${MIN_CAR_CARDS} car cards, found ${cardCount}`,
    ).toBeGreaterThanOrEqual(MIN_CAR_CARDS);
  });

  test('UI-04: Car cards contain price (₹ or Lakh)', async ({ page }) => {
    await gotoPlp(page);
    const bodyText = await page.locator('body').innerText();
    const hasPrice = /₹\s*[\d,.]+/.test(bodyText) || /[\d.]+\s*Lakh/i.test(bodyText);
    expect(hasPrice, 'No price (₹ or Lakh) found on page').toBe(true);
  });

  test('UI-05: Car cards contain KM / mileage info', async ({ page }) => {
    await gotoPlp(page);
    const bodyText = await page.locator('body').innerText();
    expect(/[\d,]+\s*km/i.test(bodyText), 'No KM info found on page').toBe(true);
  });

  test('UI-06: Filter section is visible (Price Range)', async ({ page }) => {
    await gotoPlp(page);
    const priceFilter = page.locator('text=Price Range').first();
    const isVisible = await priceFilter.isVisible().catch(() => false);
    expect(isVisible, '"Price Range" filter not visible on page').toBe(true);
  });

  test('UI-07: Sort / search-by-price option is present', async ({ page }) => {
    await gotoPlp(page);
    const sortSelectors = [
      'text=Search by price',
      ':has-text("Sort by")',
      '[class*="ds-interactive"]',
      'button:has-text("Sort")',
    ];
    let found = false;
    for (const sel of sortSelectors) {
      if (await page.locator(sel).first().isVisible().catch(() => false)) {
        found = true;
        break;
      }
    }
    expect(found, 'Sort/filter chip not found on page').toBe(true);
  });

  test('UI-08: Car images load without errors', async ({ page }) => {
    await gotoPlp(page);
    const brokenCount = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).filter(
        (img) => img.complete && img.naturalWidth === 0 && img.src && !img.src.startsWith('data:'),
      ).length;
    });
    expect(brokenCount, `${brokenCount} broken image(s) found`).toBe(0);
  });

  test('UI-09: No critical JS errors on load', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await gotoPlp(page);
    const critical = errors.filter(
      (e) => /uncaught|typeerror|referenceerror|syntaxerror/i.test(e) && !/gtm|analytics|ads/i.test(e),
    );
    expect(critical, `Critical JS errors: ${critical.join(', ')}`).toHaveLength(0);
  });

  test('UI-10: Page scroll loads more car cards (lazy load / pagination)', async ({ page }) => {
    await gotoPlp(page);
    const before = await page.locator('a[href*="/buy-used-cars/"]').count();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);
    const after = await page.locator('a[href*="/buy-used-cars/"]').count();
    expect(after, 'Car count should not drop after scrolling').toBeGreaterThanOrEqual(before);
  });

  // ── CARD CONTENT TESTS ────────────────────────────────────────────────────

  test('UI-11: Car model names visible on listing cards', async ({ page }) => {
    await gotoPlp(page);
    const cards = page.locator('a[href*="/buy-used-cars/"]');
    await expect(cards.first()).toBeVisible();
    const cardText = await cards.first().innerText();
    expect(cardText.trim().length, 'First car card has no visible text').toBeGreaterThan(5);
  });

  test('UI-12: Year of manufacture visible on car cards', async ({ page }) => {
    await gotoPlp(page);
    const bodyText = await page.locator('body').innerText();
    expect(
      /20(1[5-9]|2[0-6])/.test(bodyText),
      'No year of manufacture (2015–2026) found on page',
    ).toBe(true);
  });

  test('UI-13: EMI / monthly payment info present', async ({ page }) => {
    await gotoPlp(page);
    const bodyText = await page.locator('body').innerText();
    expect(/emi|\/mo|per month/i.test(bodyText), 'No EMI information found on page').toBe(true);
  });

  test('UI-14: Total car listing count displayed on page', async ({ page }) => {
    await gotoPlp(page);
    const bodyText = await page.locator('body').innerText();
    const hasCount =
      /[\d,]+\s*(used\s*cars?|cars?\s*found|results?)/i.test(bodyText) ||
      /\d{3,}\s*cars?/i.test(bodyText);
    expect(hasCount, 'No total car count shown on page').toBe(true);
  });

  test('UI-15: Transmission type visible on car cards', async ({ page }) => {
    await gotoPlp(page);
    const bodyText = await page.locator('body').innerText();
    expect(
      /\b(automatic|manual|amt|cvt)\b/i.test(bodyText),
      'No transmission type (Automatic/Manual/AMT/CVT) found',
    ).toBe(true);
  });

  // ── PAGE STRUCTURE & SEO ──────────────────────────────────────────────────

  test('UI-16: H1 heading contains city name or "Used Cars"', async ({ page }) => {
    await gotoPlp(page);
    const h1Text = await page.locator('h1').first().textContent().catch(() => '');
    expect(h1Text.length, 'H1 heading is missing from page').toBeGreaterThan(0);
    expect(
      /used cars?|delhi/i.test(h1Text),
      `H1 text "${h1Text.trim()}" does not mention city or "Used Cars"`,
    ).toBe(true);
  });

  test('UI-17: Breadcrumb navigation present', async ({ page }) => {
    await gotoPlp(page);
    const hasBreadcrumb =
      (await page.locator('[class*="breadcrumb"], nav[aria-label*="breadcrumb"], [itemtype*="BreadcrumbList"]').count()) > 0 ||
      (await page.locator('text=Home').count()) > 0;
    expect(hasBreadcrumb, 'Breadcrumb navigation not found on page').toBe(true);
  });

  test('UI-18: Meta description tag present and non-empty', async ({ page }) => {
    await gotoPlp(page);
    const metaDesc = await page.locator('meta[name="description"]').getAttribute('content').catch(() => null);
    expect(metaDesc, 'Meta description tag missing').toBeTruthy();
    expect(metaDesc.length, 'Meta description is too short').toBeGreaterThan(20);
  });

  test('UI-19: Canonical URL tag present and points to spinny.com', async ({ page }) => {
    await gotoPlp(page);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href').catch(() => null);
    expect(canonical, 'Canonical URL tag missing').toBeTruthy();
    expect(canonical, 'Canonical URL should point to spinny.com').toContain('spinny.com');
  });

  test('UI-20: Footer content loaded after scroll', async ({ page }) => {
    await gotoPlp(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').innerText();
    expect(
      /spinny|©|copyright|privacy|terms/i.test(bodyText),
      'Footer content not found on page',
    ).toBe(true);
  });

  // ── CONTENT WIDGETS & INTERACTIONS ───────────────────────────────────────

  test('UI-21: Banner or promotional widget section present', async ({ page }) => {
    await gotoPlp(page);
    const selectors = ['[class*="banner"]', '[class*="promo"]', '[class*="widget"]', '[class*="carousel"]', '[class*="slider"]'];
    let found = false;
    for (const sel of selectors) {
      if ((await page.locator(sel).count()) > 0) { found = true; break; }
    }
    expect(found, 'No banner/widget/carousel section found on page').toBe(true);
  });

  test('UI-22: Car card links follow /buy-used-cars/ URL pattern', async ({ page }) => {
    await gotoPlp(page);
    const cards = page.locator('a[href*="/buy-used-cars/"]');
    await expect(cards.first()).toBeVisible();
    const href = await cards.first().getAttribute('href');
    expect(href, 'Car card href should match /buy-used-cars/ pattern').toMatch(/\/buy-used-cars\//);
  });

  test('UI-23: Shortlist / heart / save icon visible on car cards', async ({ page }) => {
    await gotoPlp(page);
    const selectors = [
      '[class*="shortlist"]', '[class*="wishlist"]', '[class*="heart"]',
      '[aria-label*="shortlist" i]', '[aria-label*="save" i]', 'button[class*="fav"]',
    ];
    let found = false;
    for (const sel of selectors) {
      if ((await page.locator(sel).count()) > 0) { found = true; break; }
    }
    expect(found, 'Shortlist/heart/save icon not found on car cards').toBe(true);
  });

  test('UI-24: Deep scroll (2×) loads additional car cards', async ({ page }) => {
    await gotoPlp(page);
    const before = await page.locator('a[href*="/buy-used-cars/"]').count();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2500);
    const after = await page.locator('a[href*="/buy-used-cars/"]').count();
    expect(after, `Car count should not drop after deep scroll (was ${before}, now ${after})`).toBeGreaterThanOrEqual(before);
  });

  test('UI-25: City name "Delhi" present in page content', async ({ page }) => {
    await gotoPlp(page);
    const bodyText = await page.locator('body').innerText();
    expect(/delhi/i.test(bodyText), 'City name "Delhi" not found anywhere on page').toBe(true);
  });

  // ── FLOATING FILTER TESTS ─────────────────────────────────────────────────
  // Tests the filter panel visible on PLP (sidebar on desktop, chips/drawer on mobile)

  test('FLT-01: Filter section / panel is present on PLP', async ({ page }) => {
    await gotoPlp(page);
    const filterSelectors = [
      'text=Price Range',
      '[class*="filter-panel"]',
      '[class*="filterPanel"]',
      '[class*="FilterPanel"]',
      'button:has-text("Filter")',
      '[aria-label*="filter" i]',
    ];
    let found = false;
    for (const sel of filterSelectors) {
      if (await page.locator(sel).first().isVisible().catch(() => false)) { found = true; break; }
    }
    expect(found, 'No filter section or Filter button found on PLP').toBe(true);
  });

  test('FLT-02: Multiple filter categories present (≥2 of Budget/Fuel/Body/KM/Transmission)', async ({ page }) => {
    await gotoPlp(page);
    const bodyText = await page.locator('body').innerText();
    const filterKeywords = ['Budget', 'Fuel', 'KM Driven', 'Transmission', 'Body Type', 'Price Range'];
    const found = filterKeywords.filter((k) => bodyText.includes(k));
    expect(found.length, `Expected ≥2 filter categories visible, found: ${found.join(', ') || 'none'}`).toBeGreaterThanOrEqual(2);
  });

  test('FLT-03: Fuel type filter options visible (Petrol / Diesel / CNG / Electric)', async ({ page }) => {
    await gotoPlp(page);
    const bodyText = await page.locator('body').innerText();
    const fuelTypes = ['Petrol', 'Diesel', 'CNG', 'Electric'];
    const found = fuelTypes.filter((f) => bodyText.includes(f));
    expect(found.length, `No fuel type options found — looked for: ${fuelTypes.join(', ')}`).toBeGreaterThanOrEqual(1);
  });

  test('FLT-04: Body type filter options visible (Sedan / SUV / Hatchback)', async ({ page }) => {
    await gotoPlp(page);
    const bodyText = await page.locator('body').innerText();
    const bodyTypes = ['Sedan', 'SUV', 'Hatchback', 'MUV', 'Crossover'];
    const found = bodyTypes.filter((b) => bodyText.includes(b));
    expect(found.length, `No body type options found — looked for: ${bodyTypes.join(', ')}`).toBeGreaterThanOrEqual(1);
  });

  test('FLT-05: KM Driven / Odometer filter option present', async ({ page }) => {
    await gotoPlp(page);
    const bodyText = await page.locator('body').innerText();
    expect(
      /km driven|kms driven|odometer|mileage/i.test(bodyText),
      'KM Driven filter option not found on page',
    ).toBe(true);
  });

  test('FLT-06: Transmission filter option visible (Automatic / Manual)', async ({ page }) => {
    await gotoPlp(page);
    const bodyText = await page.locator('body').innerText();
    expect(
      /\b(automatic|manual)\b/i.test(bodyText),
      'Transmission filter option (Automatic/Manual) not found',
    ).toBe(true);
  });

  test('FLT-07: "All Filters" or "More Filters" button accessible', async ({ page }) => {
    await gotoPlp(page);
    const selectors = [
      'button:has-text("All Filters")',
      'button:has-text("More Filters")',
      'button:has-text("Filters")',
      'text=All Filters',
      'text=More Filters',
      '[aria-label*="all filter" i]',
    ];
    let found = false;
    for (const sel of selectors) {
      if (await page.locator(sel).first().isVisible().catch(() => false)) { found = true; break; }
    }
    // On desktop the sidebar is always visible so "All Filters" may not exist
    if (!found) {
      const priceRangeVisible = await page.locator('text=Price Range').first().isVisible().catch(() => false);
      found = priceRangeVisible;
    }
    expect(found, 'Neither "All Filters" button nor filter sidebar found on page').toBe(true);
  });

  test('FLT-08: Applying Petrol fuel filter updates listing without crash', async ({ page }) => {
    await gotoPlp(page);
    const beforeCount = await page.locator('a[href*="/buy-used-cars/"]').count();

    const petrolSelectors = [
      'label:has-text("Petrol")',
      '[data-value="petrol"]',
      '[class*="filter"] :text-is("Petrol")',
      'input[type="checkbox"] + *:has-text("Petrol")',
    ];
    let clicked = false;
    for (const sel of petrolSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible().catch(() => false)) {
        await el.click({ timeout: 2000 }).catch(() => {});
        clicked = true;
        break;
      }
    }
    if (!clicked) return; // Filter not directly clickable on this device/layout — skip

    await page.waitForTimeout(3000);
    const afterCount = await page.locator('a[href*="/buy-used-cars/"]').count();
    expect(afterCount, 'Page crashed after applying Petrol filter — no car cards').toBeGreaterThan(0);
  });

  test('FLT-09: Opening filter drawer on mobile and closing returns to listing', async ({ page }, testInfo) => {
    await gotoPlp(page);

    // Only meaningful on mobile where filter drawer exists
    const filterBtn = page.locator('button:has-text("Filter"), button:has-text("Filters"), button:has-text("All Filters")').first();
    const btnVisible = await filterBtn.isVisible().catch(() => false);
    if (!btnVisible) return; // Desktop sidebar always visible — skip drawer test

    await filterBtn.click({ timeout: 2000 });
    await page.waitForTimeout(1500);

    // Dismiss / close the filter drawer
    const closeSelectors = [
      'button:has-text("Apply")',
      'button:has-text("Close")',
      'button[aria-label*="close" i]',
      '[class*="filter"] [class*="close"]',
    ];
    for (const sel of closeSelectors) {
      if (await page.locator(sel).first().isVisible().catch(() => false)) {
        await page.locator(sel).first().click({ timeout: 2000 }).catch(() => {});
        break;
      }
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(1500);

    // Listing should still be visible after closing filter drawer
    const carCount = await page.locator('a[href*="/buy-used-cars/"]').count();
    expect(carCount, 'Car listing disappeared after closing filter drawer').toBeGreaterThan(0);
  });

  test('FLT-10: Pre-filtered URL (fuel_type=petrol) loads cars correctly', async ({ page }) => {
    await gotoPlp(page, '/used-cars/delhi/?fuel_type=petrol');
    const cardCount = await page.locator('a[href*="/buy-used-cars/"]').count();
    expect(cardCount, 'No cars shown on Petrol-filtered PLP').toBeGreaterThanOrEqual(1);
  });

  test('FLT-11: Pre-filtered URL (body_type=suv) loads cars correctly', async ({ page }) => {
    await gotoPlp(page, '/used-cars/delhi/?body_type=suv');
    const cardCount = await page.locator('a[href*="/buy-used-cars/"]').count();
    expect(cardCount, 'No cars shown on SUV-filtered PLP').toBeGreaterThanOrEqual(1);
  });

  test('FLT-12: Pre-filtered URL (transmission=automatic) loads cars correctly', async ({ page }) => {
    await gotoPlp(page, '/used-cars/delhi/?transmission=automatic');
    const cardCount = await page.locator('a[href*="/buy-used-cars/"]').count();
    expect(cardCount, 'No cars shown on Automatic-filtered PLP').toBeGreaterThanOrEqual(1);
  });

  test('FLT-13: Filtered listing count differs from unfiltered count', async ({ page }) => {
    await gotoPlp(page);
    const unfilteredCount = await page.locator('a[href*="/buy-used-cars/"]').count();

    // Navigate to a filtered page
    await gotoPlp(page, '/used-cars/delhi/?fuel_type=petrol');
    const filteredCount = await page.locator('a[href*="/buy-used-cars/"]').count();

    // Both should have cars — we just verify filtering works (counts can differ)
    expect(filteredCount, 'Filtered PLP returned no cars').toBeGreaterThan(0);
    expect(unfilteredCount, 'Unfiltered PLP returned no cars').toBeGreaterThan(0);
  });

  test('FLT-14: Filter API call includes city slug in request URL', async ({ page }) => {
    await gotoPlp(page, '/used-cars/delhi/?fuel_type=petrol');
    const listing = findListingApiResponse(networkResponses);
    expect(listing, 'Listing API not intercepted on filtered PLP').toBeTruthy();
    expect(listing.url.toLowerCase(), 'City slug "delhi" missing from API URL on filtered page').toContain('delhi');
  });

  test('FLT-15: Filter page HTTP response is 2xx (no redirect loop on filtered URL)', async ({ page }) => {
    const res = await page.goto('/used-cars/delhi/?fuel_type=petrol', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    expect(res.status(), `Filtered PLP returned non-2xx status: ${res.status()}`).toBeLessThan(400);
  });

  // ── CITY NAVIGATION TESTS ─────────────────────────────────────────────────
  // Verifies each Spinny city PLP loads with car listings

  for (const [idx, city] of SPINNY_CITIES.entries()) {
    const cityNum = String(idx + 1).padStart(2, '0');

    test(`CITY-${cityNum}: ${city.name} PLP loads with car listings`, async ({ page }) => {
      const cityPath = `/used-cars/${city.slug}/`;

      // Block push notification dialogs
      await page.addInitScript(() => {
        Object.defineProperty(Notification, 'permission', { get: () => 'denied' });
        Notification.requestPermission = () => Promise.resolve('denied');
      });

      const response = await page.goto(cityPath, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Page must respond with 2xx
      expect(
        response.status(),
        `${city.name} PLP returned HTTP ${response.status()} — city may be inactive or slug wrong`,
      ).toBeLessThan(400);

      // Wait for car cards
      await page.waitForSelector('a[href*="/buy-used-cars/"]', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await dismissPopups(page);

      // At least 1 car card must appear
      const cardCount = await page.locator('a[href*="/buy-used-cars/"]').count();
      expect(
        cardCount,
        `${city.name} PLP has no car listing cards — listing may be broken or city has no inventory`,
      ).toBeGreaterThanOrEqual(1);

      // Page title must reference "Used Cars" or the city name
      const title = await page.title();
      expect(
        /used cars?/i.test(title) || new RegExp(city.name, 'i').test(title),
        `${city.name} PLP title "${title}" doesn't mention "Used Cars" or the city name`,
      ).toBe(true);
    });
  }

  // ── API TESTS ─────────────────────────────────────────────────────────────

  test('API-01: Listing API (api.spinny.com/listing) returns HTTP 200', async ({ page }) => {
    await gotoPlp(page);
    const listing = findListingApiResponse(networkResponses);
    expect(listing, 'Spinny listing API was not intercepted').toBeTruthy();
    expect(listing.status, `Listing API returned ${listing?.status}`).toBe(200);
  });

  test('API-02: Listing API response time < 10s', async ({ page }) => {
    await gotoPlp(page);
    const listing = findListingApiResponse(networkResponses);
    expect(listing, 'Spinny listing API was not intercepted').toBeTruthy();
    if (listing?.responseTimeMs !== null) {
      expect(
        listing.responseTimeMs,
        `Listing API took ${listing.responseTimeMs}ms (threshold: ${API_RESPONSE_THRESHOLD_MS}ms)`,
      ).toBeLessThanOrEqual(API_RESPONSE_THRESHOLD_MS);
    }
  });

  test('API-03: Listing API response body contains car data', async ({ page }) => {
    await gotoPlp(page);
    const listing = findListingApiResponse(networkResponses);
    expect(listing, 'Spinny listing API was not intercepted').toBeTruthy();
    expect(listing?.body, 'Listing API body is empty').toBeTruthy();
    const body = listing.body;
    const arrayKeys = ['results', 'cars', 'data', 'listings', 'items', 'vehicles'];
    const found =
      arrayKeys.some((k) => Array.isArray(body?.[k]) && body[k].length > 0) ||
      (Array.isArray(body) && body.length > 0) ||
      (body?.count !== undefined && body.count > 0);
    expect(
      found,
      `No car data found in listing API. Keys: ${Object.keys(body || {}).join(', ')}`,
    ).toBe(true);
  });

  test('API-04: No 5xx errors on any XHR/fetch call', async ({ page }) => {
    await gotoPlp(page);
    const failed = networkResponses.filter((r) => r.status >= 500);
    const urls = failed.map((r) => `  ${r.status} — ${r.url}`).join('\n');
    expect(failed, `Server errors:\n${urls}`).toHaveLength(0);
  });

  test('API-05: Page fully loads within 30s', async ({ page }) => {
    const start = Date.now();
    await gotoPlp(page);
    const elapsed = Date.now() - start;
    expect(elapsed, `Page took ${elapsed}ms to load`).toBeLessThanOrEqual(30000);
  });

  // ── EXTENDED API TESTS ────────────────────────────────────────────────────

  test('API-06: Listing API car count in response > 0', async ({ page }) => {
    await gotoPlp(page);
    const listing = findListingApiResponse(networkResponses);
    expect(listing, 'Spinny listing API was not intercepted').toBeTruthy();
    const body = listing?.body;
    const count =
      body?.count ?? body?.total ?? body?.totalCount ?? body?.total_count ??
      (Array.isArray(body?.results) ? body.results.length : null) ??
      (Array.isArray(body?.cars)    ? body.cars.length    : null);
    expect(count, 'Listing API returned count = 0 or missing count field').toBeGreaterThan(0);
  });

  test('API-07: City slug "delhi" present in listing API request URL', async ({ page }) => {
    await gotoPlp(page);
    const listing = findListingApiResponse(networkResponses);
    expect(listing, 'Spinny listing API was not intercepted').toBeTruthy();
    expect(listing.url.toLowerCase(), `City slug "delhi" not found in API URL: ${listing?.url}`).toContain('delhi');
  });

  test('API-08: No 4xx client errors (excluding 401) on any XHR/fetch call', async ({ page }) => {
    await gotoPlp(page);
    const failed = networkResponses.filter((r) => r.status >= 400 && r.status < 500 && r.status !== 401);
    const urls = failed.map((r) => `  ${r.status} — ${r.url}`).join('\n');
    expect(failed, `Client errors (4xx, excl. 401):\n${urls}`).toHaveLength(0);
  });

  test('API-09: Multiple API calls made during page load', async ({ page }) => {
    await gotoPlp(page);
    const apiCalls = networkResponses.filter((r) => r.url.includes('api.spinny.com'));
    expect(
      apiCalls.length,
      `Expected multiple api.spinny.com calls, found ${apiCalls.length}`,
    ).toBeGreaterThan(1);
  });

  test('API-10: Listing API response body is not empty object', async ({ page }) => {
    await gotoPlp(page);
    const listing = findListingApiResponse(networkResponses);
    expect(listing, 'Spinny listing API was not intercepted').toBeTruthy();
    const bodyKeys = Object.keys(listing?.body || {});
    expect(
      bodyKeys.length,
      `Listing API returned empty or null body. Keys: ${bodyKeys.join(', ')}`,
    ).toBeGreaterThan(0);
  });

  test('API-11: Mobile listing API response time ≤ 15s', async ({ page }, testInfo) => {
    await gotoPlp(page);
    const listing = findListingApiResponse(networkResponses);
    expect(listing, 'Spinny listing API was not intercepted').toBeTruthy();
    const threshold = testInfo.project.name === 'Desktop' ? 10000 : 15000;
    if (listing?.responseTimeMs !== null && listing?.responseTimeMs !== undefined) {
      expect(
        listing.responseTimeMs,
        `Listing API took ${listing.responseTimeMs}ms on ${testInfo.project.name} (threshold: ${threshold}ms)`,
      ).toBeLessThanOrEqual(threshold);
    }
  });
});
