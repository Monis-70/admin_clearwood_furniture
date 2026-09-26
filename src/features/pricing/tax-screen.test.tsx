import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { AuthGate } from '@/lib/auth/guards';
import { API, account, callsTo, guarded, ok, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { navigation } from '@/tests/navigation';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import type { TaxClassRow } from '../catalog/taxonomy/api';

import { TaxScreen } from './tax-screen';

const taxClass = (
  id: string,
  name: string,
  rateBp: number,
  overrides: Partial<TaxClassRow> = {},
): TaxClassRow => ({
  id,
  code: name.toUpperCase().replace(/\W+/g, '_'),
  name,
  rateBp,
  hsnCode: null,
  isDefault: false,
  isActive: true,
  updatedAt: '2026-09-20T09:30:00.000Z',
  ...overrides,
});

function serve(initial: TaxClassRow[]) {
  const rows = [...initial];
  server.use(
    http.get(
      `${API}/admin/catalog/tax-classes`,
      guarded(() =>
        ok(rows, 200, {
          page: 1,
          limit: 100,
          total: rows.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        }),
      ),
    ),
    http.post(
      `${API}/admin/catalog/tax-classes`,
      guarded(
        async (_a, request) => {
          const body = (await request.clone().json()) as TaxClassRow;
          const row = taxClass('tax_new', body.name, body.rateBp, body);
          rows.push(row);
          return ok(row, 201);
        },
        { csrf: true },
      ),
    ),
  );
}

const standard = [
  taxClass('tax_18', 'GST 18%', 1800, { code: 'GST_18', hsnCode: '9403', isDefault: true }),
  taxClass('tax_12', 'GST 12%', 1200, { code: 'GST_12' }),
];

function renderScreen(role: 'SUPER_ADMIN' | 'CATALOG_MANAGER' | 'ORDER_MANAGER' = 'SUPER_ADMIN') {
  signInAs(account({ role }));
  navigation.reset('/pricing/tax');
  return renderWithProviders(
    <AuthGate>
      <TaxScreen />
    </AuthGate>,
  );
}

describe('TaxScreen', () => {
  it('shows rates as percentages and never offers to delete the default class', async () => {
    serve(standard);
    const { container } = renderScreen();
    const table = await screen.findByRole('table', { name: 'Tax classes' });
    const gst18 = within(table)
      .getByText('GST 18%', { selector: 'span.font-medium' })
      .closest('tr')!;
    expect(within(gst18).getByText('18%')).toBeInTheDocument();
    expect(within(gst18).getByText('Default')).toBeInTheDocument();
    expect(within(gst18).getByText('9403')).toBeInTheDocument();
    await expectNoA11yViolations(container);

    const user = userEvent.setup();
    await user.click(within(gst18).getByRole('button', { name: 'Actions for GST 18%' }));
    expect(await screen.findByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Delete…' })).not.toBeInTheDocument();
  });

  it('sends the rate in basis points: 12.5 becomes 1250', async () => {
    serve(standard);
    renderScreen();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New tax class' }));
    const dialog = await screen.findByRole('dialog', { name: 'New tax class' });
    await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'GST 12.5%');
    await user.type(within(dialog).getByRole('textbox', { name: /^Code/ }), 'GST_12_5');
    await user.type(within(dialog).getByRole('textbox', { name: /^GST rate/ }), '12.5');
    await user.click(within(dialog).getByRole('button', { name: 'Create tax class' }));
    await waitFor(() =>
      expect(callsTo('/api/v1/admin/catalog/tax-classes', 'POST')[0]?.body).toMatchObject({
        code: 'GST_12_5',
        name: 'GST 12.5%',
        rateBp: 1250,
        isDefault: false,
      }),
    );
    expect(
      await within(screen.getByRole('table', { name: 'Tax classes' })).findByText('12.5%'),
    ).toBeInTheDocument();
  });

  it('refuses a rate that is not a percentage before sending anything', async () => {
    serve(standard);
    renderScreen();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New tax class' }));
    const dialog = await screen.findByRole('dialog', { name: 'New tax class' });
    await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Odd rate');
    await user.type(within(dialog).getByRole('textbox', { name: /^Code/ }), 'ODD');
    await user.type(within(dialog).getByRole('textbox', { name: /^GST rate/ }), 'eighteen');
    await user.click(within(dialog).getByRole('button', { name: 'Create tax class' }));
    expect(
      await within(dialog).findByText('Enter a percentage like 18 or 12.5'),
    ).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/catalog/tax-classes', 'POST')).toHaveLength(0);
  });

  it('is read-only for a Catalog Manager (pricing.tax.read without pricing.tax.update)', async () => {
    serve(standard);
    renderScreen('CATALOG_MANAGER');
    const table = await screen.findByRole('table', { name: 'Tax classes' });
    expect(within(table).getAllByText('GST 12%').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'New tax class' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Actions for/ })).not.toBeInTheDocument();
  });

  it('explains the missing permission to a role without pricing.tax.read', async () => {
    serve(standard);
    renderScreen('ORDER_MANAGER');
    expect(
      await screen.findByRole('heading', { name: "You don't have access to tax classes" }),
    ).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/catalog/tax-classes')).toHaveLength(0);
  });
});
