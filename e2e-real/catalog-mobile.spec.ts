import { expect, test, type Page } from '@playwright/test';

import { RUN, expectAccessible, signInAsSuperAdmin } from './stack';

/**
 * The catalogue on a phone (Pixel 7) against the real local API: lists as cards, the product
 * editor and its workbench, save and discard, the category tree, stock, the media picker and the
 * palette. One labelled draft is created and moved to the trash at the end.
 */
test.describe.configure({ mode: 'serial' });

const SOFAS = 'cmuhdg3og008dr9gkp8k4fm0y';
const TRIKON = 'Trikon Nesting Tables';
let draftId = '';
let trashed = false;

test.afterAll(async ({ browser }, testInfo) => {
  if (!draftId || trashed) return;
  const context = await browser.newContext(testInfo.project.use);
  const page = await context.newPage();
  await signInAsSuperAdmin(page);
  await page.goto(`/catalog/products/edit?id=${draftId}`);
  await page.getByRole('button', { name: 'More product actions' }).click();
  await page.getByRole('menuitem', { name: 'Move to trash…' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Move to trash' }).click();
  await expect(page).toHaveURL(/\/catalog\/products$/);
  await context.close();
});

const toast = (page: Page, text: string) =>
  page.locator('[data-sonner-toast]').filter({ hasText: text }).first();

async function expectNoSideScroll(page: Page) {
  // clientWidth, not innerWidth: a phone zooms out to fit overflowing content, and innerWidth
  // then grows with it, so the overflow would cancel itself out.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test('product cards, details and the workbench @mobile', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await page.goto('/catalog/products?q=Trikon');
  const cards = page.getByRole('list', { name: 'Products' });
  await cards.getByRole('link', { name: TRIKON }).click();
  await expect(page.getByRole('heading', { level: 1, name: TRIKON })).toBeVisible();
  const workbench = page.getByRole('complementary', { name: 'Product workbench' });
  await expect(workbench.getByRole('heading', { name: /Needs attention|Ready/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Product sections' })).toBeVisible();
  await expectAccessible(page);
  await expectNoSideScroll(page);
});

test('create a draft, discard and save basic fields @mobile', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await page.goto('/catalog/products/new');
  await page.getByLabel(/^Product name/).fill(`E2E Mobile ${RUN}`);
  await page.getByLabel(/^SKU/).fill(`E2E-MOB-${RUN.toUpperCase()}`);
  await page.getByLabel(/^Base price/).fill('18999');
  await page.getByLabel('Primary category').selectOption(SOFAS);
  await expectNoSideScroll(page);
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(page).toHaveURL(/\/catalog\/products\/edit\?id=/);
  draftId = new URL(page.url()).searchParams.get('id')!;

  const subtitle = page.getByLabel('Subtitle');
  const basics = page.locator('form', { has: subtitle });
  await subtitle.fill('Not kept');
  await expect(basics.getByText('Unsaved changes')).toBeVisible();
  await basics.getByRole('button', { name: 'Discard' }).click();
  await expect(subtitle).toHaveValue('');

  await subtitle.fill('Kept on a phone');
  await basics.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Product details saved')).toBeVisible();
  await expect(basics.getByText('All changes saved')).toBeVisible();
  await expectAccessible(page);
  await expectNoSideScroll(page);
});

test('the media picker opens and fits the screen @mobile', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await page.goto(`/catalog/products/edit?id=${draftId}&tab=media`);
  await page.getByRole('button', { name: 'Select from media library' }).click();
  const picker = page.getByRole('dialog', { name: /^Select images for E2E Mobile/ });
  await expect(picker.getByRole('list', { name: 'Images' })).toBeVisible();
  const box = await picker.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await expectAccessible(page);
  await picker.getByRole('button', { name: 'Cancel' }).click();
  await expect(picker).toBeHidden();
});

test('category tree and editor sheet @mobile', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await page.goto('/catalog/categories');
  const tree = page.getByRole('region', { name: 'Category tree' });
  await page.getByLabel('Find a category').fill('Sofas');
  await tree.getByRole('button', { name: 'Sofas', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Sofas' });
  await expect(sheet.getByRole('complementary', { name: 'Category workbench' })).toBeVisible();
  await expectAccessible(page);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expectNoSideScroll(page);
});

test('low stock and the adjust dialog @mobile', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await page.goto('/catalog/inventory');
  const cards = page.getByRole('list', { name: 'Low stock variants' });
  await expect(cards.getByText('Amber 2-Seater Fabric Sofa').first()).toBeVisible();
  await expectAccessible(page);
  await cards
    .getByRole('button', { name: /^Actions for / })
    .first()
    .click();
  await page.getByRole('menuitem', { name: 'Adjust stock…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Adjust stock' });
  await dialog.getByLabel('Quantity').fill('2');
  await expect(dialog.getByText(/Stock goes from \d+ to \d+/)).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expectNoSideScroll(page);
});

test('palette catalogue shortcut, then the draft goes to the trash @mobile', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await page.getByRole('button', { name: /Search the admin/ }).click();
  const palette = page.getByRole('dialog', { name: 'Search the admin' });
  await palette.getByRole('combobox').fill('draft');
  await palette.getByRole('option', { name: /Open draft products/ }).click();
  await expect(page).toHaveURL(/status=DRAFT/);
  await expect(
    page.getByRole('list', { name: 'Products' }).getByRole('link', { name: `E2E Mobile ${RUN}` }),
  ).toBeVisible();

  await page.goto(`/catalog/products/edit?id=${draftId}`);
  await page.getByRole('button', { name: 'More product actions' }).click();
  await page.getByRole('menuitem', { name: 'Move to trash…' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Move to trash' }).click();
  await expect(toast(page, 'Product moved to trash')).toBeVisible();
  trashed = true;
});
