import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { AuthGate } from '@/lib/auth/guards';
import { API, account, callsTo, errorBody, guarded, ok, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { navigation } from '@/tests/navigation';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { OrderViewScreen } from './order-view-screen';
import { OrdersScreen } from './orders-screen';
import { ReportsScreen } from './reports-screen';
import { ShipmentsScreen } from './shipments-screen';

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
  id: 'ord_1',
  orderNumber: 'CW-1001',
  status: 'CONFIRMED',
  paymentStatus: 'PENDING',
  fulfillmentStatus: 'UNFULFILLED',
  customerName: 'Asha Rao',
  customerEmail: 'asha@example.test',
  isGuest: false,
  itemCount: 1,
  grandTotalPaise: 2_499_900,
  paidPaise: 0,
  refundedPaise: 0,
  couponCode: null,
  channel: 'WEB',
  hasFailedTransfer: false,
  placedAt: '2026-09-25T04:00:00.000Z',
  createdAt: '2026-09-25T04:00:00.000Z',
};
const item = {
  id: 'oi_1',
  productId: 'p1',
  variantId: null,
  sku: 'OSLO-3',
  productName: 'Oslo sofa',
  variantName: null,
  brandName: null,
  imageUrl: null,
  optionLabels: [],
  qty: 2,
  unitPricePaise: 1_249_950,
  baseUnitPricePaise: 1_249_950,
  lineSubtotalPaise: 2_499_900,
  lineDiscountPaise: 0,
  taxablePaise: 2_118_559,
  taxPaise: 381_341,
  taxRateBp: 1_800,
  cgstPaise: 190_670,
  sgstPaise: 190_671,
  igstPaise: 0,
  hsnCode: '9401',
  lineTotalPaise: 2_499_900,
  components: [],
  isMadeToOrder: false,
  leadTimeDays: null,
  fulfilledQty: 0,
  cancelledQty: 0,
  refundedQty: 0,
  refundedAmountPaise: 0,
  position: 0,
};
const detail = {
  ...row,
  order: {
    ...row,
    currency: 'INR',
    customerId: 'cus_1',
    contactEmail: 'asha@example.test',
    contactPhone: '+91 90000 00000',
    items: [item],
    shippingAddress: null,
    billingAddress: null,
    subtotalPaise: 2_499_900,
    discountPaise: 0,
    shippingPaise: 0,
    taxPaise: 381_341,
    cgstPaise: 190_670,
    sgstPaise: 190_671,
    igstPaise: 0,
    roundingPaise: 0,
    totalSavingsPaise: 0,
    duePaise: 2_499_900,
    placeOfSupply: 'KA',
    breakdown: {},
    pricingEngineVersion: '1',
    customerNote: null,
    giftMessage: null,
    estimatedDeliveryMinDays: null,
    estimatedDeliveryMaxDays: null,
    confirmedAt: null,
    cancelledAt: null,
    cancelReason: null,
    expiresAt: null,
    version: 4,
  },
  payments: [],
  transfers: [],
  allocations: [],
  reservations: [],
  refunds: [],
  timeline: [],
  integrity: { orderId: 'ord_1', orderNumber: 'CW-1001', ok: true, checks: [] },
};

function render(
  ui: React.ReactElement,
  role: 'ORDER_MANAGER' | 'CONTENT_MANAGER',
  path: string,
  search = '',
) {
  signInAs(account({ role }));
  navigation.reset(path, search);
  return renderWithProviders(<AuthGate>{ui}</AuthGate>);
}

