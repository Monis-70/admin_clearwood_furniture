import { expect, test, type Page, type Request } from '@playwright/test';

import {
  apiData,
  createDraft,
  csrfHeader,
  toast,
  trashProduct,
  uniquePng,
} from './catalog-helpers';
import { RUN, expectAccessible, signInAsSuperAdmin } from './stack';

/**
 * Media & Gallery against the real local API: real uploads (one file per request, two at a
 * time), the API's de-duplication and refusals, gallery order and primary image, variant images
 * checked through the storefront gallery resolver, remove versus delete, and reload persistence.
 * Every product and file is labelled with the run id and removed in afterAll.
 */
test.describe.configure({ mode: 'serial' });

interface GalleryRow {
  id: string;
  mediaId: string;
  role: string;
  position: number;
  altText: string | null;
  variantId: string | null;
  media: { id: string; originalName: string; deletedAt: string | null };
}

const created: string[] = [];
const ids: { a?: string; b?: string; c?: string; d?: string } = {};
const kept: { a2?: Buffer; beigeVariant?: string } = {};

const png = (label: string, buffer = uniquePng()) => ({
  name: `e2e-${RUN}-${label}.png`,
  mimeType: 'image/png',
  buffer,
});

const galleryList = (page: Page) =>
  page.getByRole('list', { name: 'Product images in display order' });
const uploads = (page: Page) => page.getByRole('region', { name: 'Uploads' });

async function cardNames(page: Page): Promise<string[]> {
  return galleryList(page)
    .getByRole('listitem')
    .evaluateAll((items) => items.map((item) => item.getAttribute('aria-label') ?? ''));
}

async function rowsOf(page: Page, productId: string): Promise<GalleryRow[]> {
  const rows = await apiData<GalleryRow[]>(page, `/admin/products/${productId}/media`);
  return [...rows].sort((a, b) => a.position - b.position);
}

async function openMedia(page: Page, productId: string) {
  await page.goto(`/catalog/products/edit?id=${productId}&tab=media`);
  await expect(page.getByRole('heading', { name: 'Media & Gallery' })).toBeVisible();
}

async function newProduct(page: Page, key: keyof typeof ids, label: string) {
  const id = await createDraft(
    page,
    `E2E ${label} ${RUN}`,
    `E2E-MG${key.toUpperCase()}-${RUN.toUpperCase()}`,
  );
  ids[key] = id;
  created.push(id);
  return id;
}

const isUpload = (request: Request) =>
  request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/admin/media/upload';

/** Upload requests as the browser sent them: how many, how many at once, and their answers. */
function watchUploads(page: Page) {
  const state = { started: 0, inFlight: 0, max: 0, statuses: [] as number[] };
  page.on('request', (request) => {
    if (!isUpload(request)) return;
    state.started += 1;
    state.inFlight += 1;
    state.max = Math.max(state.max, state.inFlight);
  });
  const finish = (request: Request) => {
    if (isUpload(request)) state.inFlight -= 1;
  };
  page.on('requestfinished', finish);
  page.on('requestfailed', finish);
  page.on('response', (response) => {
    if (isUpload(response.request())) state.statuses.push(response.status());
  });
  return state;
}

