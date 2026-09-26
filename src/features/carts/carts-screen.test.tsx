import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { AuthGate } from '@/lib/auth/guards';
import { API, account, callsTo, guarded, ok, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { navigation } from '@/tests/navigation';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { CartsScreen } from './carts-screen';

const V1 = '/api/v1/admin';
const meta = (n: number) => ({
  page: 1,
  limit: 25,
  total: n,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
});

const row = {
  id: 'cart_1',
  status: 'ABANDONED',
  customerId: 'cus_1',
  customerName: 'Kiran Shah',
  customerEmail: 'kiran@example.test',
  isGuest: false,
  itemCount: 2,
  quantityTotal: 3,
  lastQuotedTotalPaise: 4_599_900,
  couponCode: null,
  pincode: '560001',
  lastActivityAt: '2026-09-20T04:00:00.000Z',
  ageHours: 120,
  createdAt: '2026-09-19T04:00:00.000Z',
};

const stats = {
  totals: { active: 12, abandoned: 4, converted: 30, merged: 2, expired: 1 },
  abandonmentRateBp: 1_428,
  averageValuePaise: 3_200_000,
  activeValuePaise: 38_400_000,
  topAbandonedProducts: [
    { productId: 'p1', name: 'Oslo sofa', sku: 'OSLO-3', carts: 3, quantity: 3 },
  ],
};

function render(role: 'SUPER_ADMIN' | 'CONTENT_MANAGER', search = '') {
  server.use(
    http.get(
      `${API}/admin/carts`,
      guarded(() => ok([row], 200, meta(1))),
    ),
    http.get(
      `${API}/admin/carts/stats`,
      guarded(() => ok(stats)),
    ),
    http.post(
      `${API}/admin/carts/cleanup`,
      guarded(() => ok({ abandoned: 5, expired: 2 }), { csrf: true }),
    ),
    http.get(
      `${API}/admin/wishlists/stats`,
      guarded(() =>
        ok({
          mostWishlisted: [{ productId: 'p1', name: 'Oslo sofa', sku: 'OSLO-3', count: 9 }],
          priceDropCandidates: [],
          totals: { lists: 20, items: 55, publicLists: 3 },
        }),
      ),
    ),
  );
  signInAs(account({ role }));
  navigation.reset('/carts', search);
  return renderWithProviders(
    <AuthGate>
      <CartsScreen />
    </AuthGate>,
  );
}

describe('CartsScreen', () => {
  it('shows cart figures and runs the clean-up only after an explicit acknowledgement', async () => {
    const user = userEvent.setup();
    const { container } = render('SUPER_ADMIN');

    expect(await screen.findByText('14.3%')).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Carts' });
    expect(within(table).getByText('Kiran Shah')).toBeInTheDocument();
    expect(within(table).getByText('Abandoned')).toBeInTheDocument();
    await expectNoA11yViolations(container);

    await user.click(screen.getByRole('button', { name: 'Clean up old carts' }));
    const dialog = await screen.findByRole('dialog');
    const run = within(dialog).getByRole('button', { name: 'Run clean-up' });
    expect(run).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Mark carts abandoned after/), '48');
    await user.click(within(dialog).getByLabelText(/cannot be restored/));
    await user.click(run);

    await waitFor(() => expect(callsTo(`${V1}/carts/cleanup`, 'POST')).toHaveLength(1));
    expect(callsTo(`${V1}/carts/cleanup`, 'POST')[0]!.body).toEqual({ abandonAfterHours: 48 });
    expect(await within(dialog).findByText(/5 carts marked abandoned, 2/)).toBeInTheDocument();
  });

  it('shows wishlist activity on its tab', async () => {
    render('SUPER_ADMIN', 'tab=wishlists');
    const list = await screen.findByRole('list', { name: 'Most wished for' });
    expect(within(list).getByText('Oslo sofa')).toBeInTheDocument();
    expect(screen.getByText('No saved product is cheaper now.')).toBeInTheDocument();
  });

  it('explains the missing permission to roles without customer access', async () => {
    render('CONTENT_MANAGER');
    expect(
      await screen.findByText("You don't have access to carts and wishlists"),
    ).toBeInTheDocument();
    expect(callsTo(`${V1}/carts`, 'GET')).toHaveLength(0);
  });
});
