import { expect, test, type Page } from '@playwright/test';

import { RUN, expectAccessible, signIn, signInAsSuperAdmin } from './stack';

/**
 * An ordinary Admin (every permission except managing roles, deleting admins and payment settings)
 * adds a colleague with a standard role, and sees that changing roles needs another permission.
 * Everything runs against the real local API; the records are removed at the end.
 */
test.describe.configure({ mode: 'serial' });

const ADMIN = { name: `E2E Ordinary Admin ${RUN}`, email: `${RUN}.admin@clearwood.local` };
const COLLEAGUE = { name: `E2E Colleague ${RUN}`, email: `${RUN}.colleague@clearwood.local` };
const OWN_PASSWORD = `Sheesham-Walnut-${RUN}-4`;
let temporaryPassword = '';

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

async function deleteAdmin(page: Page, person: { name: string; email: string }) {
  await page.goto(`/system/users?q=${encodeURIComponent(person.email)}`);
  await page.getByRole('button', { name: `Actions for ${person.name}` }).click();
  await page.getByRole('menuitem', { name: 'Delete admin' }).click();
  const confirm = page.getByRole('alertdialog', { name: /Delete/ });
  await confirm.getByLabel(/Type/).fill(person.email);
  await confirm.getByRole('button', { name: 'Delete admin' }).click();
  await expect(page.getByText('No admin matches these filters')).toBeVisible();
}

test('a Super Admin adds an ordinary Admin', async ({ page }) => {
  await signInAsSuperAdmin(page);
  temporaryPassword = await addAdmin(page, ADMIN, 'Admin');
});

test('the Admin adds a colleague with a standard role, without the role list', async ({ page }) => {
  const roleListCalls: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/v1/admin/roles')
      roleListCalls.push(request.url());
  });

  await signIn(page, ADMIN.email, temporaryPassword);
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  await page.getByLabel(/Current \(temporary\) password/).fill(temporaryPassword);
  await page.getByLabel(/^New password/).fill(OWN_PASSWORD);
  await page.getByLabel(/Repeat new password/).fill(OWN_PASSWORD);
  await page.getByRole('button', { name: /Change password|Save/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /E2E/ })).toBeVisible();

  await page.goto('/system/users');
  await page.getByRole('button', { name: /Add admin/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Add an admin' });
  await expect(dialog.getByText(/Showing the standard roles/)).toBeVisible();
  await expect(dialog.getByLabel('Super Admin')).toHaveCount(0);
  await expectAccessible(page);
  await page.keyboard.press('Escape');

  await addAdmin(page, COLLEAGUE, 'Catalog Manager');
  await page.goto(`/system/users?q=${encodeURIComponent(COLLEAGUE.email)}`);
  await expect(
    page.getByRole('row', { name: new RegExp(COLLEAGUE.name) }).getByText('Catalog Manager'),
  ).toBeVisible();

  await page.getByRole('button', { name: `Actions for ${COLLEAGUE.name}` }).click();
  const changeRoles = page.getByRole('menuitem', { name: /Change roles/ });
  await expect(changeRoles).toHaveAttribute('aria-disabled', 'true');
  await expect(changeRoles).toContainText('View roles and permissions');
  await expect(page.getByRole('menuitem', { name: 'Reset password' })).toBeEnabled();
  await page.keyboard.press('Escape');

  expect(roleListCalls, 'the Admin never asks for the role list').toEqual([]);
});

test('a Super Admin removes both test accounts', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await deleteAdmin(page, COLLEAGUE);
  await deleteAdmin(page, ADMIN);
});