test.afterAll(async ({ browser }, testInfo) => {
  const context = await browser.newContext(testInfo.project.use);
  const page = await context.newPage();
  await signInAsSuperAdmin(page);
  const headers = await csrfHeader(page);
  for (const id of created) {
    await page.request.post(`/api/v1/admin/catalog/products/${id}/unpublish`, { headers });
    await page.request.delete(`/api/v1/admin/catalog/products/${id}`, { headers });
  }
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

test('1. upload three images; they appear in the gallery and survive a reload', async ({
  page,
}) => {
  const sent = watchUploads(page);
  await signInAsSuperAdmin(page);
  const id = await newProduct(page, 'a', 'Gallery');
  await openMedia(page, id);
  await expect(page.getByText('No images yet')).toBeVisible();

  kept.a2 = uniquePng();
  await page.getByLabel('Upload images').setInputFiles([png('a1'), png('a2', kept.a2), png('a3')]);
  await expect(uploads(page).getByText('3 uploaded successfully')).toBeVisible();
  await expect(uploads(page).getByText('Added to the gallery')).toHaveCount(3);
  await expect(galleryList(page).getByRole('listitem')).toHaveCount(3);
  expect(sent.started).toBe(3);
  expect(sent.max).toBeLessThanOrEqual(2);

  await page.reload();
  await expect(galleryList(page).getByRole('listitem')).toHaveCount(3);
  expect(await cardNames(page)).toEqual([
    `Image 1: e2e-${RUN}-a1.png`,
    `Image 2: e2e-${RUN}-a2.png`,
    `Image 3: e2e-${RUN}-a3.png`,
  ]);
  const rows = await rowsOf(page, id);
  expect(rows.map((row) => row.role)).toEqual(['PRIMARY', 'GALLERY', 'GALLERY']);
  const workbench = page.getByRole('complementary', { name: 'Product workbench' });
  await expect(
    workbench.getByRole('list', { name: 'Media status' }).getByText('Primary image configured'),
  ).toBeVisible();
  await expectAccessible(page);
});

test('2. upload four at once: one request per file, two at a time, real per-file progress', async ({
  page,
}) => {
  const sent = watchUploads(page);
  await signInAsSuperAdmin(page);
  const id = await newProduct(page, 'b', 'Order');
  await openMedia(page, id);

  // Record every progress value the page shows, so fast uploads cannot hide it.
  await page.evaluate(() => {
    const seen: Record<string, number[]> = {};
    (window as unknown as { __progress: typeof seen }).__progress = seen;
    const record = (element: Element) => {
      const name = element.getAttribute('aria-label') ?? '';
      if (!name.startsWith('Upload progress for ')) return;
      (seen[name] ??= []).push(Number(element.getAttribute('aria-valuenow')));
    };
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') record(mutation.target as Element);
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element)
            node.querySelectorAll('[role="progressbar"]').forEach(record);
        });
      }
    }).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-valuenow'],
    });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 20,
    downloadThroughput: -1,
    uploadThroughput: 96 * 1024,
  });

  await page
    .getByLabel('Upload images')
    .setInputFiles(['b1', 'b2', 'b3', 'b4'].map((label) => png(label, uniquePng(160))));
  await expect(page.getByRole('progressbar', { name: 'Overall upload progress' })).toBeVisible();
  await expect(uploads(page).getByText('4 uploaded successfully')).toBeVisible({
    timeout: 60_000,
  });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });

  expect(sent.started).toBe(4);
  expect(sent.max).toBe(2);
  expect(sent.statuses).toEqual([201, 201, 201, 201]);
  const progress = await page.evaluate(
    () => (window as unknown as { __progress: Record<string, number[]> }).__progress,
  );
  expect(Object.keys(progress).sort()).toEqual(
    ['b1', 'b2', 'b3', 'b4'].map((label) => `Upload progress for e2e-${RUN}-${label}.png`),
  );
  // Real byte counts: at least one value strictly between the start and the end.
  expect(
    Object.values(progress)
      .flat()
      .some((value) => value > 0 && value < 100),
  ).toBe(true);
  await expect(galleryList(page).getByRole('listitem')).toHaveCount(4);
});

test('3. make image 2 primary; the old primary becomes a gallery image', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await openMedia(page, ids.a!);
  const cards = galleryList(page).getByRole('listitem');
  await galleryList(page).getByRole('button', { name: 'Make primary (image 2)' }).click();
  await expect(page.getByText('2 unsaved gallery changes')).toBeVisible();
  await page.getByRole('button', { name: 'Save gallery' }).click();
  await expect(toast(page, 'Gallery saved')).toBeVisible();
  await expect(cards.nth(1).getByText('Primary', { exact: true })).toBeVisible();
  await expect(cards.nth(0).getByText('Gallery', { exact: true })).toBeVisible();
  const rows = await rowsOf(page, ids.a!);
  expect(rows.map((row) => [row.media.originalName, row.role])).toEqual([
    [`e2e-${RUN}-a1.png`, 'GALLERY'],
    [`e2e-${RUN}-a2.png`, 'PRIMARY'],
    [`e2e-${RUN}-a3.png`, 'GALLERY'],
  ]);
});

