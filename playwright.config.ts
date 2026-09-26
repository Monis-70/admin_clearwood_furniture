import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 7183);
/** Installed browser channel; avoids downloading browsers on locked-down machines. */
const channel = process.env.PW_CHANNEL ?? 'msedge';

/**
 * Browser tests run against the production static export (`out/`), served like nginx serves it.
 * The API is replaced by a contract-faithful fake (e2e/fake-api.ts); nothing ever reaches a real
 * backend, so no test can change production data.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Edge'], channel, viewport: { width: 1366, height: 800 } },
      grepInvert: /@mobile/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], channel, defaultBrowserType: 'chromium' },
      grep: /@mobile/,
    },
  ],
  webServer: {
    command: 'node scripts/serve-static.mjs',
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) },
    timeout: 30_000,
  },
});
