import { makeAccount, signIn, test, expect } from './fake-api';

test.describe('sign-in and session', () => {
  test('a signed-out visitor is sent to sign in and returned to the page they asked for', async ({
    page,
    api,
  }) => {
    await page.goto('/system/status');
    await expect(page).toHaveURL(/\/login\?next=%2Fsystem%2Fstatus/);
    expect(api.count('/api/v1/admin/auth/me')).toBe(0);

    await signIn(page);
    await expect(page).toHaveURL(/\/system\/status$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Status & integrations' }),
    ).toBeVisible();
  });

  test('wrong credentials keep the admin on the form with a clear message', async ({ page }) => {
    await page.goto('/login');
    await signIn(page, 'priya@clearwood.test', 'nope-nope-nope');
    await expect(page.getByText('Email or password is incorrect')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('tokens never reach script-readable storage', async ({ page }) => {
    await page.goto('/login');
    await signIn(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const storage = await page.evaluate(() => ({
      local: JSON.stringify(Object.entries(localStorage)),
      session: JSON.stringify(Object.entries(sessionStorage)),
      cookie: document.cookie,
    }));
    expect(storage.local).not.toContain('never-stored');
    expect(storage.session).toBe('[]');
    expect(storage.cookie).toBe('cw_adm_csrf=csrf-e2e-token');
  });

  test('a temporary password must be replaced before anything else', async ({ page, api }) => {
    api.accounts = [makeAccount({ mustChangePassword: true })];
    await page.goto('/login');
    await signIn(page);
    await expect(page).toHaveURL(/\/change-password/);
    await page.getByLabel(/current \(temporary\) password/i).fill('Sheesham-Teak-2026');
    await page.getByLabel(/^New password/).fill('Walnut-Oak-Rosewood-9');
    await page.getByLabel(/Repeat new password/).fill('Walnut-Oak-Rosewood-9');
    await page.getByRole('button', { name: 'Save new password' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: /Priya/ })).toBeVisible();
  });

  test('an expired access token is renewed silently, once', async ({ page, api }) => {
    await page.goto('/login');
    await signIn(page);
    await expect(page.getByRole('heading', { level: 1, name: /Priya/ })).toBeVisible();
    api.expireAccess();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: /Priya/ })).toBeVisible();
    expect(api.count('/api/v1/admin/auth/refresh')).toBe(1);
  });

  test('a session that can no longer be renewed sends the admin to sign in', async ({
    page,
    api,
  }) => {
    await page.goto('/login');
    await signIn(page);
    await expect(page.getByRole('heading', { level: 1, name: /Priya/ })).toBeVisible();
    api.expireAccess();
    api.refreshFails = true;
    await page.reload();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    expect(api.count('/api/v1/admin/auth/refresh')).toBe(1);
  });

  test('signing out clears the session and returns to sign in', async ({ page, api }) => {
    await page.goto('/login');
    await signIn(page);
    await page.getByRole('button', { name: /Account menu/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login\?reason=signed-out/);
    await expect(page.getByText('You have signed out')).toBeVisible();
    expect(await page.evaluate(() => document.cookie)).toBe('');
    expect(api.calls.find((c) => c.path === '/api/v1/admin/auth/logout')?.csrf).toBe(
      'csrf-e2e-token',
    );
  });

  test('signing out in one tab signs out the other tabs', async ({ page, context }) => {
    await page.goto('/login');
    await signIn(page);
    await expect(page.getByRole('heading', { level: 1, name: /Priya/ })).toBeVisible();
    const second = await context.newPage();
    await second.goto('/system/status');
    await expect(
      second.getByRole('heading', { level: 1, name: 'Status & integrations' }),
    ).toBeVisible();
    await page.getByRole('button', { name: /Account menu/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(second).toHaveURL(/\/login/);
  });
});