describe('Orders', () => {
  it('lists orders and refuses the screen to roles without order access', async () => {
    server.use(
      http.get(
        `${API}/admin/orders`,
        guarded(() => ok([row], 200, meta(1))),
      ),
    );
    const { unmount } = render(<OrdersScreen />, 'ORDER_MANAGER', '/orders');
    const table = await screen.findByRole('table', { name: 'Orders' });
    expect(within(table).getByRole('link', { name: 'CW-1001' })).toHaveAttribute(
      'href',
      '/orders/view?id=ord_1',
    );
    expect(within(table).getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Online payments are not enabled')).toBeInTheDocument();
    unmount();

    render(<OrdersScreen />, 'CONTENT_MANAGER', '/orders');
    expect(await screen.findByText("You don't have access to orders")).toBeInTheDocument();
  });

  it('shows what the server allows when a status change is refused', async () => {
    server.use(
      http.get(
        `${API}/admin/orders/ord_1`,
        guarded(() => ok(detail)),
      ),
      http.post(
        `${API}/admin/orders/ord_1/status`,
        guarded(
          () =>
            errorBody(409, 'INVALID_ORDER_TRANSITION', 'That step is not allowed', {
              from: 'CONFIRMED',
              to: 'DELIVERED',
              allowed: ['PROCESSING', 'READY_TO_SHIP', 'CANCELLED'],
            }),
          { csrf: true },
        ),
      ),
    );
    const user = userEvent.setup();
    const { container } = render(<OrderViewScreen />, 'ORDER_MANAGER', '/orders/view', 'id=ord_1');

    expect(await screen.findByRole('heading', { name: 'Order CW-1001' })).toBeInTheDocument();
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole('button', { name: 'Change status' }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('New status'), 'DELIVERED');
    await user.click(within(dialog).getByRole('button', { name: 'Change status' }));

    expect(
      await within(dialog).findByText(/can move to: Processing, Ready to ship, Cancelled/),
    ).toBeInTheDocument();
    expect(callsTo(`${V1}/orders/ord_1/status`, 'POST')[0]!.body).toEqual({
      status: 'DELIVERED',
      isCustomerVisible: true,
    });
  });

  it('cancels only after the order number is typed', async () => {
    server.use(
      http.get(
        `${API}/admin/orders/ord_1`,
        guarded(() => ok(detail)),
      ),
      http.post(
        `${API}/admin/orders/ord_1/cancel`,
        guarded(() => ok({ ...detail, status: 'CANCELLED' }), { csrf: true }),
      ),
    );
    const user = userEvent.setup();
    render(<OrderViewScreen />, 'ORDER_MANAGER', '/orders/view', 'id=ord_1');

    await user.click(await screen.findByRole('button', { name: 'Cancel order' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Cancel order' });
    expect(confirm).toBeDisabled();
    await user.selectOptions(within(dialog).getByLabelText('Reason'), 'OUT_OF_STOCK');
    await user.type(within(dialog).getByLabelText(/Type CW-1001 to confirm/), 'CW-1001');
    await user.click(confirm);

    await waitFor(() => expect(callsTo(`${V1}/orders/ord_1/cancel`, 'POST')).toHaveLength(1));
    expect(callsTo(`${V1}/orders/ord_1/cancel`, 'POST')[0]!.body).toEqual({
      reason: 'OUT_OF_STOCK',
    });
  });

  it('creates a manual shipment with an idempotency key and issues the invoice once', async () => {
    const keys: (string | null)[] = [];
    server.use(
      http.get(
        `${API}/admin/orders/ord_1`,
        guarded(() => ok(detail)),
      ),
      http.get(
        `${API}/admin/orders/CW-1001/shipments`,
        guarded(() => ok({ shipments: [] })),
      ),
      http.post(
        `${API}/admin/orders/CW-1001/shipments`,
        guarded(
          (_a, request) => {
            keys.push(request.headers.get('idempotency-key'));
            return ok({ id: 'sh_1', shipmentNumber: 'SH-1' }, 201);
          },
          { csrf: true },
        ),
      ),
      http.get(
        `${API}/admin/orders/CW-1001/documents`,
        guarded(() => ok([])),
      ),
      http.post(
        `${API}/admin/orders/CW-1001/documents/invoice`,
        guarded(
          (_a, request) => {
            keys.push(request.headers.get('idempotency-key'));
            return ok({ type: 'TAX_INVOICE', documentNumber: 'INV/26/0001', issuedAt: '' }, 201);
          },
          { csrf: true },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<OrderViewScreen />, 'ORDER_MANAGER', '/orders/view', 'id=ord_1&tab=fulfilment');

    await user.click(await screen.findByRole('button', { name: 'Ship items' }));
    const dialog = await screen.findByRole('dialog');
    const qty = within(dialog).getByLabelText('Quantity of Oslo sofa to ship');
    await user.clear(qty);
    await user.type(qty, '1');
    await user.click(within(dialog).getByRole('button', { name: 'Create shipment' }));
    await waitFor(() => expect(callsTo(`${V1}/orders/CW-1001/shipments`, 'POST')).toHaveLength(1));
    expect(callsTo(`${V1}/orders/CW-1001/shipments`, 'POST')[0]!.body).toEqual({
      manual: true,
      items: [{ orderItemId: 'oi_1', qty: 1 }],
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: 'Documents' }));
    await user.click(await screen.findByRole('button', { name: 'Issue tax invoice' }));
    await waitFor(() =>
      expect(callsTo(`${V1}/orders/CW-1001/documents/invoice`, 'POST')).toHaveLength(1),
    );
    expect(keys).toHaveLength(2);
    expect(keys.every((k) => typeof k === 'string' && k.length > 10)).toBe(true);
  });
});

describe('Shipments', () => {
  it('records a manual tracking number from the shipment sheet', async () => {
    const shipment = {
      id: 'sh_1',
      shipmentNumber: 'SH-1',
      orderId: 'ord_1',
      orderNumber: 'CW-1001',
      direction: 'FORWARD',
      status: 'DRAFT',
      providerCode: 'MANUAL',
      providerOrderId: null,
      providerShipmentId: null,
      providerCourierId: null,
      providerCourierName: null,
      awbNumber: null,
      providerStatus: null,
      providerStatusCode: null,
      isCod: true,
      codAmountPaise: 2_499_900,
      shippingCostPaise: 0,
      package: {
        weightGrams: 40_000,
        lengthMm: 2_000,
        widthMm: 900,
        heightMm: 800,
        packageCount: 1,
        packagingType: 'BOX',
        declaredValuePaise: 2_499_900,
      },
      pickupLocationCode: null,
      pickupScheduledAt: null,
      pickupTokenNumber: null,
      estimatedDeliveryAt: null,
      shippedAt: null,
      deliveredAt: null,
      cancelledAt: null,
      cancelReason: null,
      labelDocumentId: null,
      manifestDocumentId: null,
      lastSyncedAt: null,
      items: [
        {
          id: 'si_1',
          orderItemId: 'oi_1',
          sku: 'OSLO-3',
          productName: 'Oslo sofa',
          variantName: null,
          qty: 1,
        },
      ],
      events: [],
      version: 1,
      createdAt: '2026-09-25T05:00:00.000Z',
    };
    server.use(
      http.get(
        `${API}/admin/shipments`,
        guarded(() => ok([shipment], 200, meta(1))),
      ),
      http.get(
        `${API}/admin/shipments/SH-1`,
        guarded(() => ok(shipment)),
      ),
      http.post(
        `${API}/admin/shipments/SH-1/awb`,
        guarded(() => ok({ ...shipment, awbNumber: 'DL123456', status: 'AWB_ASSIGNED' }), {
          csrf: true,
        }),
      ),
    );
    const user = userEvent.setup();
    render(<ShipmentsScreen />, 'ORDER_MANAGER', '/orders/shipments', 'n=SH-1');

    const sheet = await screen.findByRole('dialog');
    await user.click(await within(sheet).findByRole('button', { name: 'Add tracking number' }));
    const dialog = await screen.findByRole('dialog', { name: /Tracking number for SH-1/ });
    await user.type(within(dialog).getByLabelText('Courier'), 'Delhivery');
    await user.type(within(dialog).getByLabelText('Tracking (AWB) number'), 'DL123456');
    await user.click(within(dialog).getByRole('button', { name: 'Save tracking number' }));

    await waitFor(() => expect(callsTo(`${V1}/shipments/SH-1/awb`, 'POST')).toHaveLength(1));
    expect(callsTo(`${V1}/shipments/SH-1/awb`, 'POST')[0]!.body).toEqual({
      manualAwb: 'DL123456',
      manualCourierName: 'Delhivery',
    });
  });
});

describe('Reports', () => {
  it('offers only the reports the role may run and shows totals', async () => {
    let asked: URLSearchParams | null = null;
    server.use(
      http.get(
        `${API}/admin/reports`,
        guarded((_a, request) => {
          asked = new URL(request.url).searchParams;
          return asked.get('format') === 'json'
            ? ok({
                kind: 'SALES_SUMMARY',
                rowCount: 3,
                totals: { orders: 3, revenuePaise: 7_500_000 },
              })
            : new HttpResponse('a,b\n1,2\n', { headers: { 'content-type': 'text/csv' } });
        }),
      ),
    );
    const user = userEvent.setup();
    render(<ReportsScreen />, 'ORDER_MANAGER', '/orders/reports');

    const kind = await screen.findByLabelText('Report');
    const labels = within(kind)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(labels).toEqual([
      'Sales summary',
      'GST by HSN code',
      'Top products',
      'Inventory movement',
      'Refunds',
    ]);
    await user.click(screen.getByRole('button', { name: 'Show totals' }));
    const totals = await screen.findByLabelText('Report totals');
    expect(within(totals).getByText(/₹\s?75,000/)).toBeInTheDocument();
    expect(asked!.get('kind')).toBe('SALES_SUMMARY');
    expect(asked!.get('format')).toBe('json');
  });
});
