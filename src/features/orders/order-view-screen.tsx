'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, FileDown, FileText, PackagePlus, RefreshCw, Workflow } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import type { AdminOrderDetailDto } from '@shared/types/order';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { KeyValueList } from '@/components/patterns/key-value-list';
import { OnHoldNotice } from '@/components/patterns/on-hold-notice';
import { PageHeader } from '@/components/patterns/page-header';
import {
  EmptyState,
  ErrorState,
  PermissionNotice,
  SectionLoader,
} from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EntityHistory } from '@/features/audit/entity-history';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { ordersRoutes } from '@/lib/api/routes/orders';
import { formatDateTime } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';
import { cn } from '@/lib/utils';

import { formatRupees } from '../catalog/model';

import { orderKeys, ordersApi, saveDownload } from './api';
import {
  DOCUMENT_LABELS,
  FULFILMENT_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  SHIPMENT_STATUS,
  viewHref,
} from './model';

const OrderStatusDialog = dynamic(
  () => import('./order-dialogs').then((m) => m.OrderStatusDialog),
  {
    ssr: false,
  },
);
const CancelOrderDialog = dynamic(
  () => import('./order-dialogs').then((m) => m.CancelOrderDialog),
  {
    ssr: false,
  },
);
const CreateShipmentDialog = dynamic(
  () => import('./order-dialogs').then((m) => m.CreateShipmentDialog),
  { ssr: false },
);

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'fulfilment', label: 'Shipping' },
  { id: 'documents', label: 'Documents' },
  { id: 'history', label: 'History' },
  { id: 'integrity', label: 'Money check' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function OrderViewScreen() {
  const { canCall } = usePermissions();
  const id = useSearchParams().get('id');
  if (!canCall(ordersRoutes.get))
    return <PermissionNotice area="orders" all={['order.order.read']} />;
  if (!id)
    return (
      <EmptyState
        title="No order chosen"
        action={
          <Button asChild variant="outline">
            <Link href="/orders">Back to orders</Link>
          </Button>
        }
      />
    );
  return <OrderView id={id} />;
}

function OrderView({ id }: { id: string }) {
  const { canCall } = usePermissions();
  const router = useRouter();
  const queryClient = useQueryClient();
  const tabParam = useSearchParams().get('tab');
  const tab = (TABS.find((t) => t.id === tabParam)?.id ?? 'overview') as Tab;
  const [dialog, setDialog] = useState<'status' | 'cancel' | 'ship' | null>(null);
  const order = useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: ({ signal }) => ordersApi.get(id, signal),
    ...cachePolicy.detail,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: orderKeys.all });

  if (order.isPending) return <SectionLoader label="Loading order…" />;
  if (order.error) return <ErrorState error={order.error} onRetry={() => void order.refetch()} />;
  const o = order.data;

  return (
    <>
      <Link
        href="/orders"
        className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Orders
      </Link>
      <PageHeader
        title={`Order ${o.orderNumber}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={o.status} registry={ORDER_STATUS} />
            <StatusBadge status={o.paymentStatus} registry={PAYMENT_STATUS} />
            <span>{FULFILMENT_STATUS[o.fulfillmentStatus] ?? o.fulfillmentStatus}</span>
            <span>Placed {formatDateTime(o.placedAt ?? o.createdAt)}</span>
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canCall(ordersRoutes.setStatus) ? (
              <Button variant="outline" onClick={() => setDialog('status')}>
                <Workflow aria-hidden />
                Change status
              </Button>
            ) : null}
            {canCall(ordersRoutes.createShipment) ? (
              <Button variant="outline" onClick={() => setDialog('ship')}>
                <PackagePlus aria-hidden />
                Ship items
              </Button>
            ) : null}
            {canCall(ordersRoutes.cancel) ? (
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() => setDialog('cancel')}
              >
                <Ban aria-hidden />
                Cancel order
              </Button>
            ) : null}
          </div>
        }
      />
      <div role="tablist" aria-label="Order" className="mb-4 flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm',
              tab === t.id
                ? 'border-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            onClick={() =>
              router.replace(viewHref(id, t.id === 'overview' ? undefined : t.id), {
                scroll: false,
              })
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>
        {tab === 'overview' ? <Overview order={o} /> : null}
        {tab === 'fulfilment' ? <Fulfilment order={o} onShip={() => setDialog('ship')} /> : null}
        {tab === 'documents' ? <Documents order={o} /> : null}
        {tab === 'history' ? <History order={o} /> : null}
        {tab === 'integrity' ? <Integrity order={o} /> : null}
      </div>
      {dialog === 'status' ? (
        <OrderStatusDialog
          order={o}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      ) : null}
      {dialog === 'cancel' ? (
        <CancelOrderDialog
          order={o}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      ) : null}
      {dialog === 'ship' ? (
        <CreateShipmentDialog
          order={o}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
            router.replace(viewHref(id, 'fulfilment'), { scroll: false });
          }}
        />
      ) : null}
    </>
  );
}

function Overview({ order }: { order: AdminOrderDetailDto }) {
  const o = order.order;
  const address = o.shippingAddress;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section aria-labelledby="order-items" className="flex flex-col gap-3 lg:col-span-2">
        <h2 id="order-items" className="text-base font-semibold">
          Items
        </h2>
        <table className="w-full text-sm">
          <caption className="sr-only">Items in this order</caption>
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-medium">Item</th>
              <th className="py-1 text-right font-medium">Qty</th>
              <th className="py-1 text-right font-medium">Shipped</th>
              <th className="py-1 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((item) => (
              <tr key={item.id} className="border-t align-top">
                <td className="py-1.5">
                  <span className="block font-medium">{item.productName}</span>
                  <span className="text-xs text-muted-foreground">
                    {[item.variantName, item.sku, item.hsnCode ? `HSN ${item.hsnCode}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                    {item.isMadeToOrder ? ' · made to order' : ''}
                  </span>
                </td>
                <td className="tabular py-1.5 text-right">{item.qty}</td>
                <td className="tabular py-1.5 text-right">
                  {item.fulfilledQty}
                  {item.cancelledQty ? ` (${item.cancelledQty} cancelled)` : ''}
                </td>
                <td className="tabular py-1.5 text-right">{formatRupees(item.lineTotalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <KeyValueList
          items={[
            { label: 'Subtotal', value: formatRupees(o.subtotalPaise) },
            { label: 'Discounts', value: formatRupees(o.discountPaise) },
            { label: 'Delivery', value: formatRupees(o.shippingPaise) },
            {
              label: 'GST',
              value: `${formatRupees(o.taxPaise)} (CGST ${formatRupees(o.cgstPaise)}, SGST ${formatRupees(o.sgstPaise)}, IGST ${formatRupees(o.igstPaise)})`,
            },
            { label: 'Grand total', value: formatRupees(o.grandTotalPaise) },
            { label: 'Paid', value: formatRupees(o.paidPaise) },
            { label: 'Due', value: formatRupees(o.duePaise) },
            ...(o.refundedPaise
              ? [{ label: 'Refunded', value: formatRupees(o.refundedPaise) }]
              : []),
            ...(o.couponCode ? [{ label: 'Coupon', value: o.couponCode }] : []),
          ]}
        />
        <p className="text-xs text-muted-foreground">
          Figures are the order&apos;s own record from the pricing engine at checkout; the admin
          does not recalculate them.
        </p>
      </section>
      <aside className="flex flex-col gap-4">
        <section
          aria-labelledby="order-customer"
          className="flex flex-col gap-2 rounded-lg border p-4"
        >
          <h2 id="order-customer" className="text-sm font-semibold">
            Customer
          </h2>
          <p className="text-sm">
            {order.customerName ?? (o.isGuest ? 'Guest checkout' : '—')}
            <span className="block text-muted-foreground">{o.contactEmail ?? ''}</span>
            <span className="block text-muted-foreground">{o.contactPhone ?? ''}</span>
          </p>
          {o.customerNote ? (
            <p className="rounded-md bg-muted/50 p-2 text-sm whitespace-pre-wrap">
              {o.customerNote}
            </p>
          ) : null}
        </section>
        {address ? (
          <section
            aria-labelledby="order-address"
            className="flex flex-col gap-1 rounded-lg border p-4 text-sm"
          >
            <h2 id="order-address" className="text-sm font-semibold">
              Delivery address
            </h2>
            <p>{address.fullName}</p>
            <p>{[address.line1, address.line2, address.landmark].filter(Boolean).join(', ')}</p>
            <p>
              {address.city}, {address.state} {address.pincode}
            </p>
            <p className="text-muted-foreground">{address.phone}</p>
            {address.deliveryInstructions ? (
              <p className="text-muted-foreground">{address.deliveryInstructions}</p>
            ) : null}
          </section>
        ) : null}
        <section
          aria-labelledby="order-payments"
          className="flex flex-col gap-2 rounded-lg border p-4 text-sm"
        >
          <h2 id="order-payments" className="text-sm font-semibold">
            Payments
          </h2>
          {order.payments.length === 0 ? (
            <p className="text-muted-foreground">
              No payment recorded (cash on delivery is collected by the courier).
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {order.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={p.status} registry={PAYMENT_STATUS} />
                  <span className="tabular">{formatRupees(p.amountPaise)}</span>
                  <span className="text-muted-foreground">{p.method ?? p.provider}</span>
                </li>
              ))}
            </ul>
          )}
          {order.refunds.length > 0 ? (
            <>
              <h3 className="pt-2 text-sm font-semibold">Refund requests</h3>
              <ul className="flex flex-col gap-1">
                {order.refunds.map((r) => (
                  <li key={r.id} className="flex flex-wrap gap-2">
                    <Badge tone="neutral">{r.status.toLowerCase()}</Badge>
                    <span className="tabular">{formatRupees(r.amountPaise)}</span>
                    <span className="text-muted-foreground">{r.refundNumber}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <OnHoldNotice domain="refunds" className="mt-2" />
        </section>
      </aside>
    </div>
  );
}

function Fulfilment({ order, onShip }: { order: AdminOrderDetailDto; onShip(): void }) {
  const { canCall } = usePermissions();
  const shipments = useQuery({
    queryKey: orderKeys.shipmentsFor(order.orderNumber),
    queryFn: ({ signal }) => ordersApi.shipmentsFor(order.orderNumber, signal),
    ...cachePolicy.detail,
  });
  return (
    <section aria-label="Shipping" className="flex flex-col gap-3">
      <OnHoldNotice domain="shipping" />
      {shipments.isPending ? (
        <SectionLoader label="Loading shipments…" />
      ) : shipments.error ? (
        <ErrorState error={shipments.error} onRetry={() => void shipments.refetch()} compact />
      ) : shipments.data.shipments.length === 0 ? (
        <EmptyState
          title="Nothing shipped yet"
          action={
            canCall(ordersRoutes.createShipment) ? (
              <Button onClick={onShip}>
                <PackagePlus aria-hidden />
                Ship items
              </Button>
            ) : undefined
          }
          compact
        />
      ) : (
        <ul className="flex flex-col divide-y rounded-md border" aria-label="Shipments">
          {shipments.data.shipments.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <Link
                href={`/orders/shipments?n=${encodeURIComponent(s.shipmentNumber)}`}
                className="font-medium hover:underline"
              >
                {s.shipmentNumber}
              </Link>
              <StatusBadge status={s.status} registry={SHIPMENT_STATUS} />
              <span className="text-muted-foreground">
                {s.items.reduce((n, i) => n + i.qty, 0)} items
                {s.awbNumber
                  ? ` · ${s.providerCourierName ?? 'Courier'} ${s.awbNumber}`
                  : ' · no tracking number yet'}
              </span>
              <span className="ml-auto text-muted-foreground">{formatDateTime(s.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Documents({ order }: { order: AdminOrderDetailDto }) {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const keyFor = useIdempotencyKey();
  const [downloadError, setDownloadError] = useState<unknown>(null);
  const docs = useQuery({
    queryKey: orderKeys.documents(order.orderNumber),
    queryFn: ({ signal }) => ordersApi.documents(order.orderNumber, signal),
    ...cachePolicy.detail,
  });
  const issue = useMutation({
    mutationFn: () =>
      ordersApi.issueInvoice(order.orderNumber, keyFor({ invoice: order.orderNumber })),
    onSuccess: (doc) => {
      notifySuccess(`Invoice ${doc.documentNumber} issued`);
      void queryClient.invalidateQueries({ queryKey: orderKeys.documents(order.orderNumber) });
    },
  });
  const hasInvoice = docs.data?.some((d) => d.type === 'TAX_INVOICE') ?? false;
  return (
    <section aria-label="Documents" className="flex flex-col gap-3">
      <FormAlert error={issue.error ?? downloadError} />
      {canCall(ordersRoutes.issueInvoice) && !hasInvoice ? (
        <Alert tone="info" title="Tax invoice">
          <p>
            A GST invoice is issued once per order with a permanent number; corrections are made
            with a credit note, never by replacing it.
          </p>
          <Button className="mt-2" onClick={() => issue.mutate()} loading={issue.isPending}>
            <FileText aria-hidden />
            Issue tax invoice
          </Button>
        </Alert>
      ) : null}
      {docs.isPending ? (
        <SectionLoader label="Loading documents…" />
      ) : docs.error ? (
        <ErrorState error={docs.error} onRetry={() => void docs.refetch()} compact />
      ) : docs.data.length === 0 ? (
        <EmptyState title="No documents yet" compact />
      ) : (
        <ul className="flex flex-col divide-y rounded-md border" aria-label="Order documents">
          {docs.data.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <span className="font-medium">{DOCUMENT_LABELS[d.type] ?? d.type}</span>
              <span className="font-mono text-xs">{d.documentNumber ?? '—'}</span>
              <span className="text-muted-foreground">{formatDateTime(d.issuedAt)}</span>
              {d.documentNumber ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => {
                    setDownloadError(null);
                    saveDownload(
                      ordersApi.download(d.documentNumber!),
                      `${d.documentNumber}.pdf`,
                    ).catch(setDownloadError);
                  }}
                >
                  <FileDown aria-hidden />
                  Download<span className="sr-only"> {d.documentNumber}</span>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function History({ order }: { order: AdminOrderDetailDto }) {
  const entries = [...order.timeline].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="order-timeline" className="flex flex-col gap-2">
        <h2 id="order-timeline" className="text-sm font-semibold">
          Status history
        </h2>
        <Timeline entries={entries} />
      </section>
      <section aria-labelledby="order-audit" className="flex flex-col gap-2">
        <h2 id="order-audit" className="text-sm font-semibold">
          Admin actions
        </h2>
        <EntityHistory entity="Order" entityId={order.id} />
      </section>
    </div>
  );
}

function Timeline({ entries }: { entries: AdminOrderDetailDto['timeline'] }) {
  if (entries.length === 0) return <EmptyState title="No history yet" compact />;
  return (
    <ol className="flex flex-col divide-y rounded-md border" aria-label="Order history">
      {entries.map((t) => (
        <li key={t.id} className="flex flex-col gap-0.5 px-4 py-2 text-sm">
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={t.toStatus} registry={ORDER_STATUS} />
            <span className="text-muted-foreground">{formatDateTime(t.createdAt)}</span>
            <span className="text-muted-foreground">
              by {t.actorName ?? t.actorType.toLowerCase()}
            </span>
            {t.isCustomerVisible ? null : <Badge tone="outline">Staff only</Badge>}
          </span>
          {t.note ? <span className="whitespace-pre-wrap">{t.note}</span> : null}
        </li>
      ))}
    </ol>
  );
}

function Integrity({ order }: { order: AdminOrderDetailDto }) {
  const check = useQuery({
    queryKey: orderKeys.ledger(order.id),
    queryFn: ({ signal }) => ordersApi.ledgerCheck(order.id, signal),
    initialData: order.integrity,
    ...cachePolicy.diagnostic,
  });
  const data = check.data ?? order.integrity;
  return (
    <section aria-label="Money check" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          The server compares the order&apos;s totals with its payments, refunds and payouts.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void check.refetch()}
          loading={check.isFetching}
        >
          <RefreshCw aria-hidden />
          Check again
        </Button>
      </div>
      <Alert
        tone={data.ok ? 'success' : 'danger'}
        title={data.ok ? 'Everything adds up' : 'Something does not add up'}
      >
        <ul className="mt-1 flex flex-col gap-0.5">
          {data.checks.map((c) => (
            <li key={c.name}>
              {c.ok ? '✓' : '✗'} {c.message} (expected {formatRupees(c.expected)}, found{' '}
              {formatRupees(c.actual)})
            </li>
          ))}
        </ul>
      </Alert>
    </section>
  );
}
