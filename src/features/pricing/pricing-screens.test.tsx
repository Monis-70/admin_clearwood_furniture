import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { AuthGate } from '@/lib/auth/guards';
import { productDetail } from '@/tests/fixtures/catalog';
import { API, account, callsTo, errorBody, guarded, ok, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { navigation } from '@/tests/navigation';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { CouponsScreen } from './coupons-screen';
import { CustomerGroupsScreen } from './customer-groups-screen';
import { DiscountRulesScreen } from './discount-rules-screen';
import { SimulatorScreen } from './simulator-screen';

const page = (items: unknown[]) =>
  ok(items, 200, {
    page: 1,
    limit: 25,
    total: items.length,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

const lamp = productDetail({ id: 'prd_lamp', name: 'Diya Lamp', sku: 'LAMP-1' });

function serveCatalogSearch() {
  server.use(
    http.get(
      `${API}/admin/catalog/products`,
      guarded(() => page([lamp])),
    ),
    http.get(
      `${API}/admin/pricing/customer-groups`,
      guarded(() =>
        page([
          {
            id: 'grp_trade',
            code: 'TRADE',
            name: 'Trade partners',
            description: null,
            isDefault: false,
            priority: 200,
            discountBp: 500,
            isActive: true,
            version: 1,
            updatedAt: '2026-09-20T09:30:00.000Z',
          },
        ]),
      ),
    ),
  );
}

const breakdown = {
  currency: 'INR',
  lines: [
    {
      lineId: 'l1',
      productId: 'prd_lamp',
      variantId: null,
      qty: 2,
      baseUnitPaise: 250_000,
      unitPricePaise: 225_000,
      components: [
        {
          code: 'BASE',
          label: 'Base price',
          kind: 'BASE',
          amountPaise: 500_000,
          sourceType: 'PRODUCT',
        },
        {
          code: 'ADJ_1',
          label: 'Festive 10%',
          kind: 'ADJUSTMENT',
          amountPaise: -50_000,
          sourceType: 'ADJUSTMENT',
        },
      ],
      subtotalPaise: 450_000,
      discountPaise: 50_000,
      taxablePaise: 381_356,
      taxPaise: 68_644,
      taxRateBp: 1800,
      taxSplit: { cgstPaise: 34_322, sgstPaise: 34_322, igstPaise: 0 },
      totalPaise: 450_000,
      savingsPaise: 50_000,
      savingsPercentBp: 1000,
      isMadeToOrder: false,
    },
  ],
  components: [],
  subtotalPaise: 450_000,
  discountPaise: 50_000,
  shippingPaise: 0,
  taxPaise: 68_644,
  taxSplit: { cgstPaise: 34_322, sgstPaise: 34_322, igstPaise: 0 },
  roundingPaise: 0,
  grandTotalPaise: 450_000,
  totalSavingsPaise: 50_000,
  appliedRuleIds: ['adj_1'],
  placeOfSupply: {
    sellerStateCode: '27',
    buyerStateCode: '27',
    isIntraState: true,
    isFallback: false,
  },
  pricesIncludeTax: true,
  calculatedAt: '2026-09-26T10:00:00.000Z',
  engineVersion: 1,
  contextHash: 'abc',
};

function render(
  ui: React.ReactElement,
  role: 'SUPER_ADMIN' | 'CATALOG_MANAGER' | 'ORDER_MANAGER',
  path: string,
) {
  signInAs(account({ role }));
  const [pathname, search = ''] = path.split('?');
  navigation.reset(pathname, search);
  return renderWithProviders(<AuthGate>{ui}</AuthGate>);
}

describe('SimulatorScreen', () => {
  it('prices a sample cart through the API and lays out its breakdown and trace', async () => {
    serveCatalogSearch();
    server.use(
      http.post(
        `${API}/admin/pricing/simulate`,
        guarded(
          () =>
            ok({
              breakdown,
              trace: [
                {
                  step: 'adjustment',
                  ruleId: 'adj_1',
                  ruleName: 'Festive 10%',
                  matched: true,
                  amountPaise: -50_000,
                },
              ],
            }),
          { csrf: true },
        ),
      ),
    );
    const { container } = render(<SimulatorScreen />, 'CATALOG_MANAGER', '/pricing/simulator');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Find a product by name or SKU'), 'lamp');
    await user.click(await screen.findByRole('button', { name: 'Add Diya Lamp' }));
    const qty = screen.getByLabelText('Quantity of Diya Lamp');
    await user.clear(qty);
    await user.type(qty, '2');
    await user.type(screen.getByLabelText('Delivery pincode'), '400001');
    await user.click(screen.getByRole('button', { name: 'Price this cart' }));

    expect(await screen.findByText('Festive 10%', { selector: 'td' })).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/pricing/simulate', 'POST')[0]!.body).toMatchObject({
      items: [{ productId: 'prd_lamp', qty: 2 }],
      pincode: '400001',
      channel: 'WEB',
      includeTrace: true,
    });
    expect(
      within(screen.getByRole('list', { name: 'Rules considered' })).getByText('Applied'),
    ).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('checks the sample cart before asking the API', async () => {
    serveCatalogSearch();
    render(<SimulatorScreen />, 'CATALOG_MANAGER', '/pricing/simulator');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Price this cart' }));
    expect(await screen.findByText('Add at least one product.')).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/pricing/simulate', 'POST')).toHaveLength(0);
  });
});

describe('DiscountRulesScreen', () => {
  it('creates a rule from conditions and discounts written in plain words', async () => {
    serveCatalogSearch();
    server.use(
      http.get(
        `${API}/admin/pricing/discount-rules`,
        guarded(() => page([])),
      ),
      http.post(
        `${API}/admin/pricing/discount-rules`,
        guarded(
          async (_a, request) =>
            ok({ id: 'dr_1', ...((await request.clone().json()) as object) }, 201),
          {
            csrf: true,
          },
        ),
      ),
    );
    render(<DiscountRulesScreen />, 'CATALOG_MANAGER', '/pricing/discount-rules');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New rule' }));
    const dialog = await screen.findByRole('dialog', { name: 'New automatic discount' });
    await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Big cart 5%');
    await user.type(within(dialog).getByRole('textbox', { name: /^Code/ }), 'BIG_CART_5');
    await user.type(within(dialog).getByLabelText('Value'), '50000');
    await user.type(within(dialog).getByLabelText('Percent'), '5');
    await user.type(within(dialog).getByLabelText('At most (₹, optional)'), '5000');
    await user.click(within(dialog).getByRole('button', { name: 'Create rule' }));

    await waitFor(() =>
      expect(callsTo('/api/v1/admin/pricing/discount-rules', 'POST')).toHaveLength(1),
    );
    expect(callsTo('/api/v1/admin/pricing/discount-rules', 'POST')[0]!.body).toMatchObject({
      code: 'BIG_CART_5',
      scope: 'CART',
      conditions: {
        match: 'ALL',
        conditions: [
          { field: 'cartSubtotalPaise', operator: 'GREATER_OR_EQUAL', value: 5_000_000 },
        ],
      },
      actions: [{ type: 'PERCENT', valueBp: 500, maxDiscountPaise: 500_000 }],
    });
  });

  it('refuses an empty condition before sending', async () => {
    server.use(
      http.get(
        `${API}/admin/pricing/discount-rules`,
        guarded(() => page([])),
      ),
    );
    render(<DiscountRulesScreen />, 'CATALOG_MANAGER', '/pricing/discount-rules');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New rule' }));
    const dialog = await screen.findByRole('dialog', { name: 'New automatic discount' });
    await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Broken');
    await user.type(within(dialog).getByRole('textbox', { name: /^Code/ }), 'BROKEN');
    await user.type(within(dialog).getByLabelText('Percent'), '5');
    await user.click(within(dialog).getByRole('button', { name: 'Create rule' }));
    expect(
      await within(dialog).findByText('Condition 1: choose or enter a value.'),
    ).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/pricing/discount-rules', 'POST')).toHaveLength(0);
  });
});

describe('CouponsScreen', () => {
  it('creates a coupon with an idempotency key and shows the API refusal of a duplicate code', async () => {
    let attempts = 0;
    server.use(
      http.get(
        `${API}/admin/pricing/coupons`,
        guarded(() => page([])),
      ),
      http.get(
        `${API}/admin/catalog/categories/tree`,
        guarded(() => ok([])),
      ),
      http.get(
        `${API}/admin/pricing/customer-groups`,
        guarded(() => page([])),
      ),
      http.post(
        `${API}/admin/pricing/coupons`,
        guarded(
          (_a, request) => {
            attempts += 1;
            expect(request.headers.get('idempotency-key')).toBeTruthy();
            return attempts === 1
              ? errorBody(409, 'CONFLICT', 'That coupon code already exists', { code: 'WELCOME10' })
              : ok({ id: 'cp_1' }, 201);
          },
          { csrf: true },
        ),
      ),
    );
    render(<CouponsScreen />, 'SUPER_ADMIN', '/pricing/coupons');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New coupon' }));
    const dialog = await screen.findByRole('dialog', { name: 'New coupon' });
    await user.type(within(dialog).getByRole('textbox', { name: /^Code/ }), 'welcome10');
    await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Welcome offer');
    await user.type(within(dialog).getByRole('textbox', { name: /^Percentage/ }), '10');
    await user.click(within(dialog).getByRole('button', { name: 'Create coupon' }));
    expect(await within(dialog).findByText('That coupon code already exists')).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/pricing/coupons', 'POST')[0]!.body).toMatchObject({
      code: 'WELCOME10',
      type: 'PERCENT',
      valueBp: 1000,
      appliesTo: null,
    });
  });

  it('explains the missing permission to a role without coupons', async () => {
    render(<CouponsScreen />, 'CATALOG_MANAGER', '/pricing/coupons');
    expect(
      await screen.findByRole('heading', { name: "You don't have access to coupons" }),
    ).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/pricing/coupons')).toHaveLength(0);
  });
});

describe('CustomerGroupsScreen', () => {
  it('adds members by customer ID and refuses anything that is not one', async () => {
    serveCatalogSearch();
    server.use(
      http.get(
        `${API}/admin/pricing/customer-groups/:id/members`,
        guarded(() => ok([])),
      ),
      http.post(
        `${API}/admin/pricing/customer-groups/:id/members`,
        guarded(() => ok({ added: 1 }), { csrf: true }),
      ),
    );
    render(<CustomerGroupsScreen />, 'ORDER_MANAGER', '/pricing/customer-groups?id=grp_trade');
    const user = userEvent.setup();
    const box = await screen.findByLabelText('Add customers');
    await user.type(box, 'not an id');
    expect(screen.getByText(/Not a customer ID/)).toBeInTheDocument();
    await user.clear(box);
    await user.type(box, 'cmuhdg3og008dr9gkp8k4fm0y');
    await user.click(screen.getByRole('button', { name: 'Add 1 customer' }));
    await waitFor(() =>
      expect(
        callsTo('/api/v1/admin/pricing/customer-groups/grp_trade/members', 'POST')[0]?.body,
      ).toEqual({
        customerIds: ['cmuhdg3og008dr9gkp8k4fm0y'],
      }),
    );
  });
});
