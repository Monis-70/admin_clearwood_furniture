import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { signIn, test, expect } from './fake-api';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function audit(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return result.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
  );
}

test.describe('accessibility (axe, real layout including colour contrast)', () => {
  test('sign-in page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(await audit(page)).toEqual([]);
  });

  test('dashboard and status pages', async ({ page }) => {
    await page.goto('/login');
    await signIn(page);
    await expect(page.getByRole('heading', { level: 1, name: /Priya/ })).toBeVisible();
    expect(await audit(page)).toEqual([]);

    await page.goto('/system/status');
    await expect(page.getByText('Ready')).toBeVisible();
    expect(await audit(page)).toEqual([]);
  });

  test('keyboard: skip link reaches the main content', async ({ page }) => {
    await page.goto('/login');
    await signIn(page);
    await expect(page.getByRole('heading', { level: 1, name: /Priya/ })).toBeVisible();
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });
});

test.describe('static export', () => {
  test('unknown addresses show the not-found page', async ({ page }) => {
    const response = await page.goto('/catalog/does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });

  test('query parameters do not break page resolution', async ({ page }) => {
    await page.goto('/login?next=%2Fsystem%2Fstatus%3Ftab%3Dx&reason=expired');
    await expect(page.getByText('Your session has ended')).toBeVisible();
  });
});

test.describe('responsive @mobile', () => {
  test('navigation becomes a drawer and pages do not overflow', async ({ page }) => {
    await page.goto('/login');
    await signIn(page);
    await expect(page.getByRole('heading', { level: 1, name: /Priya/ })).toBeVisible();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    const drawer = page.getByRole('dialog', { name: 'Navigation' });
    await drawer.getByRole('link', { name: 'Status & integrations' }).click();
    await expect(page).toHaveURL(/\/system\/status$/);
    await expect(drawer).toBeHidden();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
