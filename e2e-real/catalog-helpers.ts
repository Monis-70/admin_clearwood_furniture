import { expect, type Locator, type Page } from '@playwright/test';
import { crc32, deflateSync } from 'node:zlib';

import { RUN } from './stack';

/** Catalogue helpers shared by the real-backend specs. */

export const SOFAS = 'cmuhdg3og008dr9gkp8k4fm0y';

/** The toast region the app announces saves in. */
export const toast = (page: Page, text: string | RegExp) =>
  page.locator('[data-sonner-toast]').filter({ hasText: text }).first();

export async function createDraft(page: Page, name: string, sku: string): Promise<string> {
  await page.goto('/catalog/products/new');
  await expect(page.getByRole('heading', { level: 1, name: 'New product' })).toBeVisible();
  await page.getByLabel(/^Product name/).fill(name);
  await page.getByLabel(/^SKU/).fill(sku);
  await page.getByLabel(/^Base price/).fill('24999');
  await page.getByLabel('Primary category').selectOption(SOFAS);
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(page).toHaveURL(/\/catalog\/products\/edit\?id=/);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  return new URL(page.url()).searchParams.get('id')!;
}

export async function trashProduct(page: Page, id: string) {
  await page.goto(`/catalog/products/edit?id=${id}`);
  await page.getByRole('button', { name: 'More product actions' }).click();
  await page.getByRole('menuitem', { name: 'Move to trash…' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Move to trash' }).click();
  await expect(page).toHaveURL(/\/catalog\/products$/);
  await expect(toast(page, 'Product moved to trash')).toBeVisible();
}

let pngCount = 0;

/**
 * A PNG whose pixels carry the run label and a counter, so the media pipeline cannot
 * de-duplicate two of them. `side` defaults to the API's product-image minimum (1024 px); a flat
 * background keeps the file small, and `noise` adds a square of random pixels that does not
 * compress (a larger file, for watching real upload progress).
 */
export function uniquePng(side = 1024, noise = 0): Buffer {
  pngCount += 1;
  const seed = [...RUN].reduce((sum, c) => sum + c.charCodeAt(0), 0) + pngCount * 7919;
  const rowLength = side * 3 + 1;
  const rows = Buffer.alloc(rowLength * side);
  const background = [seed % 256, (seed >> 8) % 256, pngCount % 256];
  let state = (seed ^ Date.now()) >>> 0 || 1;
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const offset = y * rowLength + 1 + x * 3;
      const noisy = (x < noise && y < noise) || y === 0;
      for (let channel = 0; channel < 3; channel += 1) {
        if (noisy) state = (state * 1_103_515_245 + 12_345) >>> 0;
        rows[offset + channel] = noisy ? state >>> 24 : background[channel]!;
      }
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(side, 0);
  header.writeUInt32BE(side, 4);
  header.writeUInt8(8, 8);
  header.writeUInt8(2, 9);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Files dropped onto `target` exactly as a desktop drag would deliver them. */
export async function dropFiles(
  page: Page,
  target: Locator,
  files: { name: string; mimeType: string; buffer: Buffer }[],
): Promise<void> {
  const dataTransfer = await page.evaluateHandle(
    (items) => {
      const transfer = new DataTransfer();
      for (const item of items) {
        const bytes = Uint8Array.from(atob(item.base64), (char) => char.charCodeAt(0));
        transfer.items.add(new File([bytes], item.name, { type: item.mimeType }));
      }
      return transfer;
    },
    files.map((file) => ({
      name: file.name,
      mimeType: file.mimeType,
      base64: file.buffer.toString('base64'),
    })),
  );
  await target.dispatchEvent('dragenter', { dataTransfer });
  await target.dispatchEvent('dragover', { dataTransfer });
  await target.dispatchEvent('drop', { dataTransfer });
}

/** The signed-in page's CSRF token, for direct API calls made with `page.request`. */
export async function csrfHeader(page: Page): Promise<Record<string, string>> {
  const cookie = (await page.context().cookies()).find((c) => c.name === 'cw_adm_csrf');
  return cookie ? { 'x-csrf-token': decodeURIComponent(cookie.value) } : {};
}

/** GET an API resource with the page's session and unwrap the envelope. */
export async function apiData<T>(page: Page, path: string): Promise<T> {
  const response = await page.request.get(`/api/v1${path}`);
  expect(response.status(), `${path} answered ${response.status()}`).toBe(200);
  return ((await response.json()) as { data: T }).data;
}
