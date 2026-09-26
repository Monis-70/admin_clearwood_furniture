import { screen, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import type { PublishBlockerDto } from '@shared/types/catalogAdmin';

import { AuthGate } from '@/lib/auth/guards';
import { productDetail } from '@/tests/fixtures/catalog';
import { API, account, guarded, ok, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { SpecificationsTab } from './specifications-tab';

function attribute(id: string, name: string, groupId: string, valueIds: string[]) {
  return {
    id,
    code: name.toUpperCase().replace(/\W+/g, '_'),
    name,
    groupId,
    inputType: 'SELECT',
    dataType: 'STRING',
    unit: null,
    isVariantDefining: false,
    isFilterable: true,
    isSearchable: false,
    isRequired: false,
    isComparable: false,
    showInSwatch: false,
    position: 1,
    helpText: null,
    isActive: true,
    version: 1,
    values: valueIds.map((valueId, position) => ({
      id: valueId,
      attributeId: id,
      code: valueId.toUpperCase(),
      label: valueId.replace(/^val_/, ''),
      description: null,
      position,
      colorHex: null,
      swatchMediaId: null,
      numericValue: null,
      isActive: true,
      version: 1,
    })),
  };
}

function serve(blockers: PublishBlockerDto[]) {
  server.use(
    http.get(
      `${API}/admin/catalog/attributes`,
      guarded(() =>
        ok(
          [
            attribute('att_wood', 'Wood type', 'grp_material', ['val_teak', 'val_sheesham']),
            attribute('att_mattress', 'Mattress size', 'grp_size', ['val_king']),
          ],
          200,
          { page: 1, limit: 100, total: 2, totalPages: 1, hasNext: false },
        ),
      ),
    ),
    http.get(
      `${API}/admin/catalog/attribute-groups`,
      guarded(() =>
        ok([
          { id: 'grp_material', name: 'Material', code: 'MATERIAL', position: 1, isActive: true },
          { id: 'grp_size', name: 'Size', code: 'SIZE', position: 2, isActive: true },
        ]),
      ),
    ),
    http.get(
      `${API}/admin/catalog/categories/:id/attributes`,
      guarded(() => ok([])),
    ),
    http.get(
      `${API}/admin/catalog/products/:id/publish-blockers`,
      guarded(() => ok(blockers)),
    ),
  );
}

const product = productDetail({
  attributeValues: [
    {
      attributeId: 'att_wood',
      attributeValueId: 'val_teak',
      valueText: null,
      valueNumber: null,
      valueBoolean: null,
      position: 1,
    },
    {
      attributeId: 'att_mattress',
      attributeValueId: 'val_king',
      valueText: null,
      valueNumber: null,
      valueBoolean: null,
      position: 2,
    },
  ],
});

function renderTab() {
  signInAs(account({ role: 'CATALOG_MANAGER' }));
  return renderWithProviders(
    <AuthGate>
      <SpecificationsTab product={product} />
    </AuthGate>,
  );
}

describe('SpecificationsTab and the publish gate', () => {
  it('marks the specifications the live gate says the primary category does not use', async () => {
    serve([
      {
        code: 'INVALID_CATEGORY_ATTRIBUTES',
        message: 'Some specifications do not belong to the primary category',
        field: 'attributeValues',
        details: { attributeIds: ['att_mattress'] },
      },
    ]);
    const { container } = renderTab();

    const title = await screen.findByText('Publishing is blocked by these specifications');
    const alert = title.parentElement!;
    expect(alert).toHaveTextContent('Mattress size is not used by the primary category.');
    const mattress = screen.getByText('Mattress size').closest('div')!;
    expect(within(mattress).getByText('Not in the primary category')).toBeInTheDocument();
    const wood = screen.getByText('Wood type').closest('div')!;
    expect(within(wood).queryByText('Not in the primary category')).toBeNull();
    await expectNoA11yViolations(container);
  });

  it('flags nothing when the gate has no such blocker', async () => {
    serve([{ code: 'NO_TAX_CLASS', message: 'Assign a tax class', field: 'taxClassId' }]);
    renderTab();
    expect(await screen.findByText('Mattress size')).toBeInTheDocument();
    expect(screen.queryByText('Not in the primary category')).toBeNull();
    expect(screen.queryByText('Publishing is blocked by these specifications')).toBeNull();
  });
});
