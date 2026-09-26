import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { File as NodeFile } from 'node:buffer';
import { describe, expect, it } from 'vitest';

import { AuthGate } from '@/lib/auth/guards';
import { productDetail } from '@/tests/fixtures/catalog';
import { API, account, backend, callsTo, guarded, ok, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { navigation } from '@/tests/navigation';
import { renderWithProviders } from '@/tests/render';

import { ProductTiers } from '../catalog/products/tabs/pricing/tiers-and-explain';

import { DeliveryScreen } from './delivery-screen';
import { PriceListsScreen } from './price-lists-screen';
import { PricingSettingsPanel } from './pricing-settings-panel';

const meta = (n: number) => ({
  page: 1,
  limit: 25,
  total: n,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
});

function render(
  ui: React.ReactElement,
  role: 'SUPER_ADMIN' | 'CATALOG_MANAGER',
  path = '/',
  search = '',
) {
  signInAs(account({ role }));
  navigation.reset(path, search);
  return renderWithProviders(<AuthGate>{ui}</AuthGate>);
}

describe('DeliveryScreen', () => {
  it('shows zones with their rates and imports a pincode CSV as multipart', async () => {
    server.use(
      http.get(
        `${API}/admin/pricing/shipping-zones`,
        guarded(() =>
          ok([
            {
              id: 'z_metro',
              code: 'METRO',
              name: 'Metro cities',
              priority: 10,
              isActive: true,
              version: 1,
              updatedAt: '',
            },
          ]),
        ),
      ),
      http.get(
        `${API}/admin/pricing/shipping-rates`,
        guarded(() =>
          ok([
            {
              id: 'r_std',
              zoneId: 'z_metro',
              method: 'STANDARD',
              name: 'Standard',
              conditionType: 'PRICE',
              minValue: null,
              maxValue: null,
              basePaise: 99_900,
              perUnitPaise: null,
              freeAbovePaise: 5_000_000,
              etaMinDays: 3,
              etaMaxDays: 7,
              isActive: true,
              priority: 100,
              version: 1,
              updatedAt: '',
            },
          ]),
        ),
      ),
      http.get(
        `${API}/admin/pricing/shipping-pincodes`,
        guarded(() => ok([])),
      ),
      http.post(
        `${API}/admin/pricing/shipping-zones/:id/pincodes/import`,
        guarded(() => ok({ imported: 2, skipped: 1 }), { csrf: true }),
      ),
    );
    render(<DeliveryScreen />, 'SUPER_ADMIN', '/pricing/delivery', 'zone=z_metro');
    const rates = await screen.findByRole('list', { name: 'Rates in Metro cities' });
    expect(within(rates).getByText(/free above/)).toBeInTheDocument();
    const user = userEvent.setup();
    await user.upload(
      await screen.findByLabelText('Pincode CSV file'),
      new NodeFile(['pincode\n400001\n400002\nbad'], 'pins.csv', {
        type: 'text/csv',
      }) as unknown as File,
    );
    await waitFor(() =>
      expect(
        callsTo('/api/v1/admin/pricing/shipping-zones/z_metro/pincodes/import', 'POST'),
      ).toHaveLength(1),
    );
  });

  it('is read-only without pricing.tax.update', async () => {
    server.use(
      http.get(
        `${API}/admin/pricing/shipping-zones`,
        guarded(() =>
          ok([
            {
              id: 'z1',
              code: 'ALL',
              name: 'India',
              priority: 1,
              isActive: true,
              version: 1,
              updatedAt: '',
            },
          ]),
        ),
      ),
      http.get(
        `${API}/admin/pricing/shipping-rates`,
        guarded(() => ok([])),
      ),
    );
    render(<DeliveryScreen />, 'CATALOG_MANAGER', '/pricing/delivery');
    expect(await screen.findByRole('heading', { name: 'India' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New zone' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Actions for zone/ })).not.toBeInTheDocument();
  });
});

describe('PriceListsScreen', () => {
  it('replaces the items of a price list with the edited prices', async () => {
    server.use(
      http.get(
        `${API}/admin/pricing/price-lists`,
        guarded(() =>
          ok(
            [
              {
                id: 'pl_trade',
                code: 'TRADE',
                name: 'Trade prices',
                customerGroupId: null,
                channel: 'WEB',
                priority: 100,
                startsAt: null,
                endsAt: null,
                isActive: true,
                version: 1,
                updatedAt: '',
              },
            ],
            200,
            meta(1),
          ),
        ),
      ),
      http.get(
        `${API}/admin/pricing/price-lists/:id/items`,
        guarded(() =>
          ok([
            {
              id: 'i1',
              priceListId: 'pl_trade',
              productId: 'prd_sofa',
              variantId: null,
              minQty: 1,
              pricePaise: 4_500_000,
            },
          ]),
        ),
      ),
      http.put(
        `${API}/admin/pricing/price-lists/:id/items`,
        guarded(() => ok({ items: 1 }), { csrf: true }),
      ),
      http.get(
        `${API}/admin/pricing/tier-prices`,
        guarded(() => ok([], 200, meta(0))),
      ),
      http.get(
        `${API}/admin/pricing/customer-groups`,
        guarded(() => ok([], 200, meta(0))),
      ),
    );
    render(<PriceListsScreen />, 'CATALOG_MANAGER', '/pricing/price-lists', 'id=pl_trade');
    const price = await screen.findByLabelText('Unit price (₹)');
    expect(price).toHaveValue('45000');
    const user = userEvent.setup();
    await user.clear(price);
    await user.type(price, '42999.50');
    await user.click(screen.getByRole('button', { name: 'Save prices' }));
    await waitFor(() =>
      expect(callsTo('/api/v1/admin/pricing/price-lists/pl_trade/items', 'PUT')[0]?.body).toEqual({
        items: [{ productId: 'prd_sofa', minQty: 1, pricePaise: 4_299_950 }],
      }),
    );
  });
});

describe('ProductTiers', () => {
  it('adds a percentage tier for the product', async () => {
    server.use(
      http.get(
        `${API}/admin/pricing/tier-prices`,
        guarded(() => ok([], 200, meta(0))),
      ),
      http.get(
        `${API}/admin/pricing/customer-groups`,
        guarded(() => ok([], 200, meta(0))),
      ),
      http.post(
        `${API}/admin/pricing/tier-prices`,
        guarded(() => ok({ id: 't1' }, 201), { csrf: true }),
      ),
    );
    render(
      <ProductTiers product={productDetail({ id: 'prd_sofa', variants: [] })} />,
      'CATALOG_MANAGER',
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Add tier' }));
    const dialog = await screen.findByRole('dialog', { name: 'New quantity tier' });
    await user.selectOptions(within(dialog).getByLabelText('Tier gives'), 'discount');
    await user.type(within(dialog).getByRole('textbox', { name: /^Discount/ }), '7.5');
    await user.click(within(dialog).getByRole('button', { name: 'Add tier' }));
    await waitFor(() =>
      expect(callsTo('/api/v1/admin/pricing/tier-prices', 'POST')[0]?.body).toEqual({
        productId: 'prd_sofa',
        minQty: 2,
        pricePaise: null,
        discountBp: 750,
        customerGroupId: null,
        isActive: true,
      }),
    );
  });
});

describe('PricingSettingsPanel', () => {
  it('sends only the changed settings', async () => {
    server.use(
      http.get(
        `${API}/admin/pricing/settings`,
        guarded(() =>
          ok({
            pricesIncludeTax: true,
            sellerStateCode: '27',
            defaultPlaceOfSupply: '27',
            shippingTaxable: true,
            shippingTaxRateBp: 1800,
            roundTotalToRupee: true,
            freeShippingThresholdPaise: 5_000_000,
            showSavingsBadge: true,
            minOrderValuePaise: 0,
          }),
        ),
      ),
      http.get(
        `${API}/admin/catalog/tax-classes`,
        guarded(() => ok([], 200, meta(0))),
      ),
      http.put(
        `${API}/admin/pricing/settings`,
        guarded(async (_a, r) => ok(await r.clone().json()), { csrf: true }),
      ),
    );
    render(<PricingSettingsPanel />, 'SUPER_ADMIN');
    const user = userEvent.setup();
    const threshold = await screen.findByLabelText(/^Free delivery above/);
    await user.clear(threshold);
    await user.type(threshold, '60000');
    await user.click(screen.getByLabelText('Round the total to the nearest rupee'));
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() =>
      expect(callsTo('/api/v1/admin/pricing/settings', 'PUT')[0]?.body).toEqual({
        roundTotalToRupee: false,
        freeShippingThresholdPaise: 6_000_000,
      }),
    );
    expect(backend.calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
  });
});