test('4. drag image 4 to position 1, save, and the order holds after a reload', async ({
  page,
}) => {
  await signInAsSuperAdmin(page);
  await openMedia(page, ids.b!);
  const cards = galleryList(page).getByRole('listitem');
  await expect(cards).toHaveCount(4);
  await page.getByTestId('drag-handle-4').dragTo(cards.first());
  await expect(page.getByText('1 unsaved gallery change')).toBeVisible();
  expect(await cardNames(page)).toEqual([
    `Image 1: e2e-${RUN}-b4.png`,
    `Image 2: e2e-${RUN}-b1.png`,
    `Image 3: e2e-${RUN}-b2.png`,
    `Image 4: e2e-${RUN}-b3.png`,
  ]);
  await page.getByRole('button', { name: 'Save gallery' }).click();
  await expect(toast(page, 'Gallery saved')).toBeVisible();

  await page.reload();
  await expect(cards).toHaveCount(4);
  expect(await cardNames(page)).toEqual([
    `Image 1: e2e-${RUN}-b4.png`,
    `Image 2: e2e-${RUN}-b1.png`,
    `Image 3: e2e-${RUN}-b2.png`,
    `Image 4: e2e-${RUN}-b3.png`,
  ]);
  const rows = await rowsOf(page, ids.b!);
  expect(rows.map((row) => row.position)).toEqual([0, 1, 2, 3]);
});

test('5. attach an existing library image: linked, never copied', async ({ page }) => {
  await signInAsSuperAdmin(page);
  const id = await newProduct(page, 'c', 'Library');
  await openMedia(page, id);
  await page.getByRole('button', { name: 'Select from media library' }).click();
  const picker = page.getByRole('dialog', { name: /^Select images for E2E Library/ });
  await picker.getByRole('searchbox', { name: /Search images/ }).fill(`e2e-${RUN}-a1`);
  const choices = picker.getByRole('list', { name: 'Images' }).getByRole('button');
  await expect(choices).toHaveCount(1);
  await choices.first().click();
  await picker.getByRole('button', { name: 'Use 1 image' }).click();
  await expect(toast(page, '1 image added')).toBeVisible();
  await expect(galleryList(page).getByRole('listitem')).toHaveCount(1);

  const library = await apiData<{ id: string }[]>(
    page,
    `/admin/media?search=${encodeURIComponent(`e2e-${RUN}-a1`)}`,
  );
  expect(library).toHaveLength(1);
  const detail = await apiData<{ usage: { usageType: string; entityId: string }[] }>(
    page,
    `/admin/media/${library[0]!.id}`,
  );
  expect(detail.usage.map((usage) => usage.entityId).sort()).toEqual([ids.a!, id].sort());
});

