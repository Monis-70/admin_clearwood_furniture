'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import Link from 'next/link';

import type { NotificationLogDto } from '@shared/types/fulfilment';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { FilterSelect } from '@/components/patterns/data-table/filter-select';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { OnHoldNotice } from '@/components/patterns/on-hold-notice';
import { PageHeader } from '@/components/patterns/page-header';
import { EmptyState, PermissionNotice } from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ordersRoutes } from '@/lib/api/routes/orders';
import { formatDateTime, formatRelative } from '@/lib/format/datetime';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { orderKeys, ordersApi } from './api';
import { viewHref } from './model';

const STATUS_TONE: Record<string, 'success' | 'danger' | 'neutral' | 'info'> = {
  SENT: 'success',
  FAILED: 'danger',
  SKIPPED: 'neutral',
  QUEUED: 'info',
};

const human = (code: string) => code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, ' ');

/** What the store tried to tell customers, and whether it went out. Read-only. */
export function NotificationsScreen() {
  const { canCall } = usePermissions();
  if (!canCall(ordersRoutes.notificationLogs))
    return <PermissionNotice area="the notification log" all={['order.order.read']} />;
  return <Notifications />;
}

function Notifications() {
  const params = useListParams<'channel' | 'status'>({ filters: ['channel', 'status'] });
  const query = {
    page: params.page,
    limit: params.limit,
    ...(params.filters.channel ? { channel: params.filters.channel } : {}),
    ...(params.filters.status ? { status: params.filters.status } : {}),
  };
  const rows = useQuery({
    queryKey: orderKeys.notifications(query),
    queryFn: ({ signal }) => ordersApi.notificationLogs(query, signal),
    ...cachePolicy.list,
  });
  const columns: DataTableColumn<NotificationLogDto>[] = [
    {
      id: 'event',
      meta: { label: 'Message', pinned: true, mobile: 'title' },
      header: 'Message',
      cell: ({ row }) => <span className="font-medium">{human(row.original.event)}</span>,
    },
    {
      id: 'channel',
      meta: { label: 'Channel', mobile: 'detail' },
      header: 'Channel',
      cell: ({ row }) => human(row.original.channel),
    },
    {
      id: 'recipient',
      meta: { label: 'To', mobile: 'detail' },
      header: 'To',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.recipient}</span>,
    },
    {
      id: 'status',
      meta: { label: 'Result', mobile: 'detail' },
      header: 'Result',
      cell: ({ row }) => (
        <span className="flex flex-col">
          <Badge tone={STATUS_TONE[row.original.status] ?? 'neutral'}>
            {human(row.original.status)}
          </Badge>
          {row.original.error ? (
            <span className="text-xs text-destructive">{row.original.error}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'order',
      meta: { label: 'Order', mobile: 'detail' },
      header: 'Order',
      cell: ({ row }) =>
        row.original.orderId ? (
          <Link className="text-primary hover:underline" href={viewHref(row.original.orderId)}>
            Open order
          </Link>
        ) : (
          '—'
        ),
    },
    {
      id: 'createdAt',
      meta: { label: 'When', mobile: 'detail' },
      header: 'When',
      cell: ({ row }) => (
        <time dateTime={row.original.createdAt} title={formatDateTime(row.original.createdAt)}>
          {formatRelative(row.original.createdAt)}
        </time>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title="Notification log"
        description="Order and delivery messages the store sent, or tried to send, to customers."
      />
      <OnHoldNotice domain="email" className="mb-4" />
      <DataTable
        label="Notification log"
        columns={columns}
        query={rows}
        getRowId={(row) => row.id}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="notification-log"
        filtered={params.activeFilterCount > 0}
        toolbar={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <FilterSelect
              label="Channel"
              value={params.filters.channel}
              options={['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP'].map((v) => ({
                value: v,
                label: human(v),
              }))}
              onChange={(v) => params.setFilter('channel', v)}
            />
            <FilterSelect
              label="Result"
              value={params.filters.status}
              options={['QUEUED', 'SENT', 'FAILED', 'SKIPPED'].map((v) => ({
                value: v,
                label: human(v),
              }))}
              onChange={(v) => params.setFilter('status', v)}
            />
          </div>
        }
        empty={<EmptyState icon={Bell} title="Nothing sent yet" />}
        emptyFiltered={
          <EmptyState
            title="No message matches these filters"
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
