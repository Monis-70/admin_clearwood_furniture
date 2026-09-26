import { expect, test } from '@playwright/test';

import { SOFAS, createDraft, toast, trashProduct, uniquePng } from './catalog-helpers';
import { RUN, appears, expectAccessible, signInAsSuperAdmin, trackApi } from './stack';

/**
 * Catalogue workflows against the real local API (Phase 2). Records created here carry the run
 * label in their name/SKU and are moved to the trash (or deleted) at the end of each test.
 */
test.describe.configure({ mode: 'serial' });

const TRIKON = 'Trikon Nesting Tables';

/**
 * Whatever the outcome, remove what these tests label as theirs (also from an earlier run that
 * stopped half-way): E2E draft products, "E2E rule" price rules and uploaded e2e-*.png files.
 */
test.afterAll(async ({ browser }, testInfo) => {
  const context = await browser.newContext(testInfo.project.use);
  const page = await context.newPage();
  await signInAsSuperAdmin(page);

  await page.goto('/pricing/price-rules');
  await expect(page.getByRole('heading', { level: 1, name: 'Price rules' })).toBeVisible();
  const rules = page.getByRole('table', { name: 'Price rules' });
  if (await appears(rules)) {
    const names = (await rules.textContent())?.match(/E2E rule e2e[a-z0-9]+/g) ?? [];
    for (const name of new Set(names)) {
      const row = rules.getByRole('row', { name: new RegExp(name) });
      await row.getByRole('button', { name: `Actions for ${name}` }).click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete rule' }).click();
      await expect(row).toHaveCount(0);
    }
  }

  await page.goto('/catalog/products?q=E2E&status=DRAFT');
  const products = page.getByRole('table', { name: 'Products' });
  if (await appears(products)) {
    await products.getByLabel('Select all rows on this page').check();
    const bulk = page.getByRole('region', { name: 'Bulk actions' });
    await bulk
      .getByLabel('Action for the selected products')
      .selectOption({ label: 'Move to trash' });
    await bulk.getByRole('button', { name: /^Apply to / }).click();
    await page
      .getByRole('dialog', { name: /^Move to trash: / })
      .getByRole('button', { name: /^Move to trash \d+$/ })
      .click();
    await page
      .getByRole('dialog', { name: /done/i })
      .getByRole('button', { name: 'Close' })
      .first()
      .click();
  }

  await page.goto('/media?q=e2e-e2e');
  const uploads = page.getByRole('list', { name: 'Media' });
  if (await appears(uploads)) {
    const unselected = uploads.getByRole('button', { name: /^Select e2e-e2e/ }).first();
    while (await appears(unselected, 2_000)) await unselected.click();
    await page.getByRole('button', { name: 'Move to trash…' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Move to trash' }).click();
    await expect(toast(page, 'Moved to trash')).toBeVisible();
  }
  await context.close();
});

test('products: list, search, filter and open', async ({ page }) => {
  const calls = trackApi(page);
  await signInAsSuperAdmin(page);
  await page.goto('/catalog/products');
  const table = page.getByRole('table', { name: 'Products' });
  await expect(table.getByRole('row').nth(1)).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('searchbox', { name: 'Search name or SKU' }).fill('Trikon');
  await expect(table.getByRole('row', { name: new RegExp(TRIKON) })).toBeVisible();
  await expect(page).toHaveURL(/q=Trikon/);
  await page.getByRole('searchbox', { name: 'Search name or SKU' }).fill('');

  await page.getByRole('combobox', { name: 'Status' }).selectOption('ACTIVE');
  await expect(page).toHaveURL(/status=ACTIVE/);
  await expect(page.getByText(/^Showing \d+–\d+ of \d+$/)).toBeVisible();
  await page.goto('/catalog/products?status=DRAFT&q=zz-no-such-product');
  await expect(page.getByText('No product matches these filters')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page).toHaveURL(/\/catalog\/products$/);

  await page.goto('/catalog/products?q=Trikon');
  await table.getByRole('link', { name: TRIKON }).click();
  await expect(page).toHaveURL(/\/catalog\/products\/edit\?id=/);
  await expect(page.getByRole('heading', { level: 1, name: TRIKON })).toBeVisible();
  const workbench = page.getByRole('complementary', { name: 'Product workbench' });
  await expect(workbench.getByRole('heading', { name: /Needs attention|Ready/ })).toBeVisible();
  await expectAccessible(page);
  expect(calls.filter((c) => c.status >= 400)).toEqual([]);
});

test('products: create, validate, save, conflict, publish gate, trash', async ({
  page,
  context,
}) => {
  await signInAsSuperAdmin(page);
  const name = `E2E Sofa ${RUN}`;
  const id = await createDraft(page, name, `E2E-${RUN.toUpperCase()}`);

  // Validation: the form refuses an empty name without calling the API.
  const productName = page.getByLabel(/^Product name/);
  await productName.fill('');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(productName).toHaveAttribute('aria-invalid', 'true');
  await productName.fill(name);

  // Save.
  await page.getByLabel('Subtitle').fill('Teak frame, linen cover');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Product details saved')).toBeVisible();

  // Conflict: a second tab saves first; this tab's save is refused, never overwritten.
  const other = await context.newPage();
  await other.goto(`/catalog/products/edit?id=${id}`);
  await other.getByLabel('Subtitle').fill('Saved from the other tab');
  await other.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(other, 'Product details saved')).toBeVisible();
  await other.close();

  await page.getByLabel('Subtitle').fill('Saved from this tab');
  await page.getByRole('button', { name: 'Save changes' }).click();
  const conflict = page.getByRole('dialog', { name: 'Someone else changed this record' });
  await expect(conflict).toBeVisible();
  await conflict.getByRole('button', { name: 'Compare' }).click();
  await expect(conflict.getByRole('cell', { name: 'Saved from the other tab' })).toBeVisible();
  await expectAccessible(page);
  await conflict.getByRole('button', { name: 'Reload latest' }).click();
  await expect(conflict).toBeHidden();
  await expect(page.getByLabel('Subtitle')).toHaveValue('Saved from the other tab');

  // Publish gate: a new draft has no tax class, variant or image; the API says so.
  const workbench = page.getByRole('complementary', { name: 'Product workbench' });
  await expect(workbench.getByRole('heading', { name: 'Needs attention' })).toBeVisible();
  await expect(workbench.getByRole('button', { name: 'Publish now' })).toHaveCount(0);
  await workbench.getByRole('link', { name: 'Review publishing checklist' }).click();
  await expect(page).toHaveURL(/tab=publishing/);
  const blockers = page.getByRole('list', { name: 'Blocking issues' });
  await expect(blockers.getByRole('listitem').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish now' })).toBeDisabled();
  await blockers
    .getByRole('link', { name: /^Fix issue/ })
    .first()
    .click();
  await expect(page).toHaveURL(/tab=(pricing|variants|media|general)/);

  await trashProduct(page, id);
});

test('products: fix every publish blocker, publish, unpublish', async ({ page }) => {
  // Its own draft: seeded live products can carry specifications the gate now refuses, so
  // unpublishing one of them could not be undone from the admin.
  await signInAsSuperAdmin(page);
  const id = await createDraft(page, `E2E Publish ${RUN}`, `E2E-PUB-${RUN.toUpperCase()}`);
  const workbench = page.getByRole('complementary', { name: 'Product workbench' });
  const attention = workbench.getByRole('region', { name: /Needs attention|Ready/ });
  const blockers = () => workbench.getByRole('link', { name: /^Fix this\s*: / });

  // Tax class.
  await workbench.getByRole('link', { name: /^Fix this\s*: Assign a tax class/ }).click();
  await expect(page).toHaveURL(/tab=pricing/);
  await page.getByLabel('Tax class').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Pricing saved')).toBeVisible();

  // One variant.
  await workbench.getByRole('link', { name: /^Fix this\s*: Add at least one variant/ }).click();
  await page.getByRole('button', { name: 'Generate combinations' }).click();
  const matrix = page.getByRole('dialog', { name: 'Generate combinations' });
  await matrix.getByRole('checkbox', { name: 'Charcoal', exact: true }).check();
  await matrix.getByRole('button', { name: 'Preview combinations' }).click();
  await matrix.getByRole('button', { name: 'Create 1 variant', exact: true }).click();
  await expect(toast(page, '1 variant created')).toBeVisible();

  // A primary image: the first image added to a product without one becomes primary.
  await workbench.getByRole('link', { name: /^Fix this\s*: Set a primary image/ }).click();
  await page.getByLabel('Upload images').setInputFiles({
    name: `e2e-${RUN}-publish.png`,
    mimeType: 'image/png',
    buffer: uniquePng(),
  });
  await expect(
    page.getByRole('region', { name: 'Uploads' }).getByText('Added to the gallery'),
  ).toBeVisible();

  await expect(blockers()).toHaveCount(0);
  await expect(attention).toHaveAccessibleName('Ready');
  await workbench.getByRole('button', { name: 'Publish now' }).click();
  await expect(toast(page, 'Product published')).toBeVisible();

  await page.getByRole('link', { name: /^Publishing/ }).click();
  const offStore = page.getByRole('region', { name: 'Take it off the storefront' });
  await offStore.getByRole('button', { name: 'Unpublish' }).click();
  await expect(toast(page, 'Product unpublished')).toBeVisible();
  await expect(page.getByText('Ready: nothing blocks publishing.')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Publish' }).getByRole('button', { name: 'Publish now' }),
  ).toBeEnabled();
  // The workbench follows the same state without a reload.
  await expect(workbench.getByRole('button', { name: 'Publish now' })).toBeVisible();

  await trashProduct(page, id);
});

test('variants: generate a matrix, refuse a duplicate, edit price and stock', async ({ page }) => {
  await signInAsSuperAdmin(page);
  const id = await createDraft(page, `E2E Variants ${RUN}`, `E2E-V-${RUN.toUpperCase()}`);

  await page.goto(`/catalog/products/edit?id=${id}&tab=variants`);
  await expect(page.getByText('No variants yet')).toBeVisible();
  await page.getByRole('button', { name: 'Generate combinations' }).click();
  const matrix = page.getByRole('dialog', { name: 'Generate combinations' });
  await matrix.getByRole('checkbox', { name: 'Beige', exact: true }).check();
  await matrix.getByRole('checkbox', { name: 'Ivory', exact: true }).check();
  await matrix.getByRole('button', { name: 'Preview combinations' }).click();
  await expect(matrix.getByText('2 new, 0 already exist.')).toBeVisible();
  await matrix.getByRole('button', { name: 'Create 2 variants' }).click();
  await expect(toast(page, '2 variants created')).toBeVisible();
  const table = page.getByRole('table').filter({ hasText: 'Beige' });
  await expect(table.getByRole('row')).toHaveCount(3);
  await expectAccessible(page);

  // The API refuses a second Beige variant; the dialog explains and stays open.
  await page.getByRole('button', { name: 'Add variant' }).click();
  const add = page.getByRole('dialog', { name: 'Add a variant' });
  await add.getByLabel('Colour').selectOption({ label: 'Beige' });
  await add.getByRole('button', { name: 'Add variant' }).click();
  await expect(add.getByRole('alert')).toContainText('That combination already exists');
  await add.getByRole('button', { name: 'Cancel' }).click();

  // Edit one variant's price.
  await page
    .getByRole('button', { name: /^Actions for / })
    .first()
    .click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog', { name: /^Edit / });
  await edit.getByLabel(/^Price/).fill('25999');
  await edit.getByRole('button', { name: 'Save variant' }).click();
  await expect(toast(page, 'Variant saved')).toBeVisible();

  // Stock is written through the ledger from the Inventory tab.
  await page
    .getByRole('navigation', { name: 'Product sections' })
    .getByRole('link', { name: 'Inventory', exact: true })
    .click();
  await page
    .getByRole('button', { name: /stock for / })
    .first()
    .click();
  const adjust = page.getByRole('dialog', { name: 'Adjust stock' });
  await adjust.getByLabel('Quantity').fill('6');
  await expect(adjust.getByRole('status').filter({ hasText: 'Stock goes from' })).toContainText(
    'Stock goes from 0 to 6',
  );
  await adjust.getByRole('button', { name: 'Save stock change' }).click();
  await expect(toast(page, 'Stock updated')).toBeVisible();

  await trashProduct(page, id);
});

test('categories: create, edit, find in the tree, move and delete', async ({ page }) => {
  await signInAsSuperAdmin(page);
  const name = `E2E Category ${RUN}`;
  await page.goto('/catalog/categories');
  await page.getByRole('button', { name: 'New category' }).click();
  const create = page.getByRole('dialog', { name: 'New category' });
  await create.getByLabel('Name').fill(name);
  await create.getByRole('button', { name: 'Create category' }).click();
  await expect(toast(page, 'Category created')).toBeVisible();

  const editor = page.getByRole('dialog', { name });
  await expect(editor.getByRole('complementary', { name: 'Category workbench' })).toBeVisible();
  await editor.getByLabel('Short description').fill('Made by the e2e run');
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Category saved')).toBeVisible();
  await expectAccessible(page);
  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();

  await page.getByLabel('Find a category').fill(RUN);
  const tree = page.getByRole('region', { name: 'Category tree' });
  await expect(tree.getByRole('button', { name, exact: true })).toBeVisible();

  await tree.getByRole('button', { name: `Actions for ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Move to another parent…' }).click();
  const move = page.getByRole('dialog', { name: `Move ${name}` });
  await move.getByLabel('New parent').selectOption(SOFAS);
  await move.getByRole('button', { name: 'Move', exact: true }).click();
  await expect(toast(page, 'Category moved')).toBeVisible();

  await tree.getByRole('button', { name: `Actions for ${name}` }).click();
  await page.getByRole('menuitem', { name: /^Delete(…|\.\.\.)?$/ }).click();
  const remove = page.getByRole('dialog', { name: `Delete ${name}?` });
  await expect(remove.getByText('This would affect:')).toBeVisible();
  await remove.getByLabel(`Type ${name} to confirm`).fill(name);
  await remove.getByRole('button', { name: 'Delete category' }).click();
  await expect(toast(page, `${name} deleted`)).toBeVisible();
  await expect(tree.getByRole('button', { name, exact: true })).toHaveCount(0);
});

test('collections: create, add products, order them and delete', async ({ page }) => {
  await signInAsSuperAdmin(page);
  const name = `E2E Collection ${RUN}`;
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
  const first = (await list.getByRole('link').first().textContent())!.trim();
  await list.getByRole('button', { name: `Move ${first} down` }).click();
  await page.getByRole('button', { name: 'Save this order' }).click();
  await expect(toast(page, 'Order saved')).toBeVisible();
  await expectAccessible(page);

  const workbench = page.getByRole('complementary', { name: 'Collection workbench' });
  await workbench.getByRole('button', { name: /^Delete/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete collection' }).click();
  await expect(toast(page, 'Collection deleted')).toBeVisible();
});

test('media: upload, attach from the library, reorder, make primary, remove', async ({ page }) => {
  await signInAsSuperAdmin(page);
  // One file goes into the library first, to be attached from there.
  await page.goto('/media');
  await page.getByLabel('Upload files').setInputFiles({
    name: `e2e-${RUN}-library.png`,
    mimeType: 'image/png',
    buffer: uniquePng(),
  });
  await expect(
    page.getByRole('region', { name: 'Uploads' }).getByText('1 uploaded successfully'),
  ).toBeVisible();

  const id = await createDraft(page, `E2E Media ${RUN}`, `E2E-M-${RUN.toUpperCase()}`);
  await page.goto(`/catalog/products/edit?id=${id}&tab=media`);
  await page.getByLabel('Upload images').setInputFiles({
    name: `e2e-${RUN}.png`,
    mimeType: 'image/png',
    buffer: uniquePng(),
  });
  const uploads = page.getByRole('region', { name: 'Uploads' });
  await expect(uploads.getByText('1 uploaded successfully')).toBeVisible();
  await expect(uploads.getByText('Added to the gallery')).toBeVisible();

  // And the image that is already in the library.
  await page.getByRole('button', { name: 'Select from media library' }).click();
  const picker = page.getByRole('dialog', { name: /^Select images for E2E Media/ });
  await picker.getByRole('searchbox', { name: /Search images/ }).fill(`e2e-${RUN}-library`);
  const choices = picker.getByRole('list', { name: 'Images' }).getByRole('button');
  await expect(choices).toHaveCount(1);
  await choices.first().click();
  await expect(picker.getByText('1 selected')).toBeVisible();
  await picker.getByRole('button', { name: 'Use 1 image' }).click();
  await expect(toast(page, '1 image added')).toBeVisible();

  const gallery = page.getByRole('list', { name: 'Product images in display order' });
  const items = gallery.getByRole('listitem');
  await expect(items).toHaveCount(2);
  await expect(items.first().getByText('Primary', { exact: true })).toBeVisible();
  await expect(items.first()).toContainText(`e2e-${RUN}.png`);
  await gallery.getByRole('button', { name: 'Move image 2 earlier' }).click();
  await expect(items.nth(1)).toContainText(`e2e-${RUN}.png`);
  await gallery.getByRole('button', { name: 'Make primary (image 1)' }).click();
  await page.getByRole('button', { name: 'Save gallery' }).click();
  await expect(toast(page, 'Gallery saved')).toBeVisible();
  await expect(items.first().getByText('Primary', { exact: true })).toBeVisible();
  await expectAccessible(page);

  await gallery.getByRole('button', { name: 'More actions for image 2' }).click();
  await page.getByRole('menuitem', { name: 'Remove from this product…' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove from product' }).click();
  await expect(toast(page, 'Image removed from this product')).toBeVisible();
  await expect(gallery.getByRole('listitem')).toHaveCount(1);
  await trashProduct(page, id);

  // The uploaded file stays in the library until someone removes it.
  await page.goto(`/media?q=${encodeURIComponent(`e2e-${RUN}`)}`);
  const grid = page.getByRole('list', { name: 'Media' });
  await grid
    .getByRole('button', { name: new RegExp(`e2e-${RUN}`) })
    .first()
    .click();
  const drawer = page.getByRole('dialog', { name: new RegExp(`e2e-${RUN}`) });
  await drawer.getByRole('button', { name: 'Move to trash…' }).click();
  await page
    .getByRole('alertdialog', { name: 'Move this file to trash?' })
    .getByRole('button', { name: 'Move to trash' })
    .click();
  await expect(toast(page, 'Moved to trash')).toBeVisible();
});

test('inventory: low-stock list, adjust through the ledger, history', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await page.goto('/catalog/inventory');
  const lowStock = page.getByRole('table', { name: 'Low stock variants' });
  const row = lowStock.getByRole('row', { name: /Amber 2-Seater Fabric Sofa/ });
  await expect(row).toBeVisible();
  await expectAccessible(page);

  await row.getByRole('button', { name: /^Actions for / }).click();
  await page.getByRole('menuitem', { name: 'Stock history' }).click();
  await expect(page).toHaveURL(/variantId=/);
  await expect(page.getByRole('heading', { level: 1, name: /^Stock · / })).toBeVisible();

  for (const [mode, reason] of [
    ['Add', 'PURCHASE'],
    ['Remove', 'CORRECTION'],
  ] as const) {
    await page.getByRole('button', { name: 'Adjust stock…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Adjust stock' });
    await dialog.getByLabel(mode, { exact: true }).check();
    await dialog.getByLabel('Quantity').fill('1');
    const reasonSelect = dialog.getByLabel('Reason');
    if (await reasonSelect.locator(`option[value="${reason}"]`).count())
      await reasonSelect.selectOption(reason);
    await dialog.getByLabel('Note (optional)').fill(`e2e ${RUN}`);
    await dialog.getByRole('button', { name: 'Save stock change' }).click();
    await expect(toast(page, 'Stock updated')).toBeVisible();
    await expect(dialog).toBeHidden();
  }
  const history = page.getByRole('table', { name: 'Stock movements' });
  await expect(history.getByRole('row', { name: new RegExp(`e2e ${RUN}`) })).toHaveCount(2);
});

test('pricing: create a rule, refuse a bad value, switch it off, delete it', async ({ page }) => {
  await signInAsSuperAdmin(page);
  const id = await createDraft(page, `E2E Pricing ${RUN}`, `E2E-P-${RUN.toUpperCase()}`);
  const name = `E2E rule ${RUN}`;
  await page.goto(`/pricing/price-rules?productId=${id}`);
  await page.getByRole('button', { name: 'New price rule' }).click();
  const dialog = page.getByRole('dialog', { name: 'New price rule' });
  await dialog.getByLabel(/^Name/).fill(name);
  // Opened from the product's rules, it targets that product only.
  await expect(dialog.getByText('Product: The selected product')).toBeVisible();

  await dialog.getByLabel(/^Percent/).fill('abc');
  await dialog.getByRole('button', { name: 'Create rule' }).click();
  await expect(dialog.getByLabel(/^Percent/)).toHaveAttribute('aria-invalid', 'true');
  await dialog.getByLabel(/^Percent/).fill('10');
  await expect(dialog.getByRole('status').filter({ hasText: '10% off' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Create rule' }).click();
  await expect(toast(page, 'Price rule created')).toBeVisible();

  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row.getByText('Active', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: `Actions for ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog', { name: `Edit ${name}` });
  await edit.getByLabel('Active').uncheck();
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Price rule saved')).toBeVisible();
  await expect(row.getByText('Off', { exact: true })).toBeVisible();

  await row.getByRole('button', { name: `Actions for ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete rule' }).click();
  await expect(toast(page, 'Price rule deleted')).toBeVisible();
  await trashProduct(page, id);
});

test('import: check a file, show row errors, refuse a changed file, apply', async ({ page }) => {
  await signInAsSuperAdmin(page);
  const sku = `E2E-IMP-${RUN.toUpperCase()}`;
  const header =
    'sku,slug,name,productType,status,visibility,brandSlug,taxClassCode,basePriceRupees,compareAtPriceRupees,primaryCategorySlug,categorySlugs,shortDescription,description,warrantyMonths,weightGrams,lengthMm,widthMm,heightMm,seoTitle,seoDescription,searchKeywords';
  const row = (price: string, name = `E2E Import ${RUN}`) =>
    `${sku},e2e-imp-${RUN},${name},VARIABLE,DRAFT,PUBLIC,,,${price},,,,,,,,,,,,,`;
  const file = (name: string, body: string) => ({
    name,
    mimeType: 'text/csv',
    buffer: Buffer.from(`${header}\n${body}\n`),
  });

  await page.goto('/catalog/import-export');
  const panel = page.getByRole('region', { name: 'Import' });
  await panel.getByLabel('CSV file').setInputFiles(file('bad.csv', row('not-a-price')));
  await panel.getByRole('button', { name: 'Check file' }).click();
  const check = page.getByRole('region', { name: 'Import check' });
  await expect(check.getByRole('table', { name: 'Rows with errors' })).toBeVisible();
  await expect(check.getByText('Fix the file and check it again')).toBeVisible();
  await expect(check.getByRole('button', { name: /^Apply/ })).toHaveCount(0);

  await panel.getByLabel('CSV file').setInputFiles(file('good.csv', row('999.00')));
  await panel.getByRole('button', { name: 'Check file' }).click();
  await expect(check.getByText('Checked: ready to apply')).toBeVisible();
  await expectAccessible(page);

  // After a reload the file must be attached again, and it must be the same bytes.
  await page.reload();
  await expect(check.getByText('Checked: ready to apply')).toBeVisible();
  const attach = check.getByLabel('Attach the same file again to apply it');
  await attach.setInputFiles(file('good.csv', row('999.00', `E2E Changed ${RUN}`)));
  await check.getByRole('button', { name: 'Apply 1 row' }).click();
  await expect(check.getByRole('alert')).toContainText('This is not the file that was validated');
  await attach.setInputFiles(file('good.csv', row('999.00')));
  await check.getByRole('button', { name: 'Apply 1 row' }).click();
  await expect(toast(page, 'Import applied')).toBeVisible();
  await expect(check.getByRole('link', { name: 'See it in the audit log' })).toBeVisible();

  await page.goto(`/catalog/products?q=${sku}`);
  await page.getByRole('link', { name: `E2E Import ${RUN}` }).click();
  await expect(page).toHaveURL(/\/catalog\/products\/edit\?id=/);
  await trashProduct(page, new URL(page.url()).searchParams.get('id')!);
});

test('palette: catalogue shortcuts open the right screens', async ({ page }) => {
  await signInAsSuperAdmin(page);
  for (const [query, option, url] of [
    ['create a product', /Create a product/, /\/catalog\/products\/new$/],
    ['create a category', /Create a category/, /\/catalog\/categories\?new=1$/],
    ['without images', /Open products without images/, /hasMedia=false/],
  ] as const) {
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Search the admin' });
    await palette.getByRole('combobox').fill(query);
    await palette.getByRole('option', { name: option }).click();
    await expect(page).toHaveURL(url);
    if (query === 'create a category') {
      const create = page.getByRole('dialog', { name: 'New category' });
      await expect(create).toBeVisible();
      await create.getByRole('button', { name: 'Cancel' }).click();
      await expect(create).toBeHidden();
    }
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible();
});

test('bulk: move every leftover E2E draft to the trash in one action', async ({ page }) => {
  await signInAsSuperAdmin(page);
  const name = `E2E Bulk ${RUN}`;
  await createDraft(page, name, `E2E-B-${RUN.toUpperCase()}`);
  // Drafts only, named by these tests (a failed earlier run can leave some behind).
  await page.goto('/catalog/products?q=E2E&status=DRAFT');
  const table = page.getByRole('table', { name: 'Products' });
  await expect(table.getByRole('row', { name: new RegExp(name) })).toBeVisible();
  const rows = await table.getByRole('row').count();
  await table.getByLabel('Select all rows on this page').check();
  const bulk = page.getByRole('region', { name: 'Bulk actions' });
  await bulk
    .getByLabel('Action for the selected products')
    .selectOption({ label: 'Move to trash' });
  await bulk.getByRole('button', { name: `Apply to ${rows - 1}` }).click();
  const dialog = page.getByRole('dialog', { name: /^Move to trash: / });
  await expect(dialog.getByText(name)).toBeVisible();
  for (const product of await dialog.getByRole('listitem').allTextContents())
    expect(product).toMatch(/^E2E /);
  await dialog.getByRole('button', { name: `Move to trash ${rows - 1}` }).click();
  // The per-product summary stays until it is read; only then does the list refresh.
  const summary = page.getByRole('dialog', { name: 'Done' });
  await expect(summary.getByText(`Move to trash: ${rows - 1} succeeded, 0 failed.`)).toBeVisible();
  await summary.getByRole('button', { name: 'Close' }).first().click();
  await expect(page.getByText('No product matches these filters')).toBeVisible();
});