test('6. a variant image, checked through the storefront gallery resolver', async ({ page }) => {
  await signInAsSuperAdmin(page);
  const id = await newProduct(page, 'd', 'Variant');
  // What publishing needs: a tax class, variants and a primary image.
  await page.goto(`/catalog/products/edit?id=${id}&tab=pricing`);
  await page.getByLabel('Tax class').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Pricing saved')).toBeVisible();
  await page.goto(`/catalog/products/edit?id=${id}&tab=variants`);
  await page.getByRole('button', { name: 'Generate combinations' }).click();
  const matrix = page.getByRole('dialog', { name: 'Generate combinations' });
  await matrix.getByRole('checkbox', { name: 'Beige', exact: true }).check();
  await matrix.getByRole('checkbox', { name: 'Ivory', exact: true }).check();
  await matrix.getByRole('button', { name: 'Preview combinations' }).click();
  await matrix.getByRole('button', { name: 'Create 2 variants' }).click();
  await expect(toast(page, '2 variants created')).toBeVisible();

  const product = await apiData<{
    slug: string;
    variants: { id: string; name: string | null; sku: string }[];
  }>(page, `/admin/catalog/products/${id}`);
  const beige = product.variants.find((v) => /beige/i.test(`${v.name ?? ''} ${v.sku}`))!;
  const ivory = product.variants.find((v) => /ivory/i.test(`${v.name ?? ''} ${v.sku}`))!;
  kept.beigeVariant = beige.id;

  await openMedia(page, id);
  await page.getByLabel('Upload images').setInputFiles([png('d-all'), png('d-beige')]);
  await expect(uploads(page).getByText('2 uploaded successfully')).toBeVisible();
  await expect(galleryList(page).getByRole('listitem')).toHaveCount(2);
  await galleryList(page).getByRole('button', { name: 'Details for image 2' }).click();
  const sheet = page.getByRole('dialog', { name: 'Image 2 details' });
  await sheet.getByLabel('Shown for').selectOption(`variant:${beige.id}`);
  await sheet.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Save gallery' }).click();
  await expect(toast(page, 'Gallery saved')).toBeVisible();
  const rows = await rowsOf(page, id);
  expect(rows[1]!.variantId).toBe(beige.id);

  const workbench = page.getByRole('complementary', { name: 'Product workbench' });
  await workbench.getByRole('button', { name: 'Publish now' }).click();
  await expect(toast(page, 'Product published')).toBeVisible();

  // The storefront's own answer: the Beige image leads for Beige and is hidden for Ivory.
  const publicGallery = async (variantId: string) => {
    const response = await page.request.get(
      `/api/v1/catalog/products/${product.slug}/gallery?variantId=${variantId}`,
    );
    expect(response.status()).toBe(200);
    return ((await response.json()) as { data: { items: { productMediaId: string }[] } }).data
      .items;
  };
  expect((await publicGallery(beige.id)).map((item) => item.productMediaId)).toEqual([
    rows[1]!.id,
    rows[0]!.id,
  ]);
  expect((await publicGallery(ivory.id)).map((item) => item.productMediaId)).toEqual([rows[0]!.id]);

  // The same answer inside the admin.
  await page.getByText('What customers see').click();
  await page.getByLabel('Customer chooses').selectOption(beige.id);
  const storefront = page.getByRole('list', { name: 'Storefront gallery order' });
  await expect(storefront.getByRole('listitem')).toHaveCount(2);
  await expect(storefront.getByRole('listitem').first()).toContainText('Gallery');
  await expect(storefront.getByRole('listitem').nth(1)).toContainText('Primary');

  await workbench.getByRole('button', { name: 'Unpublish' }).click();
  await expect(toast(page, 'Product unpublished')).toBeVisible();
});

test('7. uploading a file the library already has offers the existing image', async ({ page }) => {
  const sent = watchUploads(page);
  await signInAsSuperAdmin(page);
  await openMedia(page, ids.c!);
  await page.getByLabel('Upload images').setInputFiles(png('dup', kept.a2!));
  const row = uploads(page)
    .getByRole('listitem')
    .filter({ hasText: `e2e-${RUN}-dup.png` });
  await expect(row.getByText('This image is already in your media library.')).toBeVisible();
  await expect(galleryList(page).getByRole('listitem')).toHaveCount(1);
  await row.getByRole('button', { name: `Use existing image for e2e-${RUN}-dup.png` }).click();
  await expect(row.getByText('Added to the gallery')).toBeVisible();
  await expect(galleryList(page).getByRole('listitem')).toHaveCount(2);
  expect(await cardNames(page)).toContain(`Image 2: e2e-${RUN}-a2.png`);
  expect(sent.statuses).toEqual([201]);
  // No second copy of the file was stored.
  const copies = await apiData<unknown[]>(
    page,
    `/admin/media?search=${encodeURIComponent(`e2e-${RUN}-dup`)}`,
  );
  expect(copies).toHaveLength(0);
});

