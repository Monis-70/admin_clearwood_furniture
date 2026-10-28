import { expect, test, type APIRequestContext } from '@playwright/test';

import { createDraft, toast, trashProduct, uniquePng } from './catalog-helpers';
import { RUN, signInAsSuperAdmin } from './stack';

/**
 * The mandatory end-to-end gate: a change made in the admin must reach the PUBLIC API a customer
 * storefront reads. Nothing here recomputes a business rule — the public answer is the authority,
 * and assertions only compare it with what the admin shows or with its own earlier answer.
 *
 * The `request` fixture is a separate context with no admin cookies, so every read below is exactly
 * what an anonymous visitor gets.
 */
test.describe.configure({ mode: 'serial' });

const NAME = `E2E Storefront ${RUN}`;
const SKU = `E2E-SF-${RUN.toUpperCase()}`;
const state: { id?: string; slug?: string } = {};

/** Waits for the public answer to settle: the API may serve a cached copy for a moment. */
async function publicJson<T>(request: APIRequestContext, path: string): Promise<T> {
  const response = await request.get(`/api/v1${path}`);
  expect(response.status(), `${path} answered ${response.status()}`).toBe(200);
  return ((await response.json()) as { data: T }).data;
}

async function publicStatus(request: APIRequestContext, path: string): Promise<number> {
  return (await request.get(`/api/v1${path}`)).status();
}

/**
 * Runs even when a test above stops half-way. A published E2E product left behind would stay on
 * the storefront and would also change the seeded low-stock count other specs assert.
 */
test.afterAll(async ({ browser }, testInfo) => {
  const context = await browser.newContext(testInfo.project.use);
  const page = await context.newPage();
  await signInAsSuperAdmin(page);
  const csrf = (await context.cookies()).find((cookie) => cookie.name === 'cw_adm_csrf');
  const list = await page.request.get(
    `/api/v1/admin/catalog/products?limit=100&q=${encodeURIComponent('E2E-SF')}`,
  );
  if (list.ok()) {
    const body = (await list.json()) as { data?: { items?: { id: string; sku: string }[] } };
    for (const product of (body.data?.items ?? []).filter((p) => p.sku.startsWith('E2E-SF-'))) {
      await page.request.delete(`/api/v1/admin/catalog/products/${product.id}`, {
        headers: { 'x-csrf-token': decodeURIComponent(csrf!.value) },
      });
    }
  }
  await context.close();
});

