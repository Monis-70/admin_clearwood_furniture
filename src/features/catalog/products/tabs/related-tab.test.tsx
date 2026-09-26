import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import type { AdminProductDetailDto } from '@shared/types/catalogAdmin';

import { AuthGate } from '@/lib/auth/guards';
import { productDetail } from '@/tests/fixtures/catalog';
import { API, account, callsTo, errorBody, guarded, ok, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { RelatedTab } from './related-tab';

const relation = (id: string, name: string, type: 'RELATED' | 'SIMILAR', position: number) => ({
  id: `rel_${id}`,
  relatedProductId: id,
  relatedProductName: name,
  relatedProductSku: id.toUpperCase(),
  type,
  position,
});

const product: AdminProductDetailDto = productDetail({
  id: 'prd_sofa',
  name: 'Kabir Sofa',
  relations: [
    relation('prd_chair', 'Anant Chair', 'RELATED', 0),
    relation('prd_table', 'Trikon Table', 'RELATED', 1),
  ],
});

function serve(refuse = false) {
  server.use(
    http.get(
      `${API}/admin/catalog/products`,
      guarded(() =>
        ok(
          [
            productDetail({ id: 'prd_sofa', name: 'Kabir Sofa', sku: 'SOFA' }),
            productDetail({ id: 'prd_lamp', name: 'Diya Lamp', sku: 'LAMP' }),
          ],
          200,
          { page: 1, limit: 8, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
        ),
      ),
    ),
    http.put(
      `${API}/admin/catalog/products/:id/relations`,
      guarded(
        () =>
          refuse
            ? errorBody(422, 'VALIDATION_ERROR', 'Unknown related product', {
                productIds: ['prd_lamp'],
              })
            : ok({ ...product, version: product.version + 1 }),
        { csrf: true },
      ),
    ),
  );
}

function renderTab(role: 'CATALOG_MANAGER' | 'CONTENT_MANAGER' = 'CATALOG_MANAGER') {
  signInAs(account({ role }));
  return renderWithProviders(
    <AuthGate>
      <RelatedTab product={product} />
    </AuthGate>,
  );
}

describe('RelatedTab', () => {
  it('adds, reorders and removes related products, then saves positions per type', async () => {
    serve();
    const { container } = renderTab();
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText('Relation'), 'SIMILAR');
    await user.type(screen.getByLabelText('Find a product by name or SKU'), 'lamp');
    const matches = await screen.findByRole('list', { name: 'Matching products' });
    await user.click(
      await within(matches).findByRole('button', { name: 'Add Diya Lamp as Similar' }),
    );
    expect(within(matches).queryByText('Kabir Sofa')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Move Trikon Table up' }));
    await user.click(screen.getByRole('button', { name: 'Remove Anant Chair from Related' }));
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole('button', { name: 'Save related products' }));

    await waitFor(() =>
      expect(callsTo('/api/v1/admin/catalog/products/prd_sofa/relations', 'PUT')).toHaveLength(1),
    );
    expect(callsTo('/api/v1/admin/catalog/products/prd_sofa/relations', 'PUT')[0]!.body).toEqual({
      relations: [
        { relatedProductId: 'prd_table', type: 'RELATED', position: 0 },
        { relatedProductId: 'prd_lamp', type: 'SIMILAR', position: 0 },
      ],
    });
  });

  it('shows the API refusal and keeps the unsaved list', async () => {
    serve(true);
    renderTab();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Remove Anant Chair from Related' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save related products' }));
    expect(await screen.findByText('Unknown related product')).toBeInTheDocument();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('is read-only for a role that cannot change products', async () => {
    serve();
    renderTab('CONTENT_MANAGER');
    expect(await screen.findByText('Anant Chair')).toBeInTheDocument();
    expect(screen.queryByLabelText('Find a product by name or SKU')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument();
  });
});
