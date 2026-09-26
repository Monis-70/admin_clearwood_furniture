import { expect, test } from '@playwright/test';

import { expectAccessible, signInAsSuperAdmin } from './stack';

/**
 * The important workflows on a phone (Pixel 7) against the real local API: the drawer, dashboard
 * queues, card lists with their detail sheets, the account page and the command palette.
 * Desktop specs cover the full flows; these check that each one is usable at this size.
 */
test.describe.configure({ mode: 'serial' });

test('drawer navigation and the dashboard @mobile', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await expect(page.getByRole('heading', { name: 'New enquiries' })).toBeVisible();
  await expect(
    page
      .locator('section', { has: page.getByRole('heading', { name: 'Low stock' }) })
      .getByRole('link')
      .first(),
  ).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('button', { name: 'Open navigation' }).click();
  const drawer = page.getByRole('dialog', { name: 'Navigation' });
  await expect(drawer.getByRole('link', { name: 'Audit log' })).toBeVisible();
  await drawer.getByRole('link', { name: 'Products' }).click();
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/\/catalog\/products$/);
  await expect(page.getByRole('list', { name: 'Products' })).toBeVisible();
  await expectAccessible(page);
});

test('admin users as cards, with the details sheet @mobile', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await page.goto('/system/users');
  const cards = page.getByRole('list', { name: 'Admin users' });
  await expect(cards.getByText('DEV Super Admin')).toBeVisible();
  await cards.getByRole('button', { name: /^DEV Catalog Manager/ }).click();
  const sheet = page.getByRole('dialog', { name: /DEV Catalog Manager/ });
  await sheet.getByRole('tab', { name: 'Permissions' }).click();
  await expect(sheet.getByText('Edit products').first()).toBeVisible();
  await expectAccessible(page);
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toBeHidden();
});

test('enquiries list and detail @mobile', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await page.goto('/enquiries');
  const cards = page.getByRole('list', { name: 'Enquiries' });
  await cards.getByRole('button', { name: /DEV Meera Iyer/ }).click();
  const sheet = page.getByRole('dialog', { name: /DEV Meera Iyer/ });
  await expect(sheet.getByText(/teak veneer/)).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await expectAccessible(page);
});

test('account sessions and the command palette @mobile', async ({ page }) => {
  await signInAsSuperAdmin(page);
  await page.goto('/account');
  await expect(page.getByText('This device')).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign out everywhere/ })).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('button', { name: /Search the admin/ }).click();
  const palette = page.getByRole('dialog', { name: 'Search the admin' });
  await palette.getByRole('combobox').fill('trikon');
  await palette.getByRole('option', { name: /Trikon Nesting Tables/ }).click();
  await expect(page).toHaveURL(/\/catalog\/products\?q=/);
  await expect(
    page.getByRole('list', { name: 'Products' }).getByText('Trikon Nesting Tables'),
  ).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

/**
 * A phone must never scroll sideways: browsers zoom the whole page out to fit, which shrinks every
 * touch target. One nowrap row inside a grid track that may size to min-content is enough to cause
 * it, so this sweeps the busiest screen of each area with real data.
 */
test('no screen scrolls sideways on a phone @mobile', async ({ page }) => {
  await signInAsSuperAdmin(page);
  const routes = [
    '/',
    '/catalog/products',
    '/catalog/inventory',
    '/catalog/categories',
    '/media',
    '/orders',
    '/orders/shipments',
    '/enquiries',
    '/content/pages',
    '/pricing/price-rules',
    '/system/users',
    '/system/audit-log',
  ];
  const wide: string[] = [];
  for (const route of routes) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    // Queues and images below the fold load when scrolled into view, and their rows are what can
    // widen a track: measure with the whole page rendered, not just the first screenful.
    await page.mouse.wheel(0, 20_000);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 0) wide.push(`${route}: +${overflow}px`);
  }
  expect(wide, wide.join('\n')).toEqual([]);
});
