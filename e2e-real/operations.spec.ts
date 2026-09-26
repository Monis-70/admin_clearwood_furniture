import { expect, test, type Page } from '@playwright/test';

import { RUN, appears, expectAccessible, signInAsSuperAdmin, trackApi } from './stack';

/*
 * The content, search, enquiry, order and reporting screens against the REAL local API. Records
 * created here carry the E2E run label and are deleted again; DEV records that are touched are
 * put back as they were.
 */

test.describe.configure({ mode: 'serial' });

function noServerErrors(calls: { method: string; path: string; status: number }[]) {
  const failed = calls.filter((c) => c.status >= 500);
  expect(failed, JSON.stringify(failed)).toEqual([]);
}

async function confirmIn(page: Page, button: string) {
  const confirm = page.getByRole('alertdialog');
  await confirm.getByRole('button', { name: button }).click();
  await expect(confirm).toBeHidden();
}

test('content: build, publish, unpublish and delete a page', async ({ page }) => {
  const calls = trackApi(page);
  await signInAsSuperAdmin(page);
  const title = `E2E Page ${RUN}`;
  const slug = `e2e-page-${RUN}`;

  await page.goto('/content/pages');
  await page.getByRole('button', { name: 'New page' }).click();
  const create = page.getByRole('dialog', { name: 'New page' });
  await create.getByLabel(/^Title/).fill(title);
  await create.getByLabel(/^URL slug/).fill(slug);
  await create.getByRole('button', { name: 'Create page' }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();

  await page.getByRole('button', { name: 'Add block' }).click();
  await page
    .getByRole('dialog', { name: 'Add a block' })
    .getByRole('button', { name: /Spacer/ })
    .click();
  const block = page.getByRole('dialog', { name: 'Add spacer' });
  await block.getByRole('button', { name: 'Add block' }).click();
  await expect(block).toBeHidden();
  await expect(page.getByRole('list', { name: 'Page blocks' }).getByText('Spacer')).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('button', { name: 'Publish' }).click();
  await confirmIn(page, 'Publish now');
  await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();

  await page.getByRole('button', { name: 'Unpublish' }).click();
  await confirmIn(page, 'Unpublish');
  await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible();

  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByRole('heading', { name: 'Who changed what' })).toBeVisible();

  await page.getByRole('button', { name: 'Delete' }).click();
  await confirmIn(page, 'Delete page');
  await expect(page).toHaveURL(/\/content\/pages$/);
  await page.getByRole('searchbox', { name: 'Search pages' }).fill(RUN);
  await expect(page.getByText('No page matches these filters')).toBeVisible();
  noServerErrors(calls);
});

test('content: FAQ, announcement and synonym round trips', async ({ page }) => {
  const calls = trackApi(page);
  await signInAsSuperAdmin(page);

  await page.goto('/content/faqs');
  await page.getByRole('button', { name: 'New question' }).click();
  const faq = page.getByRole('dialog', { name: 'New question' });
  await faq.getByLabel(/^Question/).fill(`E2E question ${RUN}?`);
  await faq.getByLabel(/^Answer/).fill('An answer written by the end-to-end test.');
  await faq.getByLabel('Visible').uncheck();
  await faq.getByRole('button', { name: 'Create question' }).click();
  const questions = page.getByRole('list', { name: 'Questions' });
  await expect(questions.getByText(`E2E question ${RUN}?`)).toBeVisible();
  await expectAccessible(page);
  await questions.getByRole('button', { name: `Actions for E2E question ${RUN}?` }).click();
  await page.getByRole('menuitem', { name: 'Delete…' }).click();
  await confirmIn(page, 'Delete question');
  await expect(questions.getByText(`E2E question ${RUN}?`)).toHaveCount(0);

  await page.goto('/content/announcements');
  await page.getByRole('button', { name: 'New announcement' }).click();
  const bar = page.getByRole('dialog', { name: 'New announcement' });
  await bar.getByLabel(/^Message/).fill(`E2E announcement ${RUN}`);
  await bar.getByLabel('On').uncheck();
  await bar.getByRole('button', { name: 'Create announcement' }).click();
  const list = page.getByRole('list', { name: 'Announcements' });
  await expect(list.getByText(`E2E announcement ${RUN}`)).toBeVisible();
  await list.getByRole('button', { name: `Actions for E2E announcement ${RUN}` }).click();
  await page.getByRole('menuitem', { name: 'Delete…' }).click();
  await confirmIn(page, 'Delete announcement');
  await expect(page.getByText(`E2E announcement ${RUN}`)).toHaveCount(0);

  await page.goto('/search/synonyms');
  await page.getByRole('button', { name: 'New synonyms' }).click();
  const syn = page.getByRole('dialog');
  await syn.getByLabel(/When customers search for/).fill(`e2e${RUN}`);
  await syn.getByLabel(/Also search for/).fill('sofa');
  await syn.getByRole('button', { name: 'Create synonyms' }).click();
  const table = page.getByRole('table', { name: 'Synonyms' });
  await expect(table.getByText(`e2e${RUN}`)).toBeVisible();
  await table.getByRole('button', { name: `Actions for e2e${RUN}` }).click();
  await page.getByRole('menuitem', { name: 'Delete…' }).click();
  await confirmIn(page, 'Delete synonyms');
  await expect(table.getByText(`e2e${RUN}`)).toHaveCount(0);
  noServerErrors(calls);
});

