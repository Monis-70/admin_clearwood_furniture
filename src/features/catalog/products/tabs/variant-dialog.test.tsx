import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGate } from '@/lib/auth/guards';
import { productDetail } from '@/tests/fixtures/catalog';
import { API, account, callsTo, errorBody, guarded, ok, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/render';

import type { AttributeRow } from '../../taxonomy/api';

import { VariantDialog } from './variant-dialog';

const value = (id: string, label: string, isActive = true) => ({
  id,
  attributeId: 'att_colour',
  code: id,
  label,
  description: null,
  position: 0,
  colorHex: null,
  swatchMediaId: null,
  numericValue: null,
  isActive,
  version: 1,
});

const colour: AttributeRow = {
  id: 'att_colour',
  code: 'colour',
  name: 'Colour',
  groupId: null,
  inputType: 'SWATCH_COLOR',
  dataType: 'STRING',
  unit: null,
  isVariantDefining: true,
  isFilterable: true,
  isSearchable: false,
  isRequired: false,
  isComparable: false,
  showInSwatch: true,
  position: 0,
  helpText: null,
  isActive: true,
  version: 1,
  values: [
    value('val_walnut', 'Walnut'),
    value('val_teak', 'Teak'),
    value('val_old', 'Retired', false),
  ],
};

const VARIANTS = '/api/v1/admin/catalog/products/prd_trikon/variants';

function renderDialog() {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  renderWithProviders(
    <AuthGate>
      <VariantDialog
        product={productDetail()}
        variant={null}
        attributes={[colour]}
        options={[colour]}
        onClose={onClose}
        onSaved={onSaved}
      />
    </AuthGate>,
  );
  return { onClose, onSaved };
}

describe('VariantDialog', () => {
  beforeEach(() => signInAs(account({ role: 'CATALOG_MANAGER' })));

  it('requires a value for every option and offers only active values', async () => {
    renderDialog();
    const dialog = await screen.findByRole('dialog', { name: 'Add a variant' });
    expect(within(dialog).getByRole('button', { name: 'Add variant' })).toBeDisabled();
    expect(within(dialog).getByText('Choose a value for: Colour.')).toBeInTheDocument();
    const select = within(dialog).getByLabelText('Colour');
    expect(within(select).queryByRole('option', { name: 'Retired' })).not.toBeInTheDocument();
    await userEvent.setup().selectOptions(select, 'val_teak');
    expect(within(dialog).getByRole('button', { name: 'Add variant' })).toBeEnabled();
  });

  it("explains the API's refusal of a combination that already exists and stays open", async () => {
    server.use(
      http.post(
        `${API}/admin/catalog/products/:id/variants`,
        guarded(
          () =>
            errorBody(
              409,
              'VARIANT_COMBINATION_EXISTS',
              'Another variant of this product already has exactly these options',
              { variantId: 'var_1', sku: 'CW-TRIKON-01-WAL' },
            ),
          { csrf: true },
        ),
      ),
    );
    const { onClose, onSaved } = renderDialog();
    const dialog = await screen.findByRole('dialog', { name: 'Add a variant' });
    const user = userEvent.setup();
    await user.selectOptions(within(dialog).getByLabelText('Colour'), 'val_walnut');
    await user.click(within(dialog).getByRole('button', { name: 'Add variant' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('That combination already exists');
    expect(callsTo(VARIANTS, 'POST')[0]!.body).toMatchObject({
      attributeValues: [{ attributeId: 'att_colour', attributeValueId: 'val_walnut' }],
    });
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('sends only what was entered: no SKU lets the API generate one', async () => {
    server.use(
      http.post(
        `${API}/admin/catalog/products/:id/variants`,
        guarded(() => ok({ id: 'var_2' }, 201), { csrf: true }),
      ),
    );
    const { onClose, onSaved } = renderDialog();
    const dialog = await screen.findByRole('dialog', { name: 'Add a variant' });
    const user = userEvent.setup();
    await user.selectOptions(within(dialog).getByLabelText('Colour'), 'val_teak');
    await user.type(within(dialog).getByLabelText(/^Price/), '14999');
    await user.type(within(dialog).getByLabelText(/Opening stock/), '4');
    await user.click(within(dialog).getByRole('button', { name: 'Add variant' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    const body = callsTo(VARIANTS, 'POST')[0]!.body as Record<string, unknown>;
    expect(body).not.toHaveProperty('sku');
    expect(body).toMatchObject({ pricePaise: 1_499_900, openingStock: 4 });
  });
});
