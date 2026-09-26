import { expect, test, type Page } from '@playwright/test';

import { apiData, csrfHeader, toast } from './catalog-helpers';
import { RUN, expectAccessible, signInAsSuperAdmin } from './stack';

/**
 * Attributes, brands and tax classes against the real local API: create, a refusal the form
 * catches, a refusal only the API can make, edit, persistence, delete. Every record carries the
 * run label and whatever is left is removed through the API in afterAll.
 */
test.describe.configure({ mode: 'serial' });

const CODE = `E2E_${RUN.toUpperCase()}`;
const ATTRIBUTE = `E2E Attribute ${RUN}`;
const BRAND = `E2E Brand ${RUN}`;
const TAX = `E2E GST ${RUN}`;

interface Named {
  id: string;
  name: string;
  code?: string;
  version?: number;
}

async function leftovers(page: Page, path: string) {
  const rows = await apiData<Named[]>(page, path);
  return rows.filter((row) => row.name.includes(RUN) || row.code === CODE);
}

test.afterAll(async ({ browser }, testInfo) => {
  const context = await browser.newContext(testInfo.project.use);
  const page = await context.newPage();
  await signInAsSuperAdmin(page);
  const headers = await csrfHeader(page);
  const q = encodeURIComponent(RUN);
  for (const row of await leftovers(page, `/admin/catalog/attributes?q=${q}&limit=100`)) {
    await page.request.delete(`/api/v1/admin/catalog/attributes/${row.id}`, { headers });
  }
  for (const row of await leftovers(page, `/admin/catalog/brands?q=${q}&limit=100`)) {
    await page.request.delete(`/api/v1/admin/catalog/brands/${row.id}`, { headers });
  }
  for (const row of await leftovers(page, '/admin/catalog/tax-classes?limit=100')) {
    await page.request.delete(`/api/v1/admin/catalog/tax-classes/${row.id}`, { headers });
  }
  await context.close();
});