test('enquiries: add and remove an internal note on a DEV enquiry', async ({ page }) => {
  const calls = trackApi(page);
  await signInAsSuperAdmin(page);
  await page.goto('/enquiries');
  await page.getByRole('button', { name: /DEV Meera Iyer/ }).click();
  const sheet = page.getByRole('dialog', { name: /DEV Meera Iyer/ });
  const note = sheet.getByLabel('Internal note');
  const original = await note.inputValue();

  await note.fill(`${original}\nE2E ${RUN}`.trim());
  await sheet.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Enquiry updated').first()).toBeVisible();
  await expectAccessible(page);

  await note.fill(original);
  await sheet.getByRole('button', { name: 'Save changes' }).click();
  await expect(sheet.getByLabel('Internal note')).toHaveValue(original);
  noServerErrors(calls);
});

test('orders, shipments, reports, notifications and carts render real data', async ({ page }) => {
  const calls = trackApi(page);
  await signInAsSuperAdmin(page);

  await page.goto('/orders');
  const orders = page.getByRole('table', { name: 'Orders' });
  await expect(orders).toBeVisible();
  await expect(page.getByText('Online payments are not enabled')).toBeVisible();
  await expectAccessible(page);
  const first = orders.getByRole('link').first();
  if (await appears(first, 5_000)) {
    await first.click();
    await expect(page.getByRole('heading', { level: 1, name: /^Order / })).toBeVisible();
    for (const tab of ['Shipping', 'Documents', 'History', 'Money check']) {
      await page.getByRole('tab', { name: tab }).click();
      await expect(page.getByRole('tabpanel', { name: tab })).toBeVisible();
    }
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Change status' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  }

  await page.goto('/orders/shipments');
  await expect(page.getByRole('table', { name: 'Shipments' })).toBeVisible();
  await page.getByRole('tab', { name: 'Delivery problems' }).click();
  await expect(page.getByRole('region', { name: 'Delivery problems' })).toBeVisible();

  await page.goto('/orders/notifications');
  await expect(page.getByRole('table', { name: 'Notification log' })).toBeVisible();

  await page.goto('/orders/reports');
  await page.getByRole('button', { name: 'Show totals' }).click();
  await expect(page.getByLabel('Report totals')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  await expectAccessible(page);

  await page.goto('/carts');
  await expect(page.getByText('Active carts', { exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Carts' })).toBeVisible();
  await page.getByRole('tab', { name: 'Wishlists' }).click();
  await expect(page.getByText('Most wished for')).toBeVisible();
  await expectAccessible(page);
  noServerErrors(calls);
});

test('site settings: a change is saved, survives a reload, and is put back', async ({ page }) => {
  const calls = trackApi(page);
  await signInAsSuperAdmin(page);
  await page.goto('/content/site-settings');
  const hours = page.getByLabel('Business hours');
  const original = await hours.inputValue();

  await hours.fill(`${original} (E2E ${RUN})`);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Settings saved').first()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Business hours')).toHaveValue(`${original} (E2E ${RUN})`);

  await page.getByLabel('Business hours').fill(original);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Settings saved').first()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Business hours')).toHaveValue(original);
  await expectAccessible(page);
  noServerErrors(calls);
});
