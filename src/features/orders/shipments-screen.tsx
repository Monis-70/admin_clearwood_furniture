'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import type { NdrRecordDto, ShipmentDto } from '@shared/types/fulfilment';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { FilterSelect } from '@/components/patterns/data-table/filter-select';
import { SearchInput } from '@/components/patterns/data-table/search-input';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { shipmentsRoutes } from '@/lib/api/routes/shipments';
import { formatDateTime, formatRelative } from '@/lib/format/datetime';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';
import { cn } from '@/lib/utils';

import { orderKeys, shipmentsApi, type ShipmentListQuery } from './api';
import { SHIPMENT_STATUS, viewHref } from './model';

const AwbDialog = dynamic(() => import('./shipment-dialogs').then((m) => m.AwbDialog), {
  ssr: false,
});
const ShipmentStatusDialog = dynamic(
  () => import('./shipment-dialogs').then((m) => m.ShipmentStatusDialog),
  { ssr: false },
);
const CancelShipmentDialog = dynamic(
  () => import('./shipment-dialogs').then((m) => m.CancelShipmentDialog),
  { ssr: false },
);
const NdrActionDialog = dynamic(() => import('./shipment-dialogs').then((m) => m.NdrActionDialog), {
  ssr: false,
});
const EntityHistory = dynamic(
  () => import('@/features/audit/entity-history').then((m) => m.EntityHistory),
  { ssr: false },
);

const HREF = '/orders/shipments';

