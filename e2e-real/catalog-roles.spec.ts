import { expect, test, type Page } from '@playwright/test';

import { RUN, appears, expectAccessible, signIn, signInAsSuperAdmin } from './stack';

/**
 * The catalogue workbench and palette follow the signed-in admin's permissions, as the API grants
 * them: a Catalog Manager gets the actions, a Content Manager sees the same facts read-only.
 * Two temporary admins are created and removed; nothing in the catalogue is changed.
 */
test.describe.configure({ mode: 'serial' });

const CATALOG = { name: `E2E Catalog ${RUN}`, email: `${RUN}.catalog@clearwood.local` };
const CONTENT = { name: `E2E Content ${RUN}`, email: `${RUN}.content@clearwood.local` };
const OWN_PASSWORD = `Sheesham-Rosewood-${RUN}-7`;
const passwords: Record<string, string> = {};
const TRIKON = 'Trikon Nesting Tables';

async function addAdmin(page: Page, person: { name: string; email: string }, role: string) {
  await page.goto('/system/users');
  await page.getByRole('button', { name: /Add admin/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Add an admin' });
  await dialog.getByLabel(/Full name/).fill(person.name);
  await dialog.getByLabel(/^Email/).fill(person.email);
  await dialog.getByRole('button', { name: /Generate a strong/ }).click();
  await dialog.getByLabel(role, { exact: true }).check();
  await dialog.getByRole('button', { name: 'Add admin' }).click();
  await expect(page.getByRole('heading', { name: `${person.name} was added` })).toBeVisible();
  const password = (await page.locator('code').first().textContent())!.trim();
  await page.getByRole('button', { name: 'Done' }).click();
  return password;
}

async function signInFirstTime(page: Page, person: { email: string }) {
  await signIn(page, person.email, passwords[person.email]!);
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  await page.getByLabel(/Current \(temporary\) password/).fill(passwords[person.email]!);
  await page.getByLabel(/^New password/).fill(OWN_PASSWORD);
  await page.getByLabel(/Repeat new password/).fill(OWN_PASSWORD);
  await page.getByRole('button', { name: /Change password|Save/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /E2E/ })).toBeVisible();
}

async function openTrikon(page: Page) {
  await page.goto('/catalog/products?q=Trikon');
  await page.getByRole('link', { name: TRIKON }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: TRIKON })).toBeVisible();
  return page.getByRole('complementary', { name: 'Product workbench' });
}

test('a Super Admin adds a Catalog Manager and a Content Manager', async ({ page }) => {
  await signInAsSuperAdmin(page);
  passwords[CATALOG.email] = await addAdmin(page, CATALOG, 'Catalog Manager');
  passwords[CONTENT.email] = await addAdmin(page, CONTENT, 'Content Manager');
});

test('a Catalog Manager gets the workbench actions and catalogue shortcuts', async ({ page }) => {
  await signInFirstTime(page, CATALOG);
  const workbench = await openTrikon(page);
  await expect(workbench.getByRole('region', { name: 'Next actions' })).toBeVisible();
  await expect(
    workbench
      .getByRole('button', { name: /Unpublish|Publish now/ })
      .or(workbench.getByRole('link', { name: 'Review publishing checklist' })),
  ).toBeVisible();
  await expect(workbench.getByRole('link', { name: /Price rules/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'More product actions' })).toBeVisible();
  // No audit permission: no activity panel, and no request for it.
  await expect(workbench.getByRole('heading', { name: 'Recent activity' })).toHaveCount(0);

  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Search the admin' });
  await palette.getByRole('combobox').fill('create');
  await expect(palette.getByRole('option', { name: /Create a product/ })).toBeVisible();
  await palette.getByRole('combobox').fill('low-stock');
  await palette.getByRole('option', { name: /Open low-stock variants/ }).click();
  await expect(page).toHaveURL(/\/catalog\/inventory$/);
  await expect(page.getByRole('table', { name: 'Low stock variants' })).toBeVisible();
});

test('a Content Manager sees the same product read-only', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET' && request.url().includes('/admin/catalog/'))
      writes.push(`${request.method()} ${request.url()}`);
  });
  await signInFirstTime(page, CONTENT);
  const workbench = await openTrikon(page);
  await expect(workbench.getByRole('heading', { name: /Needs attention|Ready/ })).toBeVisible();
  await expect(workbench.getByRole('region', { name: 'Next actions' })).toHaveCount(0);
  await expect(workbench.getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'More product actions' })).toHaveCount(0);
  await expect(page.getByText('Your role can view this product but not change it.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  await expectAccessible(page);

  // Media & Gallery: view only, and the API itself refuses to change the gallery for this role.
  const productId = new URL(page.url()).searchParams.get('id')!;
  await page.goto(`/catalog/products/edit?id=${productId}&tab=media`);
  await expect(page.getByRole('heading', { name: 'Media & Gallery' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Product images' })).toBeVisible();
  await expect(page.getByLabel('Upload images')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Select from media library' })).toHaveCount(0);
  const csrf = (await page.context().cookies()).find((cookie) => cookie.name === 'cw_adm_csrf');
  const refused = await page.request.post(`/api/v1/admin/products/${productId}/media`, {
    headers: { 'x-csrf-token': decodeURIComponent(csrf!.value) },
    data: { items: [{ mediaId: 'cmediae2e0000000000000000' }] },
  });
  expect(refused.status()).toBe(403);

  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Search the admin' });
  await palette.getByRole('combobox').fill('create');
  await expect(palette.getByRole('option', { name: /Create a product/ })).toHaveCount(0);
  await palette.getByRole('combobox').fill('draft');
  await expect(palette.getByRole('option', { name: /Open draft products/ })).toBeVisible();
  expect(writes).toEqual([]);
});

// Runs even when a test above fails, so no temporary admin is left behind (from this run or an
// earlier one that stopped half-way: they all use run-labelled e2e addresses).
test.afterAll(async ({ browser }, testInfo) => {
  const context = await browser.newContext(testInfo.project.use);
  const page = await context.newPage();
  await signInAsSuperAdmin(page);
  await page.goto('/system/users?q=E2E');
  const users = page.getByRole('table', { name: 'Admin users' });
  const emails = (await appears(users))
    ? (await users.innerText())
        .split(/\s+/)
        .filter((word) => /^e2e[a-z0-9]+\.(catalog|content)@clearwood\.local$/.test(word))
    : [];
  for (const email of new Set(emails)) {
    await page.goto(`/system/users?q=${encodeURIComponent(email)}`);
    await users
      .getByRole('button', { name: /^Actions for / })
      .first()
      .click();
    await page.getByRole('menuitem', { name: 'Delete admin' }).click();
    const confirm = page.getByRole('alertdialog', { name: /Delete/ });
    await confirm.getByLabel(/Type/).fill(email);
    await confirm.getByRole('button', { name: 'Delete admin' }).click();
    await expect(page.getByText('No admin matches these filters')).toBeVisible();
  }
  await context.close();
});
