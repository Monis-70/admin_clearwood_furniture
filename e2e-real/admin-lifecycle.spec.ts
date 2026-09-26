import { expect, test, type Browser } from '@playwright/test';

import { RUN, SUPER_ADMIN, expectAccessible, signIn, signInAsSuperAdmin, trackApi } from './stack';

/**
 * One admin's whole life against the real local API: created, edited, given another role,
 * inspected, password reset, forced to change it, told when their access changes, signed out by a
 * reset, and deleted. Serial on purpose: each step builds on the last.
 */
test.describe.configure({ mode: 'serial' });

const NEW_ADMIN = {
  name: `E2E Test Admin ${RUN}`,
  email: `${RUN}@clearwood.local`,
};
let temporaryPassword = '';
let ownPassword = `Teak-Walnut-${RUN}-7`;

async function asNewAdmin(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  return { context, page };
}

test('sign in, see real work queues, sign out', async ({ page }) => {
  const calls = trackApi(page);
  await signInAsSuperAdmin(page);
  const enquiries = page
    .getByRole('region', { name: /New enquiries/ })
    .or(page.locator('section', { has: page.getByRole('heading', { name: 'New enquiries' }) }));
  await expect(enquiries.first().getByText(/DEV /).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Low stock' })).toBeVisible();
  await expectAccessible(page);
  expect(calls.filter((c) => c.status >= 400)).toEqual([]);
  const paths = calls.map((c) => `${c.method} ${c.path}`);
  expect(new Set(paths).size, `duplicate requests: ${paths.join(', ')}`).toBe(paths.length);

  await page.getByRole('button', { name: /Account menu/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText('You have signed out')).toBeVisible();
});

test('create an admin with a temporary password', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Admin users' })
    .click();
  await expect(page.getByRole('table', { name: 'Admin users' })).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('button', { name: /Add admin/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Add an admin' });
  await dialog.getByLabel(/Full name/).fill(NEW_ADMIN.name);
  await dialog.getByLabel(/^Email/).fill(NEW_ADMIN.email);
  await dialog.getByRole('button', { name: /Generate a strong/ }).click();
  await dialog.getByLabel('Catalog Manager').check();
  await expectAccessible(page);
  await dialog.getByRole('button', { name: 'Add admin' }).click();

  await expect(page.getByRole('heading', { name: `${NEW_ADMIN.name} was added` })).toBeVisible();
  temporaryPassword = (await page.locator('code').first().textContent())!.trim();
  expect(temporaryPassword.length).toBeGreaterThanOrEqual(10);
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('searchbox', { name: 'Search by name or email' }).fill(RUN);
  const row = page.getByRole('row', { name: new RegExp(NEW_ADMIN.name) });
  await expect(row).toBeVisible();
  await expect(row.getByText('Temporary password')).toBeVisible();
});

test('edit the admin, change their role and inspect their permissions', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await page.goto(`/system/users?q=${RUN}`);
  const actions = page.getByRole('button', { name: `Actions for ${NEW_ADMIN.name}` });

  await actions.click();
  await page.getByRole('menuitem', { name: 'Edit name or mobile' }).click();
  const edit = page.getByRole('dialog', { name: /Edit/ });
  await edit.getByLabel('Mobile number').fill('+91 98450 12345');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(edit).toBeHidden();

  await actions.click();
  await page.getByRole('menuitem', { name: 'Change roles' }).click();
  const roles = page.getByRole('dialog', { name: /Change roles/ });
  await roles.getByLabel('Catalog Manager').uncheck();
  await roles.getByLabel('Content Manager').check();
  await roles.getByRole('button', { name: 'Save roles' }).click();
  await expect(roles).toBeHidden();
  await expect(
    page.getByRole('row', { name: new RegExp(NEW_ADMIN.name) }).getByText('Content Manager'),
  ).toBeVisible();

  await page.getByRole('button', { name: NEW_ADMIN.name }).first().click();
  const sheet = page.getByRole('dialog', { name: new RegExp(NEW_ADMIN.name) });
  await expect(
    sheet.getByText('919845012345').or(sheet.getByText('+91 98450 12345')),
  ).toBeVisible();
  await sheet.getByRole('tab', { name: 'Permissions' }).click();
  await expect(sheet.getByText('Edit and publish pages and site content').first()).toBeVisible();
  await sheet.getByRole('tab', { name: 'History' }).click();
  await expect(sheet.getByText(/Role assigned|Updated|Created/).first()).toBeVisible();
  await expectAccessible(page);
});

test('forced password change on first sign-in, then the dashboard for that role only', async ({
  browser,
}) => {
  const { context, page } = await asNewAdmin(browser);
  await signIn(page, NEW_ADMIN.email, temporaryPassword);
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  await expectAccessible(page);
  await page.getByLabel(/Current \(temporary\) password/).fill(temporaryPassword);
  await page.getByLabel(/^New password/).fill(ownPassword);
  await page.getByLabel(/Repeat new password/).fill(ownPassword);
  await page.getByRole('button', { name: /Change password|Save/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /E2E/ })).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Pages' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Admin users' })).toHaveCount(0);
  await page.goto('/system/users');
  await expect(
    page.getByRole('heading', { name: "You don't have access to admin users" }),
  ).toBeVisible();
  await context.close();
});