export function ShipmentsScreen() {
  const { canCall } = usePermissions();
  const router = useRouter();
  const search = useSearchParams();
  const tab = search.get('tab') === 'ndr' ? 'ndr' : 'shipments';
  if (!canCall(shipmentsRoutes.list))
    return <PermissionNotice area="shipments" all={['order.order.read']} />;
  return (
    <>
      <PageHeader
        title="Shipments"
        description="Every parcel sent to a customer, its tracking number and where it is. Delivery problems are listed separately."
      />
      <OnHoldNotice domain="shipping" className="mb-4" />
      <div role="tablist" aria-label="Shipments" className="mb-4 flex gap-1 border-b">
        {(
          [
            ['shipments', 'Shipments'],
            ['ndr', 'Delivery problems'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm',
              tab === id
                ? 'border-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            onClick={() =>
              router.replace(id === 'ndr' ? `${HREF}?tab=ndr` : HREF, { scroll: false })
            }
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'shipments' ? <Shipments /> : <Ndr />}
    </>
  );
}

function Shipments() {
  const params = useListParams<'status' | 'n'>({
    filters: ['status', 'n'],
    defaultSort: 'createdAt',
  });
  const query: ShipmentListQuery = {
    page: params.page,
    limit: params.limit,
    sort: params.sort,
    order: params.order,
    ...(params.q ? { q: params.q } : {}),
    ...(params.filters.status ? { status: params.filters.status } : {}),
  };
  const rows = useQuery({
    queryKey: orderKeys.shipments(query),
    queryFn: ({ signal }) => shipmentsApi.list(query, signal),
    ...cachePolicy.list,
  });
  const columns: DataTableColumn<ShipmentDto>[] = [
    {
      id: 'shipmentNumber',
      meta: { label: 'Shipment', pinned: true, mobile: 'title' },
      header: 'Shipment',
      cell: ({ row }) => (
        <button
          type="button"
          className="flex flex-col items-start text-left"
          onClick={() => params.setFilter('n', row.original.shipmentNumber)}
        >
          <span className="font-medium hover:underline">{row.original.shipmentNumber}</span>
          <span className="text-xs text-muted-foreground">Order {row.original.orderNumber}</span>
        </button>
      ),
    },
    {
      id: 'status',
      meta: { label: 'Status', mobile: 'detail' },
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} registry={SHIPMENT_STATUS} />,
    },
    {
      id: 'tracking',
      meta: { label: 'Tracking', mobile: 'detail' },
      header: 'Tracking',
      cell: ({ row }) =>
        row.original.awbNumber ? (
          <span>
            {row.original.providerCourierName ?? row.original.providerCode}{' '}
            <span className="font-mono text-xs">{row.original.awbNumber}</span>
          </span>
        ) : (
          <Badge tone="warning">No tracking number</Badge>
        ),
    },
    {
      id: 'createdAt',
      meta: { label: 'Created', sortKey: 'createdAt', mobile: 'detail' },
      header: 'Created',
      cell: ({ row }) => formatRelative(row.original.createdAt),
    },
  ];
  return (
    <>
      <DataTable
        label="Shipments"
        columns={columns}
        query={rows}
        getRowId={(row) => row.id}
        sort={{ field: params.sort, order: params.order, onChange: params.setSort }}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="shipments"
        filtered={Boolean(params.q || params.filters.status)}
        toolbar={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput
              value={params.q}
              onSearch={params.setSearch}
              label="Search shipment, order or tracking number"
              minLength={2}
            />
            <FilterSelect
              label="Status"
              value={params.filters.status}
              options={Object.entries(SHIPMENT_STATUS).map(([value, d]) => ({
                value,
                label: d.label,
              }))}
              onChange={(v) => params.setFilter('status', v)}
            />
          </div>
        }
        empty={
          <EmptyState
            icon={Truck}
            title="No shipments yet"
            description="Create one from an order's Shipping tab."
          />
        }
        emptyFiltered={
          <EmptyState
            title="No shipment matches these filters"
            action={
              <Button variant="outline" onClick={params.clearAll}>
                Clear filters
              </Button>
            }
          />
        }
      />
      {params.filters.n ? (
        <ShipmentSheet
          shipmentNumber={params.filters.n}
          onClose={() => params.setFilter('n', null)}
        />
      ) : null}
    </>
  );
}

function ShipmentSheet({ shipmentNumber, onClose }: { shipmentNumber: string; onClose(): void }) {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<'awb' | 'status' | 'cancel' | null>(null);
  const shipment = useQuery({
    queryKey: orderKeys.shipment(shipmentNumber),
    queryFn: ({ signal }) => shipmentsApi.get(shipmentNumber, signal),
    ...cachePolicy.detail,
  });
  const done = () => {
    setDialog(null);
    void queryClient.invalidateQueries({ queryKey: orderKeys.all });
  };
  const s = shipment.data;
  const canFulfil = canCall(shipmentsRoutes.setStatus);
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        {!s ? (
          <div className="p-4">
            <SheetTitle className="sr-only">Shipment</SheetTitle>
            <SheetDescription className="sr-only">One shipment</SheetDescription>
            {shipment.isPending ? (
              <SectionLoader label="Loading shipment…" />
            ) : (
              <ErrorState error={shipment.error} onRetry={() => void shipment.refetch()} compact />
            )}
          </div>
        ) : (
          <>
            <SheetHeader className="border-b">
              <SheetTitle className="flex flex-wrap items-center gap-2">
                {s.shipmentNumber}
                <StatusBadge status={s.status} registry={SHIPMENT_STATUS} />
              </SheetTitle>
              <SheetDescription>
                For order{' '}
                <Link className="underline" href={viewHref(s.orderId, 'fulfilment')}>
                  {s.orderNumber}
                </Link>{' '}
                · created {formatDateTime(s.createdAt)}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 p-4">
              {canFulfil ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setDialog('awb')}>
                    {s.awbNumber ? 'Change tracking number' : 'Add tracking number'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDialog('status')}>
                    Update status
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setDialog('cancel')}
                  >
                    Cancel shipment
                  </Button>
                </div>
              ) : null}
              <KeyValueList
                items={[
                  {
                    label: 'Courier',
                    value:
                      s.providerCourierName ??
                      (s.providerCode === 'MANUAL' ? 'Manual' : s.providerCode),
                  },
                  { label: 'Tracking number', value: s.awbNumber ?? '—' },
                  { label: 'Cash on delivery', value: s.isCod ? 'Yes' : 'No' },
                  { label: 'Boxes', value: s.package.packageCount },
                  { label: 'Weight', value: `${s.package.weightGrams} g` },
                  ...(s.deliveredAt
                    ? [{ label: 'Delivered', value: formatDateTime(s.deliveredAt) }]
                    : []),
                  ...(s.cancelReason
                    ? [{ label: 'Cancelled because', value: s.cancelReason }]
                    : []),
                ]}
              />
              <section aria-labelledby="shipment-items" className="flex flex-col gap-1">
                <h3 id="shipment-items" className="text-sm font-semibold">
                  Items
                </h3>
                <ul className="text-sm">
                  {s.items.map((i) => (
                    <li key={i.id}>
                      {i.qty} × {i.productName}
                      {i.variantName ? ` (${i.variantName})` : ''}{' '}
                      <span className="text-xs text-muted-foreground">{i.sku}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section aria-labelledby="shipment-events" className="flex flex-col gap-1">
                <h3 id="shipment-events" className="text-sm font-semibold">
                  Tracking history
                </h3>
                {s.events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No updates yet.</p>
                ) : (
                  <ol className="flex flex-col gap-1 text-sm">
                    {[...s.events].reverse().map((ev) => (
                      <li key={ev.id}>
                        <span className="text-muted-foreground">
                          {formatDateTime(ev.occurredAt)}
                        </span>{' '}
                        {ev.description}
                        {ev.location ? ` · ${ev.location}` : ''}
                        {ev.isCustomerVisible ? '' : ' (staff only)'}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
              <details>
                <summary className="cursor-pointer text-sm font-semibold">Admin actions</summary>
                <div className="mt-2">
                  <EntityHistory entity="Shipment" entityId={s.id} />
                </div>
              </details>
            </div>
            {dialog === 'awb' ? (
              <AwbDialog shipment={s} onClose={() => setDialog(null)} onDone={done} />
            ) : null}
            {dialog === 'status' ? (
              <ShipmentStatusDialog shipment={s} onClose={() => setDialog(null)} onDone={done} />
            ) : null}
            {dialog === 'cancel' ? (
              <CancelShipmentDialog shipment={s} onClose={() => setDialog(null)} onDone={done} />
            ) : null}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Ndr() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const [acting, setActing] = useState<NdrRecordDto | null>(null);
  const [status, setStatus] = useState<string | undefined>('OPEN');
  const query = { page: 1, limit: 50, ...(status ? { status } : {}) };
  const rows = useQuery({
    queryKey: orderKeys.ndr(query),
    queryFn: ({ signal }) => shipmentsApi.ndr(query, signal),
    ...cachePolicy.list,
  });
  return (
    <section aria-label="Delivery problems" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <FilterSelect
          label="Status"
          value={status}
          options={[
            { value: 'OPEN', label: 'Open' },
            { value: 'ACTION_REQUESTED', label: 'Action requested' },
            { value: 'RESOLVED', label: 'Resolved' },
            { value: 'RTO', label: 'Returning' },
            { value: 'CLOSED', label: 'Closed' },
          ]}
          onChange={(v) => setStatus(v ?? undefined)}
        />
      </div>
      {rows.isPending ? (
        <SectionLoader label="Loading delivery problems…" />
      ) : rows.error ? (
        <ErrorState error={rows.error} onRetry={() => void rows.refetch()} compact />
      ) : rows.data.items.length === 0 ? (
        <EmptyState
          title="No delivery problems"
          description="Failed delivery attempts reported by couriers appear here."
          compact
        />
      ) : (
        <ul className="flex flex-col divide-y rounded-md border" aria-label="Delivery problems">
          {rows.data.items.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <span className="font-medium">{n.shipmentNumber}</span>
              <span>{n.reason}</span>
              <span className="text-muted-foreground">
                attempt {n.attemptCount} · {formatRelative(n.raisedAt)}
              </span>
              {n.actionTaken ? (
                <Badge tone="neutral">{n.actionTaken.replace(/_/g, ' ').toLowerCase()}</Badge>
              ) : null}
              {canCall(shipmentsRoutes.ndrAction) ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => setActing(n)}
                >
                  Decide<span className="sr-only"> for {n.shipmentNumber}</span>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {acting ? (
        <NdrActionDialog
          ndr={acting}
          onClose={() => setActing(null)}
          onDone={() => {
            setActing(null);
            void queryClient.invalidateQueries({ queryKey: [...orderKeys.all, 'ndr'] });
          }}
        />
      ) : null}
    </section>
  );
}
