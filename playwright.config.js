const { defineConfig, devices } = require('@playwright/test');

// On GitHub Actions (CI=true): use Playwright's built-in Chromium — Chrome not installed.
// Locally: use system Chrome to avoid corporate SSL download block.
const isCI = !!process.env.CI;

module.exports = defineConfig({
  testDir: './tests',
  timeout: 90000,
  retries: 1,
  workers: isCI ? 6 : 10,

  reporter: [
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],

  use: {
    baseURL: 'https://www.spinny.com',
    screenshot: 'on',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    ignoreHTTPSErrors: true,
    ...(isCI ? {} : { channel: 'chrome' }),
    extraHTTPHeaders: {
      'Accept-Language': 'en-IN,en;q=0.9',
    },
  },

  projects: [
    {
      name: 'Desktop',
      use: {
        ...(isCI ? {} : { channel: 'chrome' }),
        viewport: { width: 1280, height: 800 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
      },
    },
    {
      name: 'Android',
      use: {
        ...(isCI ? {} : { channel: 'chrome' }),
        ...devices['Pixel 5'],
      },
    },
    {
      name: 'iOS',
      use: {
        browserName: 'chromium',
        ...(isCI ? {} : { channel: 'chrome' }),
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      },
    },
  ],

  outputDir: 'test-results/attachments',
});
