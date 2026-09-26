import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import type { AdminProductDetailDto, PublishBlockerDto } from '@shared/types/catalogAdmin';

import { AuthGate } from '@/lib/auth/guards';
import { productDetail } from '@/tests/fixtures/catalog';
import { API, account, callsTo, guarded, ok, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { ProductWorkbench } from './product-editor-screen';

const PRODUCT = '/api/v1/admin/catalog/products/prd_trikon';

function serveGate(blockers: PublishBlockerDto[], published?: AdminProductDetailDto) {
  server.use(
    http.get(
      `${API}/admin/catalog/products/:id/publish-blockers`,
      guarded(() => ok(blockers)),
    ),
    http.post(
      `${API}/admin/catalog/products/:id/publish`,
      guarded(() => ok(published ?? productDetail({ publication: 'LIVE' })), { csrf: true }),
    ),
  );
}

function renderWorkbench(product: AdminProductDetailDto) {
  return renderWithProviders(
    <AuthGate>
      <ProductWorkbench product={product} />
    </AuthGate>,
  );
}

describe('ProductWorkbench', () => {
  it('lists the live publish blockers even when the stored snapshot is clear', async () => {
    signInAs(account({ role: 'CATALOG_MANAGER' }));
    serveGate([{ code: 'NO_TAX_CLASS', message: 'Choose a tax class', field: 'taxClassId' }]);
    const { container } = renderWorkbench(productDetail({ publishBlockers: [] }));

    const panel = await screen.findByRole('complementary', { name: 'Product workbench' });
    expect(await within(panel).findByRole('heading', { name: 'Needs attention' })).toBeVisible();
    expect(within(panel).getByText('Choose a tax class')).toBeInTheDocument();
    expect(
      within(panel).getByRole('link', { name: /Fix this: Choose a tax class/ }),
    ).toHaveAttribute('href', '/catalog/products/edit?id=prd_trikon&tab=pricing');
    const next = within(panel).getByRole('region', { name: 'Next actions' });
    expect(within(next).queryByRole('button', { name: 'Publish now' })).not.toBeInTheDocument();
    expect(within(next).getByRole('link', { name: 'Review publishing checklist' })).toBeVisible();
    expect(callsTo(`${PRODUCT}/publish-blockers`)).toHaveLength(1);
    await expectNoA11yViolations(container);
  });

  it('offers Publish now only once the live gate is clear, and publishes with CSRF', async () => {
    signInAs(account({ role: 'CATALOG_MANAGER' }));
    serveGate([]);
    renderWorkbench(productDetail());

    const publish = await screen.findByRole('button', { name: 'Publish now' });
    expect(screen.getByRole('heading', { name: 'Ready' })).toBeInTheDocument();
    await userEvent.setup().click(publish);
    await waitFor(() => expect(callsTo(`${PRODUCT}/publish`, 'POST')).toHaveLength(1));
    expect(callsTo(`${PRODUCT}/publish`, 'POST')[0]!.csrf).toBe('csrf-adm_1');
  });

  it('summarises the media from the API: primary image, count and processing blocker', async () => {
    signInAs(account({ role: 'CATALOG_MANAGER' }));
    serveGate([
      { code: 'NO_PRIMARY_MEDIA', message: 'Set a primary image', field: 'media' },
      {
        code: 'MEDIA_NOT_READY',
        message: 'Some images are missing or still processing',
        field: 'media',
      },
    ]);
    renderWorkbench(
      productDetail({
        mediaCount: 2,
        completeness: {
          score: 60,
          factors: [
            { key: 'primaryMedia', label: 'Primary image', weight: 15, satisfied: false },
            {
              key: 'gallery',
              label: 'At least three gallery images',
              weight: 10,
              satisfied: false,
            },
          ],
        },
      }),
    );
    const media = await screen.findByRole('list', { name: 'Media status' });
    expect(within(media).getByText('No primary image')).toBeInTheDocument();
    expect(within(media).getByRole('link', { name: 'Add primary image' })).toHaveAttribute(
      'href',
      '/catalog/products/edit?id=prd_trikon&tab=media',
    );
    expect(within(media).getByText('2 images (3 or more recommended)')).toBeInTheDocument();
    expect(
      await within(media).findByText('Some images are processing or in the trash'),
    ).toBeInTheDocument();
  });

  it('shows a configured primary image as done', async () => {
    signInAs(account({ role: 'CATALOG_MANAGER' }));
    serveGate([]);
    renderWorkbench(
      productDetail({
        mediaCount: 4,
        completeness: {
          score: 100,
          factors: [
            { key: 'primaryMedia', label: 'Primary image', weight: 15, satisfied: true },
            { key: 'gallery', label: 'At least three gallery images', weight: 10, satisfied: true },
          ],
        },
      }),
    );
    const media = await screen.findByRole('list', { name: 'Media status' });
    expect(within(media).getByText('Primary image configured')).toBeInTheDocument();
    expect(within(media).getByText('4 images')).toBeInTheDocument();
    expect(within(media).queryByRole('link')).toBeNull();
  });

  it('offers Unpublish for a live product', async () => {
    signInAs(account({ role: 'CATALOG_MANAGER' }));
    serveGate([]);
    renderWorkbench(
      productDetail({ publication: 'LIVE', publishedAt: '2026-09-02T04:30:00.000Z' }),
    );
    expect(await screen.findByRole('button', { name: 'Unpublish' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Publish now' })).not.toBeInTheDocument();
  });

  it('shows a read-only admin the state but no actions or links they cannot use', async () => {
    signInAs(account({ role: 'CONTENT_MANAGER' }));
    serveGate([{ code: 'NO_PRIMARY_MEDIA', message: 'Set a primary image', field: 'media' }]);
    renderWorkbench(productDetail());

    const panel = await screen.findByRole('complementary', { name: 'Product workbench' });
    expect(await within(panel).findByText('Set a primary image')).toBeInTheDocument();
    expect(within(panel).queryByRole('region', { name: 'Next actions' })).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button')).not.toBeInTheDocument();
    // Price rules need pricing.adjustment.read: the count shows, the link does not.
    expect(within(panel).getByText('Price rules').closest('a')).toBeNull();
    expect(
      within(panel).queryByRole('heading', { name: 'Recent activity' }),
    ).not.toBeInTheDocument();
  });
});
