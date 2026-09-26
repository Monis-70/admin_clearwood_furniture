import { defineConfig, devices } from '@playwright/test';

/**
 * The upload rate-limit browser test only. It starts its own local API (stack.ps1
 * backend-ratelimit: same local database, 3 uploads per 20 s, its own Redis prefix) and a static
 * admin on :7186 proxied to it, so a real 429 with Retry-After can be exercised without lowering
 * the limits of the main local API. Local only, like playwright.real.config.ts.
 */
const API_PORT = 7185;
const PORT = 7186;
const channel = process.env.PW_CHANNEL ?? 'msedge';

export default defineConfig({
  testDir: 'e2e-ratelimit',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 150_000,
  reporter: [['list']],
  use: {
    ...devices['Desktop Edge'],
    channel,
    viewport: { width: 1366, height: 800 },
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  },
  webServer: [
    {
      command:
        'powershell -NoProfile -ExecutionPolicy Bypass -File local-stack/stack.ps1 backend-ratelimit',
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'node scripts/serve-static.mjs',
      url: `http://localhost:${PORT}/login`,
      reuseExistingServer: false,
      env: { PORT: String(PORT), CLEARWOOD_API_ORIGIN: `http://127.0.0.1:${API_PORT}` },
      timeout: 30_000,
    },
  ],
});
