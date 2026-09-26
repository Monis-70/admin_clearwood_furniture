'use client';

import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import Link from 'next/link';

import type { AdminOrderRowDto } from '@shared/types/order';

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
import { ordersRoutes } from '@/lib/api/routes/orders';
import { formatDateTime, formatRelative } from '@/lib/format/datetime';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { formatRupees } from '../catalog/model';

import { orderKeys, ordersApi, type OrderListQuery } from './api';
import { FULFILMENT_STATUS, ORDER_STATUS, PAYMENT_STATUS, viewHref } from './model';

export function OrdersScreen() {
  const { canCall } = usePermissions();
  if (!canCall(ordersRoutes.list))
    return <PermissionNotice area="orders" all={['order.order.read']} />;
  return <Orders />;
}

function Orders() {
  const params = useListParams<'status' | 'paymentStatus'>({
    filters: ['status', 'paymentStatus'],
    defaultSort: 'createdAt',
  });
  const query: OrderListQuery = {
    page: params.page,
    limit: params.limit,
    sort: params.sort,
    order: params.order,
    ...(params.q ? { q: params.q } : {}),
    ...(params.filters.status ? { status: params.filters.status } : {}),
    ...(params.filters.paymentStatus ? { paymentStatus: params.filters.paymentStatus } : {}),
  };
  const rows = useQuery({
    queryKey: orderKeys.list(query),
    queryFn: ({ signal }) => ordersApi.list(query, signal),
    ...cachePolicy.list,
  });

  const columns: DataTableColumn<AdminOrderRowDto>[] = [
    {
      id: 'orderNumber',
      meta: { label: 'Order', pinned: true, mobile: 'title' },
      header: 'Order',
      cell: ({ row }) => (
        <span className="flex flex-col">
          <Link href={viewHref(row.original.id)} className="font-medium hover:underline">
            {row.original.orderNumber}
          </Link>
          <span className="text-xs text-muted-foreground">
            {row.original.customerName ?? (row.original.isGuest ? 'Guest' : '—')}
          </span>
        </span>
      ),
    },
    {
      id: 'status',
      meta: { label: 'Status', mobile: 'detail' },
      header: 'Status',
      cell: ({ row }) => (
        <span className="flex flex-wrap gap-1">
          <StatusBadge status={row.original.status} registry={ORDER_STATUS} />
          <StatusBadge status={row.original.paymentStatus} registry={PAYMENT_STATUS} />
        </span>
      ),
    },
    {
      id: 'fulfilment',
      meta: { label: 'Shipping', mobile: 'detail' },
      header: 'Shipping',
      cell: ({ row }) =>
        FULFILMENT_STATUS[row.original.fulfillmentStatus] ?? row.original.fulfillmentStatus,
    },
    {
      id: 'total',
      meta: { label: 'Total', mobile: 'detail', align: 'right' },
      header: 'Total',
      cell: ({ row }) => (
        <span className="tabular">
          {formatRupees(row.original.grandTotalPaise)}
          {row.original.refundedPaise > 0 ? (
            <span className="block text-xs text-muted-foreground">
              {formatRupees(row.original.refundedPaise)} refunded
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'placedAt',
      meta: { label: 'Placed', sortKey: 'createdAt', mobile: 'detail' },
      header: 'Placed',
      cell: ({ row }) => {
        const at = row.original.placedAt ?? row.original.createdAt;
        return (
          <time dateTime={at} title={formatDateTime(at)}>
            {formatRelative(at)}
          </time>
        );
      },
    },
    {
      id: 'flags',
      meta: { label: 'Notes', mobile: 'hidden' },
      header: 'Notes',
      cell: ({ row }) => (
        <span className="flex flex-wrap gap-1">
          {row.original.couponCode ? <Badge tone="outline">{row.original.couponCode}</Badge> : null}
          {row.original.hasFailedTransfer ? <Badge tone="danger">Payout failed</Badge> : null}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Orders"
        description="Every order placed on the storefront. Open one to confirm it, move it along, ship it or cancel it."
      />
      <OnHoldNotice domain="payments" className="mb-4" />
      <DataTable
        label="Orders"
        columns={columns}
        query={rows}
        getRowId={(row) => row.id}
        sort={{ field: params.sort, order: params.order, onChange: params.setSort }}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="orders"
        filtered={params.activeFilterCount > 0}
        toolbar={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput
              value={params.q}
              onSearch={params.setSearch}
              label="Search order number, name or email"
              placeholder="Order number, name or email"
              minLength={2}
            />
            <FilterSelect
              label="Status"
              value={params.filters.status}
              options={Object.entries(ORDER_STATUS).map(([value, d]) => ({
                value,
                label: d.label,
              }))}
              onChange={(v) => params.setFilter('status', v)}
            />
            <FilterSelect
              label="Payment"
              value={params.filters.paymentStatus}
              options={Object.entries(PAYMENT_STATUS).map(([value, d]) => ({
                value,
                label: d.label,
              }))}
              onChange={(v) => params.setFilter('paymentStatus', v)}
            />
          </div>
        }
        empty={
          <EmptyState
            icon={ClipboardList}
            title="No orders yet"
            description="Orders appear here as soon as a customer checks out."
          />
        }
        emptyFiltered={
          <EmptyState
            title="No order matches these filters"
            action={
              <Button variant="outline" onClick={params.clearAll}>
                Clear filters
              </Button>
            }
          />
        }
      />
    </>
  );
}