test('8. one refused file does not undo the others', async ({ page }) => {
  const sent = watchUploads(page);
  await signInAsSuperAdmin(page);
  await openMedia(page, ids.c!);
  await page
    .getByLabel('Upload images')
    .setInputFiles([
      png('c1'),
      png('c2'),
      { name: `e2e-${RUN}-fake.png`, mimeType: 'image/png', buffer: Buffer.from('not an image') },
      png('c3'),
    ]);
  await expect(uploads(page).getByText('3 uploaded successfully / 1 failed')).toBeVisible();
  const failed = uploads(page)
    .getByRole('listitem')
    .filter({ hasText: `e2e-${RUN}-fake.png` });
  await expect(failed.getByText(/^Unsupported file:/)).toBeVisible();
  await expect(failed.getByRole('button', { name: /^Retry/ })).toHaveCount(0);
  expect(sent.statuses.filter((status) => status === 415)).toHaveLength(1);
  expect(sent.statuses.filter((status) => status === 201)).toHaveLength(3);
  await expect(galleryList(page).getByRole('listitem')).toHaveCount(5);
  await failed.getByRole('button', { name: `Remove e2e-${RUN}-fake.png from the list` }).click();
  await expect(failed).toHaveCount(0);
});

test('9. removing an image from the product keeps the file in the library', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await openMedia(page, ids.a!);
  const before = await rowsOf(page, ids.a!);
  await galleryList(page).getByRole('button', { name: 'More actions for image 3' }).click();
  await page.getByRole('menuitem', { name: 'Remove from this product…' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Remove this image from the product?' });
  await confirm.getByRole('button', { name: 'Remove from product' }).click();
  await expect(toast(page, 'Image removed from this product')).toBeVisible();
  await expect(galleryList(page).getByRole('listitem')).toHaveCount(2);
  const file = await apiData<{ id: string; deletedAt: string | null }>(
    page,
    `/admin/media/${before[2]!.mediaId}`,
  );
  expect(file.deletedAt).toBeNull();
});

test('10. deleting a file that is still used is refused by the API (MEDIA_IN_USE)', async ({
  page,
}) => {
  await signInAsSuperAdmin(page);
  await openMedia(page, ids.a!);
  const rows = await rowsOf(page, ids.a!);
  await galleryList(page).getByRole('button', { name: 'More actions for image 1' }).click();
  await page.getByRole('menuitem', { name: 'Delete media file…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete the media file?' });
  await expect(dialog.getByRole('heading', { name: /^Used in [1-9]\d* places?$/ })).toBeVisible();
  await expect(dialog.getByText('This product', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete permanently…' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Delete this file permanently?' });
  await confirm.getByLabel(/Type DELETE to confirm/).fill('DELETE');
  const answer = page.waitForResponse(
    (response) => response.request().method() === 'DELETE' && response.url().includes('/permanent'),
  );
  await confirm.getByRole('button', { name: 'Delete permanently' }).click();
  const refused = await answer;
  expect(refused.status()).toBe(409);
  expect(((await refused.json()) as { error: { code: string } }).error.code).toBe('MEDIA_IN_USE');
  await expect(confirm.getByText('Image still in use')).toBeVisible();
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await dialog.getByRole('button', { name: 'Keep the file' }).click();
  await expect(dialog).toBeHidden();
  const file = await apiData<{ deletedAt: string | null }>(
    page,
    `/admin/media/${rows[0]!.mediaId}`,
  );
  expect(file.deletedAt).toBeNull();
  await expect(galleryList(page).getByRole('listitem')).toHaveCount(2);
});

test('12. alt text and role survive a reload', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await openMedia(page, ids.a!);
  await page.getByRole('textbox', { name: 'Alt text for image 1' }).fill('E2E teak sofa, front');
  await galleryList(page).getByRole('button', { name: 'Details for image 2' }).click();
  const sheet = page.getByRole('dialog', { name: 'Image 2 details' });
  await sheet.getByLabel('Role').selectOption('LIFESTYLE');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Save gallery' }).click();
  await expect(toast(page, 'Gallery saved')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Alt text for image 1' })).toHaveValue(
    'E2E teak sofa, front',
  );
  await expect(
    galleryList(page).getByRole('listitem').nth(1).getByText('Lifestyle', { exact: true }),
  ).toBeVisible();
  const rows = await rowsOf(page, ids.a!);
  expect(rows[0]!.altText).toBe('E2E teak sofa, front');
  expect(rows[1]!.role).toBe('LIFESTYLE');
});