test('a product published in the admin is served to the storefront with its own content', async ({
  page,
  request,
}) => {
  await signInAsSuperAdmin(page);
  state.id = await createDraft(page, NAME, SKU);
  state.slug = await page.getByLabel('URL slug').inputValue();
  expect(state.slug, 'the admin derives a slug from the name').toBeTruthy();

  // Draft products are not public.
  expect(await publicStatus(request, `/catalog/products/${state.slug}`)).toBe(404);

  await page.getByLabel('Subtitle').fill('Sheesham frame, storefront check');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Product details saved')).toBeVisible();

  const workbench = page.getByRole('complementary', { name: 'Product workbench' });
  await workbench.getByRole('link', { name: /^Fix this\s*: Assign a tax class/ }).click();
  await page.getByLabel('Tax class').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Pricing saved')).toBeVisible();

  await workbench.getByRole('link', { name: /^Fix this\s*: Add at least one variant/ }).click();
  await page.getByRole('button', { name: 'Generate combinations' }).click();
  const matrix = page.getByRole('dialog', { name: 'Generate combinations' });
  await matrix.getByRole('checkbox', { name: 'Charcoal', exact: true }).check();
  await matrix.getByRole('button', { name: 'Preview combinations' }).click();
  await matrix.getByRole('button', { name: 'Create 1 variant', exact: true }).click();
  await expect(toast(page, '1 variant created')).toBeVisible();

  await workbench.getByRole('link', { name: /^Fix this\s*: Set a primary image/ }).click();
  await page.getByLabel('Upload images').setInputFiles(
    ['sf1', 'sf2'].map((label) => ({
      name: `e2e-${RUN}-${label}.png`,
      mimeType: 'image/png',
      buffer: uniquePng(),
    })),
  );
  const uploads = page.getByRole('region', { name: 'Uploads' });
  await expect(uploads.getByText('Added to the gallery')).toHaveCount(2, { timeout: 60_000 });

  await expect(workbench.getByRole('link', { name: /^Fix this\s*: / })).toHaveCount(0);
  await workbench.getByRole('button', { name: 'Publish now' }).click();
  await expect(toast(page, 'Product published')).toBeVisible();

  const detail = await publicJson<{ name: string; sku: string; subtitle: string | null }>(
    request,
    `/catalog/products/${state.slug}`,
  );
  expect(detail.name).toBe(NAME);
  expect(detail.sku).toBe(SKU);
  expect(detail.subtitle).toBe('Sheesham frame, storefront check');

  const gallery = await publicJson<{ items: { url: string; role: string }[] }>(
    request,
    `/catalog/products/${state.slug}/gallery`,
  );
  expect(gallery.items.length, 'both uploaded images reach the storefront gallery').toBe(2);
  expect(gallery.items.filter((image) => image.role === 'PRIMARY')).toHaveLength(1);
  for (const image of gallery.items) expect(image.url).toMatch(/^https?:\/\//);

  // The price comes from the pricing engine; the test only records what the API answers.
  const price = await publicJson<{ lines: { unitPricePaise: number }[] }>(
    request,
    `/catalog/products/${state.slug}/price`,
  );
  expect(price.lines[0]!.unitPricePaise).toBeGreaterThan(0);
});

test('an edit saved in the admin reaches the storefront', async ({ page, request }) => {
  await signInAsSuperAdmin(page);
  await page.goto(`/catalog/products/edit?id=${state.id}`);
  const subtitle = `Edited for the storefront ${Date.now()}`;
  await page.getByLabel('Subtitle').fill(subtitle);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Product details saved')).toBeVisible();

  await expect
    .poll(
      async () =>
        (await publicJson<{ subtitle: string | null }>(request, `/catalog/products/${state.slug}`))
          .subtitle,
      { timeout: 15_000, message: 'the storefront still serves the old subtitle' },
    )
    .toBe(subtitle);
});

test('the gallery order and primary image chosen in the admin are the storefront order', async ({
  page,
  request,
}) => {
  await signInAsSuperAdmin(page);
  await page.goto(`/catalog/products/edit?id=${state.id}&tab=media`);
  await expect(page.getByRole('heading', { name: 'Media & Gallery' })).toBeVisible();
  const gallery = page.getByRole('list', { name: 'Product images in display order' });
  const cards = gallery.getByRole('listitem');
  await expect(cards).toHaveCount(2);

  const before = await publicJson<{ items: { mediaId: string; role: string }[] }>(
    request,
    `/catalog/products/${state.slug}/gallery`,
  );
  const second = before.items[1]!.mediaId;
  await gallery.getByRole('button', { name: 'Make primary (image 2)' }).click();
  await expect(page.getByText(/unsaved gallery change/)).toBeVisible();
  await page.getByRole('button', { name: 'Save gallery' }).click();
  await expect(toast(page, 'Gallery saved')).toBeVisible();
  await expect(cards.nth(1).getByText('Primary', { exact: true })).toBeVisible();

  await expect
    .poll(
      async () =>
        (
          await publicJson<{ items: { mediaId: string; role: string }[] }>(
            request,
            `/catalog/products/${state.slug}/gallery`,
          )
        ).items.find((image) => image.role === 'PRIMARY')?.mediaId,
      { timeout: 15_000, message: 'the storefront still shows the old primary image' },
    )
    .toBe(second);
});

test('merchandising set in the admin decides what the storefront features', async ({
  page,
  request,
}) => {
  await signInAsSuperAdmin(page);
  await page.goto(`/catalog/products/edit?id=${state.id}&tab=merchandising`);
  const featured = page.getByLabel('Featured', { exact: true });
  await featured.check();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Merchandising saved')).toBeVisible();

  await expect
    .poll(
      async () =>
        (await publicJson<{ slug: string }[]>(request, '/catalog/featured?limit=50')).map(
          (p) => p.slug,
        ),
      { timeout: 15_000, message: 'the storefront does not feature the product yet' },
    )
    .toContain(state.slug!);

  await page.getByLabel('Featured', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Merchandising saved')).toBeVisible();
  await expect
    .poll(async () =>
      (await publicJson<{ slug: string }[]>(request, '/catalog/featured?limit=50')).map(
        (p) => p.slug,
      ),
    )
    .not.toContain(state.slug!);
});

test('a price rule created in the admin changes the price the storefront quotes', async ({
  page,
  request,
}) => {
  await signInAsSuperAdmin(page);
  const quoted = async () =>
    (
      await publicJson<{ lines: { unitPricePaise: number }[] }>(
        request,
        `/catalog/products/${state.slug}/price`,
      )
    ).lines[0]!.unitPricePaise;
  const before = await quoted();

  const name = `E2E Storefront rule ${RUN}`;
  await page.goto(`/pricing/price-rules?productId=${state.id}`);
  await page.getByRole('button', { name: 'New price rule' }).click();
  const dialog = page.getByRole('dialog', { name: 'New price rule' });
  await dialog.getByLabel(/^Name/).fill(name);
  await expect(dialog.getByText('Product: The selected product')).toBeVisible();
  await dialog.getByLabel(/^Percent/).fill('10');
  await dialog.getByRole('button', { name: 'Create rule' }).click();
  await expect(toast(page, 'Price rule created')).toBeVisible();

  // The engine decides the number; the test only requires that the public answer moved.
  await expect
    .poll(quoted, { timeout: 15_000, message: 'the storefront price ignored the new rule' })
    .not.toBe(before);

  const row = page.getByRole('row', { name: new RegExp(name) });
  await row.getByRole('button', { name: `Actions for ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete rule' }).click();
  await expect(toast(page, 'Price rule deleted')).toBeVisible();

  await expect.poll(quoted, { timeout: 15_000 }).toBe(before);
});

test('unpublishing in the admin takes the product off the storefront, and cleans up', async ({
  page,
  request,
}) => {
  await signInAsSuperAdmin(page);
  await page.goto(`/catalog/products/edit?id=${state.id}&tab=publishing`);
  await page
    .getByRole('region', { name: 'Take it off the storefront' })
    .getByRole('button', { name: 'Unpublish' })
    .click();
  await expect(toast(page, 'Product unpublished')).toBeVisible();

  await expect
    .poll(() => publicStatus(request, `/catalog/products/${state.slug}`), {
      timeout: 15_000,
      message: 'the storefront still serves the unpublished product',
    })
    .toBe(404);

  await trashProduct(page, state.id!);
  expect(await publicStatus(request, `/catalog/products/${state.slug}`)).toBe(404);
});

test('a category created in the admin joins the storefront tree with its banner, and leaves it when switched off', async ({
  page,
  request,
}) => {
  await signInAsSuperAdmin(page);
  const name = `E2E Sync Category ${RUN}`;
  const slugs = async () =>
    (await publicJson<{ slug: string }[]>(request, '/catalog/categories/tree')).map((c) => c.slug);

  await page.goto('/catalog/categories');
  await page.getByRole('button', { name: 'New category' }).click();
  const create = page.getByRole('dialog', { name: 'New category' });
  await create.getByLabel('Name').fill(name);
  await create.getByRole('button', { name: 'Create category' }).click();
  await expect(toast(page, 'Category created')).toBeVisible();

  const editor = page.getByRole('dialog', { name });
  const slug = await editor.getByLabel(/^URL slug/).inputValue();
  expect(slug).toBeTruthy();
  await expect.poll(slugs, { timeout: 15_000 }).toContain(slug);

  // A banner uploaded from the category editor is the banner the storefront serves.
  await editor.getByLabel('Upload banner', { exact: true }).setInputFiles({
    name: `e2e-${RUN}-category-banner.png`,
    mimeType: 'image/png',
    buffer: uniquePng(),
  });
  await expect(editor.getByText(`e2e-${RUN}-category-banner.png`)).toBeVisible({
    timeout: 30_000,
  });
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Category saved')).toBeVisible();
  const banner = await publicJson<{
    bannerMediaId: string | null;
    bannerMedia: { url: string } | null;
  }>(request, `/catalog/categories/${slug}`);
  expect(banner.bannerMediaId, 'the storefront category has no banner').toBeTruthy();
  expect(banner.bannerMedia?.url).toMatch(/^https?:\/\//);
  expect((await request.get(banner.bannerMedia!.url)).status()).toBe(200);

  await editor.getByLabel('Active', { exact: true }).uncheck();
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Category saved')).toBeVisible();
  await expect
    .poll(slugs, { timeout: 15_000, message: 'an inactive category is still on the storefront' })
    .not.toContain(slug);

  await page.keyboard.press('Escape');
  await page.getByLabel('Find a category').fill(RUN);
  const tree = page.getByRole('region', { name: 'Category tree' });
  await tree.getByRole('button', { name: `Actions for ${name}` }).click();
  await page.getByRole('menuitem', { name: /^Delete(…|\.\.\.)?$/ }).click();
  const remove = page.getByRole('dialog', { name: `Delete ${name}?` });
  await remove.getByLabel(`Type ${name} to confirm`).fill(name);
  await remove.getByRole('button', { name: 'Delete category' }).click();
  await expect(toast(page, `${name} deleted`)).toBeVisible();
});

test('a collection curated in the admin is the collection the storefront lists', async ({
  page,
  request,
}) => {
  await signInAsSuperAdmin(page);
  const name = `E2E Sync Collection ${RUN}`;
  await page.goto('/catalog/collections/new');
  await page.getByLabel(/^Name/).fill(name);
  await page.getByLabel('How products are chosen').selectOption('MANUAL');
  await page.getByRole('button', { name: 'Create collection' }).click();
  await expect(toast(page, 'Collection created')).toBeVisible();
  await expect(page).toHaveURL(/tab=products/);

  const members = page.getByRole('region', { name: /^Products/ });
  for (const term of ['Trikon', 'Amber']) {
    await members.getByLabel('Add a product').fill(term);
    await members
      .getByRole('button', { name: /^.+ Add / })
      .first()
      .click();
    await expect(toast(page, 'Collection products saved')).toBeVisible();
  }
  const list = page.getByRole('list', { name: 'Products in this collection' });
  await expect(list.getByRole('listitem')).toHaveCount(2);

  const all = await publicJson<{ slug: string; name: string; productCount: number }[]>(
    request,
    '/catalog/collections',
  );
  const mine = all.find((c) => c.name === name);
  expect(mine, 'the new collection is not on the storefront').toBeDefined();
  expect(mine!.productCount).toBe(2);

  const detail = await publicJson<{ products: { items: { name: string }[] } }>(
    request,
    `/catalog/collections/${mine!.slug}`,
  );
  const shown = detail.products.items.map((p) => p.name);
  expect(shown.some((n) => n.includes('Trikon'))).toBe(true);
  expect(shown.some((n) => n.includes('Amber'))).toBe(true);

  const workbench = page.getByRole('complementary', { name: 'Collection workbench' });
  await workbench.getByRole('button', { name: /^Delete/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete collection' }).click();
  await expect(toast(page, 'Collection deleted')).toBeVisible();
  await expect
    .poll(
      async () =>
        (await publicJson<{ name: string }[]>(request, '/catalog/collections')).some(
          (c) => c.name === name,
        ),
      { timeout: 15_000 },
    )
    .toBe(false);
});
