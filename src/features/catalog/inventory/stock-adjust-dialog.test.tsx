import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { InventorySnapshotDto } from '@shared/types/catalogAdmin';

import { AuthGate } from '@/lib/auth/guards';
import { API, account, callsTo, errorBody, guarded, ok, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { StockAdjustDialog } from './stock-adjust-dialog';

const VARIANT = '/api/v1/admin/catalog/variants/var_amber';

const snapshot = (stockQty: number, reservedQty = 2): InventorySnapshotDto => ({
  variantId: 'var_amber',
  sku: 'CW-AMBER-2S',
  stockQty,
  reservedQty,
  availableQty: Math.max(0, stockQty - reservedQty),
  stockStatus: 'IN_STOCK',
  lowStockThreshold: 3,
  allowBackorder: false,
});

let balance = 10;
let keys: (string | null)[] = [];

/** The ledger as the API keeps it: a stale expectedBalance is refused, never overwritten. */
function serveLedger(respond?: () => Response | undefined) {
  keys = [];
  server.use(
    http.get(
      `${API}/admin/catalog/variants/:id/inventory/snapshot`,
      guarded(() => ok(snapshot(balance))),
    ),
    http.post(
      `${API}/admin/catalog/variants/:id/inventory/adjust`,
      guarded(
        async (_a, request) => {
          keys.push(request.headers.get('idempotency-key'));
          const body = (await request.clone().json()) as { delta: number; expectedBalance: number };
          const override = respond?.();
          if (override) return override;
          if (body.expectedBalance !== balance)
            return errorBody(409, 'INVENTORY_CONFLICT', 'Stock changed while you were editing');
          balance += body.delta;
          return ok({ snapshot: snapshot(balance), entry: { id: 'led_1' } }, 201);
        },
        { csrf: true },
      ),
    ),
  );
}

function renderDialog(onClose = vi.fn()) {
  renderWithProviders(
    <AuthGate>
      <StockAdjustDialog
        variantId="var_amber"
        label="Amber 2-Seater (CW-AMBER-2S)"
        onClose={onClose}
      />
    </AuthGate>,
  );
  return onClose;
}

describe('StockAdjustDialog', () => {
  beforeEach(() => {
    balance = 10;
    signInAs(account({ role: 'CATALOG_MANAGER' }));
  });

  it('states the exact before and after, then writes one ledger movement', async () => {
    serveLedger();
    const onClose = renderDialog();
    const dialog = await screen.findByRole('dialog', { name: 'Adjust stock' });
    const user = userEvent.setup();
    await user.type(await within(dialog).findByLabelText('Quantity'), '5');
    expect(within(dialog).getByText(/Stock goes from/)).toHaveTextContent(
      'Stock goes from 10 to 15',
    );
    await expectNoA11yViolations(dialog);

    await user.click(within(dialog).getByRole('button', { name: 'Save stock change' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(callsTo(`${VARIANT}/inventory/adjust`, 'POST')[0]!.body).toEqual({
      delta: 5,
      reason: 'PURCHASE',
      note: null,
      expectedBalance: 10,
    });
    expect(keys[0]).toMatch(/^.{8,200}$/);
  });

  it('warns before a removal the API would refuse because of reservations', async () => {
    serveLedger();
    renderDialog();
    const dialog = await screen.findByRole('dialog', { name: 'Adjust stock' });
    const user = userEvent.setup();
    await user.click(await within(dialog).findByLabelText('Remove'));
    await user.type(within(dialog).getByLabelText('Quantity'), '9');
    expect(within(dialog).getByText(/below the 2 reserved/)).toBeInTheDocument();
  });

  it('retries a failed attempt with the same key, so the API cannot count it twice', async () => {
    let fail = true;
    serveLedger(() => {
      if (!fail) return undefined;
      fail = false;
      return errorBody(503, 'SERVICE_UNAVAILABLE', 'Try again');
    });
    const onClose = renderDialog();
    const dialog = await screen.findByRole('dialog', { name: 'Adjust stock' });
    const user = userEvent.setup();
    await user.type(await within(dialog).findByLabelText('Quantity'), '5');
    await user.click(within(dialog).getByRole('button', { name: 'Save stock change' }));
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Save stock change' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    expect(balance).toBe(15);
  });

  it('refuses silently overwriting a concurrent change and reloads the balance', async () => {
    serveLedger();
    const onClose = renderDialog();
    const dialog = await screen.findByRole('dialog', { name: 'Adjust stock' });
    const user = userEvent.setup();
    await user.type(await within(dialog).findByLabelText('Quantity'), '5');
    balance = 12; // another admin counted stock meanwhile
    await user.click(within(dialog).getByRole('button', { name: 'Save stock change' }));

    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByText(/Stock goes from/)).toHaveTextContent(
        'Stock goes from 12 to 17',
      ),
    );
    expect(callsTo(`${VARIANT}/inventory/snapshot`)).toHaveLength(2);
    expect(callsTo(`${VARIANT}/inventory/adjust`, 'POST')).toHaveLength(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(balance).toBe(12);
  });
});
