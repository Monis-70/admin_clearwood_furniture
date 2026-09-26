'use client';

import { useQuery } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';

import type { ShipmentDto } from '@shared/types/fulfilment';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { FilterSelect } from '@/components/patterns/data-table/filter-select';
import { SearchInput } from '@/components/patterns/data-table/search-input';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { OnHoldNotice } from '@/components/patterns/on-hold-notice';
import { PageHeader } from '@/components/patterns/page-header';
import { EmptyState, PermissionNotice } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { shipmentsRoutes } from '@/lib/api/routes/shipments';
import { formatRelative } from '@/lib/format/datetime';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';
import { cn } from '@/lib/utils';

import { orderKeys, shipmentsApi, type ShipmentListQuery } from './api';
import { SHIPMENT_STATUS } from './model';

const ShipmentSheet = dynamic(() => import('./shipment-panels').then((m) => m.ShipmentSheet), {
  ssr: false,
});
const Ndr = dynamic(() => import('./shipment-panels').then((m) => m.Ndr), { ssr: false });

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
