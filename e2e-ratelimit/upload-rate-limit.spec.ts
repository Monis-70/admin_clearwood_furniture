import { expect, test, type Request } from '@playwright/test';

import { createDraft, csrfHeader, uniquePng } from '../e2e-real/catalog-helpers';
import { RUN, signInAsSuperAdmin } from '../e2e-real/stack';

/**
 * A real 429 from the API's upload limiter. playwright.ratelimit.config.ts starts a separate local
 * API that allows 3 uploads per 20 s (stack.ps1 backend-ratelimit), so five images must hit the
 * limit: the queue has to wait for the Retry-After the API sent and then finish on its own, with
 * nothing chosen again and the gallery in the order the files were chosen.
 */
const FILES = 5;
const LIMIT = 3;

const isUpload = (request: Request) =>
  request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/admin/media/upload';

let productId: string | undefined;

test.afterAll(async ({ browser }, testInfo) => {
  const context = await browser.newContext(testInfo.project.use);
  const page = await context.newPage();
  await signInAsSuperAdmin(page);
  const headers = await csrfHeader(page);
  if (productId)
    await page.request.delete(`/api/v1/admin/catalog/products/${productId}`, { headers });
  const files = await page.request.get(
    `/api/v1/admin/media?search=${encodeURIComponent(`e2e-${RUN}`)}&limit=100`,
  );
  const mediaIds = ((await files.json()) as { data?: { id: string }[] }).data?.map((m) => m.id);
  if (mediaIds?.length) {
    await page.request.post('/api/v1/admin/media/bulk-delete', {
      headers,
      data: { ids: mediaIds },
    });
  }
  await context.close();
});

test('a real 429 pauses uploads for Retry-After, then they resume and finish in order', async ({
  page,
}) => {
  const log: { at: number; status?: number; retryAfter?: number; started?: true }[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  page.on('request', (request) => {
    if (!isUpload(request)) return;
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    log.push({ at: Date.now(), started: true });
  });
  const finish = (request: Request) => {
    if (isUpload(request)) inFlight -= 1;
  };
  page.on('requestfinished', finish);
  page.on('requestfailed', finish);
  page.on('response', (response) => {
    if (!isUpload(response.request())) return;
    const header = response.headers()['retry-after'];
    log.push({
      at: Date.now(),
      status: response.status(),
      ...(header ? { retryAfter: Number(header) } : {}),
    });
  });

  await signInAsSuperAdmin(page);
  productId = await createDraft(page, `E2E RateLimit ${RUN}`, `E2E-RL-${RUN.toUpperCase()}`);
  await page.goto(`/catalog/products/edit?id=${productId}&tab=media`);
  await expect(page.getByRole('heading', { name: 'Media & Gallery' })).toBeVisible();

  const names = Array.from({ length: FILES }, (_, i) => `e2e-${RUN}-rl${i + 1}.png`);
  await page
    .getByLabel('Upload images')
    .setInputFiles(names.map((name) => ({ name, mimeType: 'image/png', buffer: uniquePng() })));

  const uploads = page.getByRole('region', { name: 'Uploads' });
  await expect(
    uploads.getByText(/The server's upload limit was reached\. Uploading resumes in \d+ s/),
  ).toBeVisible({ timeout: 30_000 });
  await expect(uploads.getByText(`${FILES} uploaded successfully`)).toBeVisible({
    timeout: 90_000,
  });
  await expect(uploads.getByText(/upload limit was reached/)).toBeHidden();

  const answers = log.filter((entry) => entry.status !== undefined);
  const limited = answers.filter((entry) => entry.status === 429);
  expect(answers.filter((entry) => entry.status === 201)).toHaveLength(FILES);
  expect(limited.length).toBeGreaterThan(0);
  expect(maxInFlight).toBeLessThanOrEqual(2);

  // Nothing was sent again before the wait the API asked for (1 s of slack for rounding), and the
  // API accepted exactly its allowance before that.
  const first = limited[0]!;
  expect(first.retryAfter).toBeGreaterThan(0);
  const resumedAt = log.find((entry) => entry.started && entry.at > first.at)?.at;
  expect(resumedAt).toBeDefined();
  expect(resumedAt! - first.at).toBeGreaterThanOrEqual((first.retryAfter! - 1) * 1000);
  expect(answers.filter((entry) => entry.status === 201 && entry.at < resumedAt!)).toHaveLength(
    LIMIT,
  );

  const gallery = page.getByRole('list', { name: 'Product images in display order' });
  await expect(gallery.getByRole('listitem')).toHaveCount(FILES);
  await page.reload();
  await expect(gallery.getByRole('listitem')).toHaveCount(FILES);
  const labels = await gallery
    .getByRole('listitem')
    .evaluateAll((items) => items.map((item) => item.getAttribute('aria-label') ?? ''));
  expect(labels).toEqual(names.map((name, i) => `Image ${i + 1}: ${name}`));
});
