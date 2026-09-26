import { expect, test } from '@playwright/test';

import { RUN, expectAccessible, signInAsSuperAdmin, trackApi } from './stack';

test.describe.configure({ mode: 'serial' });

test('roles: details in plain language, create and delete a custom role', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await page.goto('/system/roles');
  await page.getByRole('link', { name: /Catalog Manager/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Catalog Manager' })).toBeVisible();
  await expect(page.getByText('Edit products').first()).toBeVisible();
  await expect(page.getByText(/Downloads data in bulk/).first()).toBeVisible();
  await expectAccessible(page);

  const code = `E2E_${RUN.toUpperCase()}`;
  await page.goto('/system/roles?new=1');
  const dialog = page.getByRole('dialog', { name: 'New role' });
  await dialog.getByLabel(/^Name/).fill(`E2E Role ${RUN}`);
  await dialog.getByLabel(/^Code/).fill(code);
  await dialog.getByLabel('View products').check();
  await dialog.getByLabel('View enquiries').check();
  await dialog.getByRole('button', { name: 'Create role' }).click();
  await expect(page.getByRole('heading', { level: 1, name: `E2E Role ${RUN}` })).toBeVisible();
  // Exact: the sidebar now also lists "Customers" and "Customer groups".
  await expect(page.getByText('Custom', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Delete' }).click();
  const confirm = page.getByRole('alertdialog');
  await confirm.getByLabel(/Type/).fill(code);
  await confirm.getByRole('button', { name: 'Delete role' }).click();
  await expect(page).toHaveURL(/\/system\/roles$/);
  await expect(page.getByText(`E2E Role ${RUN}`)).toHaveCount(0);
});

test('real data: categories, products, collections, content, enquiries and audit', async ({
  page,
}) => {
  const calls = trackApi(page);
  await signInAsSuperAdmin(page);

  await page.goto('/catalog/categories');
  await expect(page.getByText('Sofas').first()).toBeVisible();
  await page.getByLabel('Find a category').fill('recliner');
  await expect(page.getByText(/Recliner/).first()).toBeVisible();
  await expectAccessible(page);

  await page.goto('/catalog/products');
  await page.getByRole('searchbox', { name: 'Search name or SKU' }).fill('Trikon');
  await expect(page.getByRole('row', { name: /Trikon Nesting Tables/ })).toBeVisible();
  await expect(page.getByText('Showing 1–1 of 1')).toBeVisible();
  await expectAccessible(page);

  await page.goto('/catalog/collections');
  await expect(page.getByRole('row', { name: /New Arrivals/ })).toBeVisible();

  await page.goto('/catalog/inventory');
  const lowStock = page.getByRole('table', { name: 'Low stock variants' });
  await expect(lowStock).toBeVisible();
  // Rows name their product; made-to-order products are never a stock risk.
  await expect(lowStock.getByRole('link', { name: 'Amber 2-Seater Fabric Sofa' })).toBeVisible();
  await expect(lowStock.getByText('Made to order')).toHaveCount(0);
  await expect(page.getByText(/of 42$/)).toBeVisible();

  await page.goto('/');
  const queue = page.locator('section', { has: page.getByRole('heading', { name: 'Low stock' }) });
  await expect(queue.getByRole('link', { name: /Amber 2-Seater Fabric Sofa/ })).toBeVisible();

  await page.goto('/content/pages');
  await expect(page.getByRole('row', { name: /ClearWood Furnitures/ })).toBeVisible();
  await page.goto('/content/banners');
  await expect(page.getByRole('table', { name: 'Banners' })).toBeVisible();

  await page.goto('/enquiries');
  await page.getByRole('button', { name: /DEV Meera Iyer/ }).click();
  const sheet = page.getByRole('dialog', { name: /DEV Meera Iyer/ });
  await expect(sheet.getByText(/teak veneer/)).toBeVisible();
  await expectAccessible(page);
  await page.keyboard.press('Escape');

  await page.goto('/enquiries/contract-work');
  await expect(page.getByRole('heading', { level: 1, name: 'Contract work' })).toBeVisible();
  await expect(page.getByRole('button', { name: /DEV Hotel Sagar/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /DEV Kavya Nair/ })).toHaveCount(0);

  await page.goto('/system/audit-log');
  const audit = page.getByRole('table', { name: 'Audit log' });
  await expect(audit).toBeVisible();
  await audit
    .getByRole('button', { name: /Signed in/ })
    .first()
    .click();
  const entry = page.getByRole('dialog', { name: /Signed in/ });
  await expect(entry.getByText('dev.superadmin@clearwood.local').first()).toBeVisible();
  await expectAccessible(page);
  await page.keyboard.press('Escape');

  expect(calls.filter((c) => c.status >= 400)).toEqual([]);
});

test('command palette: backend search, keyboard, recently viewed', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await page.goto('/enquiries');
  await page.getByRole('button', { name: /DEV Farah Khan/ }).click();
  await expect(page.getByRole('dialog', { name: /DEV Farah Khan/ })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Search the admin' });
  await expect(palette.getByRole('option', { name: /enquiry, / }).first()).toBeVisible();
  // eslint-disable-next-line no-restricted-properties -- the test inspects what the app stored
  const stored = await page.evaluate(() => JSON.stringify({ ...window.localStorage }));
  expect(stored, 'recently viewed must not keep customer names').not.toContain('Farah');
  await expectAccessible(page);

  await palette.getByRole('combobox').fill('trikon');
  await expect(palette.getByRole('option', { name: /Trikon Nesting Tables/ })).toBeVisible();
  const options = palette.getByRole('option');
  const labels = await options.allTextContents();
  const target = labels.findIndex((label) => label.includes('Trikon Nesting Tables'));
  for (let i = 0; i < target; i += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/catalog\/products\?q=CW-TAB-NEST-TRIKON/);
  await expect(page.getByRole('row', { name: /Trikon Nesting Tables/ })).toBeVisible();
});

test('saved filters come back in one click', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await page.goto('/enquiries?status=NEW');
  await page.getByRole('button', { name: 'Saved filters' }).click();
  await page.getByRole('menuitem', { name: 'Save current filters…' }).click();
  const naming = page.getByRole('dialog', { name: 'Save these filters' });
  await naming.getByLabel('Name').fill(`New only ${RUN}`);
  await naming.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Filters saved')).toBeVisible();
  await expect(page.getByRole('button', { name: `Saved filter: New only ${RUN}` })).toBeVisible();

  await page.goto('/enquiries');
  await page.getByRole('button', { name: 'Saved filters' }).click();
  await page.getByRole('menuitem', { name: `New only ${RUN}` }).click();
  await expect(page).toHaveURL(/status=NEW/);
  await page.getByRole('button', { name: `Saved filter: New only ${RUN}` }).click();
  await page.getByRole('button', { name: `Delete saved filter New only ${RUN}` }).click();
  await expect(page.getByRole('menuitem', { name: `New only ${RUN}` })).toHaveCount(0);
});

test('a recently viewed admin opens again from the palette', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await page.goto('/system/users');
  await page
    .getByRole('table', { name: 'Admin users' })
    .getByRole('button', { name: /^DEV Content Manager/ })
    .click();
  await expect(page.getByRole('dialog', { name: /DEV Content Manager/ })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto('/catalog/products');
  await expect(page.getByRole('table', { name: 'Products' })).toBeVisible();
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Search the admin' });
  await expect(palette).toBeVisible();
  await palette.getByRole('option', { name: /DEV Content Manager/ }).click();
  await expect(page).toHaveURL(/\/system\/users\?id=.+&q=DEV/);
  await expect(page.getByRole('dialog', { name: /DEV Content Manager/ })).toBeVisible();
});

test('the session-expiry warning appears before the session ends and renews it', async ({
  page,
}) => {
  // Only the browser clock moves; every request still goes to the real API with real cookies.
  await page.clock.install();
  await signInAsSuperAdmin(page);
  const sessions = page.waitForResponse((r) => r.url().endsWith('/api/v1/admin/auth/sessions'));
  await page.clock.fastForward('00:25');
  expect((await sessions).status()).toBe(200);
  const notice = page.getByRole('status').filter({ hasText: 'Your session ends at' });
  await expect(notice).toHaveCount(0);

  // Four minutes before the seven-day session would end, the notice re-checks and warns.
  await page.clock.fastForward((7 * 24 * 60 - 4) * 60_000);
  await expect(notice).toBeVisible();
  await expectAccessible(page);

  const refresh = page.waitForResponse((r) => r.url().endsWith('/api/v1/admin/auth/refresh'));
  await notice.getByRole('button', { name: 'Stay signed in' }).click();
  expect((await refresh).status()).toBe(200);
  await expect(notice).toHaveCount(0);
});
