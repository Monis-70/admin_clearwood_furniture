import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SECRETS = path.resolve(process.cwd(), 'local-stack', 'secrets.env');

function readSecrets(): Record<string, string> {
  if (!existsSync(SECRETS)) {
    throw new Error(
      'local-stack/secrets.env is missing: run local-stack/stack.ps1 init, up, migrate, seed, provision.',
    );
  }
  return Object.fromEntries(
    readFileSync(SECRETS, 'utf8')
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  );
}

const secrets = readSecrets();

export const SUPER_ADMIN = {
  email: 'dev.superadmin@clearwood.local',
  password: secrets.ADMIN_SEED_PASSWORD!,
};

/** Unique, clearly-labelled suffix for records these tests create. */
export const RUN = `e2e${Date.now().toString(36)}`;

export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function signInAsSuperAdmin(page: Page): Promise<void> {
  await signIn(page, SUPER_ADMIN.email, SUPER_ADMIN.password);
  await expect(
    page.getByRole('heading', { level: 1, name: /Good (morning|afternoon|evening), DEV/ }),
  ).toBeVisible();
}

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export async function expectAccessible(page: Page): Promise<void> {
  // A toast fading in is half-transparent; axe would measure the mid-animation contrast.
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLElement>('[data-sonner-toast]')]
      .filter((toast) => toast.dataset.visible !== 'false')
      .every((toast) => getComputedStyle(toast).opacity === '1'),
  );
  const result = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const summary = result.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`,
  );
  expect(summary, summary.join('\n')).toEqual([]);
}

/** Waits (up to `timeout`) for something that may legitimately never appear, e.g. leftovers. */
export function appears(locator: Locator, timeout = 8_000): Promise<boolean> {
  return locator.waitFor({ state: 'visible', timeout }).then(
    () => true,
    () => false,
  );
}

/** Every API answer the page received, to assert there were no failures or duplicates. */
export function trackApi(page: Page) {
  const calls: { method: string; path: string; status: number }[] = [];
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/')) {
      calls.push({
        method: response.request().method(),
        path: `${url.pathname}${url.search}`,
        status: response.status(),
      });
    }
  });
  return calls;
}