test('attributes: create, add and remove a value, change behaviour, delete', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await page.goto('/catalog/attributes');
  await expect(page.getByRole('heading', { level: 1, name: 'Attributes' })).toBeVisible();
  await page.getByRole('button', { name: 'New attribute' }).click();
  const sheet = page.getByRole('dialog', { name: 'New attribute' });
  await sheet.getByLabel(/^Name/).fill(ATTRIBUTE);
  await sheet.getByLabel(/^Code/).fill('e2e lower case');
  await sheet.getByRole('button', { name: 'Create attribute' }).click();
  await expect(sheet.getByText('Use UPPER_SNAKE_CASE, e.g. SEAT_MATERIAL')).toBeVisible();
  await sheet.getByLabel(/^Code/).fill(CODE);
  await sheet.getByRole('button', { name: 'Create attribute' }).click();
  await expect(toast(page, 'Attribute created')).toBeVisible();

  const editor = page.getByRole('dialog', { name: ATTRIBUTE });
  await expect(editor).toBeVisible();
  const id = new URL(page.url()).searchParams.get('id')!;
  await editor.getByLabel('New value').fill('Solid oak');
  await expect(editor.locator('#value-code')).toHaveValue('SOLID_OAK');
  await editor.getByRole('button', { name: 'Add value' }).click();
  await expect(toast(page, 'Solid oak added')).toBeVisible();
  await expect(editor.getByText('Solid oak', { exact: true })).toBeVisible();

  await editor.getByLabel('Storefront filter').uncheck();
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Attribute saved')).toBeVisible();
  const saved = await apiData<{
    code: string;
    isFilterable: boolean;
    values: { code: string; label: string }[];
  }>(page, `/admin/catalog/attributes/${id}`);
  expect(saved).toMatchObject({ code: CODE, isFilterable: false });
  expect(saved.values.map((v) => [v.code, v.label])).toEqual([['SOLID_OAK', 'Solid oak']]);

  await page.reload();
  await expect(editor.getByLabel('Storefront filter')).not.toBeChecked();
  await expectAccessible(page);
  await editor.getByRole('button', { name: 'Delete Solid oak' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete value' }).click();
  await expect(toast(page, 'Value deleted')).toBeVisible();
  await expect(editor.getByText('No values yet')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();

  await page.getByLabel('Search attributes').fill(RUN);
  const row = page.getByRole('row', { name: new RegExp(ATTRIBUTE) });
  await row.getByRole('button', { name: `Actions for ${ATTRIBUTE}` }).click();
  await page.getByRole('menuitem', { name: 'Delete…' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete attribute' }).click();
  await expect(toast(page, 'Attribute deleted')).toBeVisible();
  await expect(row).toHaveCount(0);
});

test('brands: create with a derived slug, a stale edit is refused, deactivate, delete', async ({
  page,
}) => {
  await signInAsSuperAdmin(page);
  await page.goto('/catalog/brands');
  await page.getByRole('button', { name: 'New brand' }).click();
  const dialog = page.getByRole('dialog', { name: 'New brand' });
  await dialog.getByLabel(/^Name/).fill(BRAND);
  await dialog.getByLabel('URL slug').fill('Not A Slug');
  await dialog.getByRole('button', { name: 'Create brand' }).click();
  await expect(dialog.getByText('Use lowercase words joined by dashes')).toBeVisible();
  await dialog.getByLabel('URL slug').fill('');
  await dialog.getByRole('button', { name: 'Create brand' }).click();
  await expect(toast(page, 'Brand created')).toBeVisible();

  await page.getByLabel('Search brands').fill(RUN);
  const row = page.getByRole('row', { name: new RegExp(BRAND) });
  await expect(row.getByText(`e2e-brand-${RUN}`)).toBeVisible();

  // Someone else saved first: the version this admin loaded is stale.
  const [created] = await leftovers(page, `/admin/catalog/brands?q=${RUN}&limit=100`);
  const headers = await csrfHeader(page);
  const stale = await page.request.patch(`/api/v1/admin/catalog/brands/${created!.id}`, {
    headers,
    data: { description: 'Changed elsewhere', version: created!.version },
  });
  expect(stale.status()).toBe(200);
  const refused = await page.request.patch(`/api/v1/admin/catalog/brands/${created!.id}`, {
    headers,
    data: { description: 'Lost update', version: created!.version },
  });
  expect(refused.status()).toBe(409);

  await page.reload();
  await page.getByLabel('Search brands').fill(RUN);
  await row.getByRole('button', { name: `Actions for ${BRAND}` }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog', { name: `Edit ${BRAND}` });
  await expect(edit.getByLabel('Description')).toHaveValue('Changed elsewhere');
  await edit.getByLabel('Active').uncheck();
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Brand saved')).toBeVisible();
  await expect(row.getByText('Inactive')).toBeVisible();

  await row.getByRole('button', { name: `Actions for ${BRAND}` }).click();
  await page.getByRole('menuitem', { name: 'Delete…' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete brand' }).click();
  await expect(toast(page, 'Brand deleted')).toBeVisible();
  await expect(row).toHaveCount(0);
});

test('tax: create a class, a duplicate code is refused, change the rate, delete', async ({
  page,
}) => {
  await signInAsSuperAdmin(page);
  await page.goto('/pricing/tax');
  await expect(page.getByRole('heading', { level: 1, name: 'Tax & GST' })).toBeVisible();
  const create = async (name: string) => {
    await page.getByRole('button', { name: 'New tax class' }).click();
    const dialog = page.getByRole('dialog', { name: 'New tax class' });
    await dialog.getByLabel(/^Name/).fill(name);
    await dialog.getByLabel(/^Code/).fill(CODE);
    await dialog.getByLabel(/^GST rate/).fill('7.5');
    await dialog.getByRole('button', { name: 'Create tax class' }).click();
    return dialog;
  };
  await create(TAX);
  await expect(toast(page, 'Tax class created')).toBeVisible();
  const row = page.getByRole('row', { name: new RegExp(TAX) });
  await expect(row.getByText('7.5%')).toBeVisible();

  const again = await create(`${TAX} again`);
  await expect(again.getByText('That tax class code is already in use')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(again).toBeHidden();

  await row.getByRole('button', { name: `Actions for ${TAX}` }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog', { name: `Edit ${TAX}` });
  await edit.getByLabel(/^GST rate/).fill('5');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Tax class saved')).toBeVisible();
  await expect(row.getByText('5%', { exact: true })).toBeVisible();
  const [saved] = (await leftovers(page, '/admin/catalog/tax-classes?limit=100')) as (Named & {
    rateBp: number;
    isDefault: boolean;
  })[];
  expect(saved).toMatchObject({ code: CODE, rateBp: 500, isDefault: false });

  await row.getByRole('button', { name: `Actions for ${TAX}` }).click();
  await page.getByRole('menuitem', { name: 'Delete…' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete tax class' }).click();
  await expect(toast(page, 'Tax class deleted')).toBeVisible();
  await expect(row).toHaveCount(0);
});
