import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests against the REAL local stack (local-stack/stack.ps1): the production static export
 * served on :7184, `/api` proxied to the local API on 127.0.0.1:7181, which uses the local MySQL
 * and Redis containers. These tests create and delete clearly-labelled E2E records.
 *
 * Refuses any API origin that is not this machine, so it can never write to production.
 */
const PORT = 7184;
const API_ORIGIN = process.env.CLEARWOOD_API_ORIGIN ?? 'http://127.0.0.1:7181';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(API_ORIGIN)) {
  throw new Error(`Refusing to run real-backend tests against ${API_ORIGIN}: local only.`);
}
const channel = process.env.PW_CHANNEL ?? 'msedge';

export default defineConfig({
  testDir: 'e2e-real',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  },
  projects: [
    {
      name: 'real-desktop',
      use: { ...devices['Desktop Edge'], channel, viewport: { width: 1366, height: 800 } },
      grepInvert: /@mobile/,
    },
    {
      name: 'real-mobile',
      use: { ...devices['Pixel 7'], channel, defaultBrowserType: 'chromium' },
      grep: /@mobile/,
    },
  ],
  webServer: {
    command: 'node scripts/serve-static.mjs',
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    env: { PORT: String(PORT), CLEARWOOD_API_ORIGIN: API_ORIGIN },
    timeout: 30_000,
  },
});