test('security: CSRF, cross-product variants and size limits are enforced by the API', async ({
  page,
}) => {
  const sent = watchUploads(page);
  await signInAsSuperAdmin(page);
  const headers = await csrfHeader(page);
  const rows = await rowsOf(page, ids.a!);
  const attach = `/api/v1/admin/products/${ids.a!}/media`;

  const noCsrf = await page.request.post(attach, {
    data: { items: [{ mediaId: rows[0]!.mediaId }] },
  });
  expect(noCsrf.status()).toBe(403);
  expect(((await noCsrf.json()) as { error: { code: string } }).error.code).toBe(
    'CSRF_TOKEN_INVALID',
  );

  // A variant of product D cannot carry an image of product A.
  const foreign = await page.request.post(attach, {
    headers,
    data: { items: [{ mediaId: rows[0]!.mediaId, variantId: kept.beigeVariant! }] },
  });
  expect(foreign.status()).toBe(422);
  expect(await foreign.text()).toContain('different product');

  const tooBig = Buffer.alloc(16 * 1_048_576, 1);
  const refusedBySize = await page.request.post('/api/v1/admin/media/upload', {
    headers,
    multipart: {
      files: { name: `e2e-${RUN}-huge.png`, mimeType: 'image/png', buffer: tooBig },
    },
  });
  expect(refusedBySize.status()).toBe(413);

  // The admin refuses the same file before sending it.
  await openMedia(page, ids.a!);
  await page
    .getByLabel('Upload images')
    .setInputFiles({ name: `e2e-${RUN}-huge.png`, mimeType: 'image/png', buffer: tooBig });
  await expect(uploads(page).getByText(/is over the 15 MB limit/)).toBeVisible();
  expect(sent.started).toBe(0);
});

test('11. the gallery on a phone: upload, reorder, details sheet, preview @mobile', async ({
  page,
}) => {
  await signInAsSuperAdmin(page);
  const id = await createDraft(page, `E2E Phone Gallery ${RUN}`, `E2E-PG-${RUN.toUpperCase()}`);
  created.push(id);
  await openMedia(page, id);
  await page.getByLabel('Upload images').setInputFiles([png('m1'), png('m2')]);
  await expect(uploads(page).getByText('2 uploaded successfully')).toBeVisible();
  await expect(galleryList(page).getByRole('listitem')).toHaveCount(2);

  await page.getByRole('button', { name: 'Move image 2 earlier' }).click();
  await page.getByRole('button', { name: 'Details for image 1' }).click();
  const sheet = page.getByRole('dialog', { name: 'Image 1 details' });
  const box = await sheet.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await sheet.getByLabel('Alt text on this product').fill('E2E phone view');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Save gallery' }).click();
  await expect(toast(page, 'Gallery saved')).toBeVisible();
  expect(await cardNames(page)).toEqual([
    `Image 1: e2e-${RUN}-m2.png`,
    `Image 2: e2e-${RUN}-m1.png`,
  ]);

  await page.getByRole('button', { name: 'Preview image 1' }).click();
  const preview = page.getByRole('dialog', { name: 'Image 1 of 2' });
  await expect(preview).toBeVisible();
  const previewBox = await preview.boundingBox();
  expect(previewBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await preview.getByRole('button', { name: 'Next image' }).click();
  await expect(page.getByRole('dialog', { name: 'Image 2 of 2' })).toBeVisible();
  await page.keyboard.press('Escape');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expectAccessible(page);
  const rows = await rowsOf(page, id);
  expect(rows[0]!.altText).toBe('E2E phone view');
  await trashProduct(page, id);
});