test('an open session is told when a Super Admin changes its access', async ({ browser, page }) => {
  const other = await asNewAdmin(browser);
  await signIn(other.page, NEW_ADMIN.email, ownPassword);
  await expect(other.page.getByRole('heading', { level: 1, name: /E2E/ })).toBeVisible();

  await signInAsSuperAdmin(page);
  await page.goto(`/system/users?q=${RUN}`);
  await page.getByRole('button', { name: `Actions for ${NEW_ADMIN.name}` }).click();
  await page.getByRole('menuitem', { name: 'Change roles' }).click();
  const roles = page.getByRole('dialog', { name: /Change roles/ });
  await roles.getByLabel('Catalog Manager').check();
  await roles.getByRole('button', { name: 'Save roles' }).click();
  await expect(roles).toBeHidden();

  await other.page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Pages' })
    .click();
  await expect(other.page.getByText('Your access changed')).toBeVisible();
  await expect(
    other.page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Inventory' }),
  ).toBeVisible();
  await other.context.close();
});

test('resetting a password ends the other session and forces a new password', async ({
  browser,
  page,
}) => {
  const other = await asNewAdmin(browser);
  await signIn(other.page, NEW_ADMIN.email, ownPassword);
  await expect(other.page.getByRole('heading', { level: 1, name: /E2E/ })).toBeVisible();

  await signInAsSuperAdmin(page);
  await page.goto(`/system/users?q=${RUN}`);
  await page.getByRole('button', { name: `Actions for ${NEW_ADMIN.name}` }).click();
  await page.getByRole('menuitem', { name: 'Reset password' }).click();
  const dialog = page.getByRole('dialog', { name: /Reset password for/ });
  await expect(
    dialog.getByText(
      "Resetting this password will terminate the user's active sessions and require a password change at next sign-in.",
    ),
  ).toBeVisible();
  await dialog.getByRole('button', { name: /Generate a strong/ }).click();
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset password' }).click();
  await expect(page.getByRole('heading', { name: /Password reset for/ })).toBeVisible();
  temporaryPassword = (await page.locator('code').first().textContent())!.trim();
  await page.getByRole('button', { name: 'Done' }).click();

  // The other device finds out on its next click and lands on sign-in with an explanation.
  await other.page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Banners' })
    .click();
  await expect(other.page).toHaveURL(/\/login/);
  await expect(
    other.page.getByText(/Your session has ended|Signed out for your security/),
  ).toBeVisible();

  await signIn(other.page, NEW_ADMIN.email, temporaryPassword);
  await expect(other.page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  ownPassword = `Oak-Sheesham-${RUN}-9`;
  await other.page.getByLabel(/Current \(temporary\) password/).fill(temporaryPassword);
  await other.page.getByLabel(/^New password/).fill(ownPassword);
  await other.page.getByLabel(/Repeat new password/).fill(ownPassword);
  await other.page.getByRole('button', { name: /Change password|Save/ }).click();
  await expect(other.page.getByRole('heading', { level: 1, name: /E2E/ })).toBeVisible();
  await other.context.close();
});

test('delete the test admin with a typed confirmation', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await page.goto(`/system/users?q=${RUN}`);
  await page.getByRole('button', { name: `Actions for ${NEW_ADMIN.name}` }).click();
  await page.getByRole('menuitem', { name: 'Delete admin' }).click();
  const confirm = page.getByRole('alertdialog', { name: /Delete/ });
  await expect(confirm.getByRole('button', { name: 'Delete admin' })).toBeDisabled();
  await confirm.getByLabel(/Type/).fill(NEW_ADMIN.email);
  await confirm.getByRole('button', { name: 'Delete admin' }).click();
  await expect(page.getByText('No admin matches these filters')).toBeVisible();
});

test('the Super Admin cannot manage their own account from the list', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await page.goto(`/system/users?q=${encodeURIComponent(SUPER_ADMIN.email)}`);
  await page.getByRole('button', { name: 'Actions for DEV Super Admin' }).click();
  await expect(page.getByText('This is your own account. Use My account instead.')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Reset password' })).toHaveCount(0);
});
