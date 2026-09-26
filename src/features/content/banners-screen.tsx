'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpDown, PanelTop, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { FilterSelect } from '@/components/patterns/data-table/filter-select';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { PageHeader } from '@/components/patterns/page-header';
import { EmptyState, PermissionNotice } from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { contentRoutes } from '@/lib/api/routes/content';
import { formatDate } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { contentApi, contentKeys, type BannerListQuery, type BannerRow } from './api';
import { RowActions } from './kit';
import { DEVICE_LABELS, PLACEMENT_LABELS, options, windowLabel } from './model';

const OrderDialog = dynamic(() => import('./banner-panels').then((m) => m.OrderDialog), {
  ssr: false,
});
const StatsDialog = dynamic(() => import('./banner-panels').then((m) => m.StatsDialog), {
  ssr: false,
});

const BannerDialog = dynamic(() => import('./dialogs/banner-dialog').then((m) => m.BannerDialog), {
  ssr: false,
});

const e = contentRoutes;
const HREF = '/content/banners';

export function BannersScreen() {
  const { canCall } = usePermissions();
  if (!canCall(e.banners)) return <PermissionNotice area="banners" all={['cms.banner.read']} />;
  return <BannersList />;
}

function BannersList() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const router = useRouter();
  const statsId = useSearchParams().get('id');
  const params = useListParams<'placement' | 'isActive'>({ filters: ['placement', 'isActive'] });
  const [editing, setEditing] = useState<BannerRow | 'new' | null>(null);
  const [removing, setRemoving] = useState<BannerRow | null>(null);
  const [ordering, setOrdering] = useState(false);
  const query: BannerListQuery = {
    page: params.page,
    limit: params.limit,
    sort: params.sort,
    order: params.order,
    placement: params.filters.placement,
    isActive: params.filters.isActive,
  };
  const rows = useQuery({
    queryKey: contentKeys.banners(query),
    queryFn: ({ signal }) => contentApi.banners(query, signal),
    ...cachePolicy.list,
  });
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: [...contentKeys.all, 'banners'] });
  const showStats = (id: string | null) =>
    router.replace(id ? `${HREF}?id=${encodeURIComponent(id)}` : HREF, { scroll: false });

  const columns: DataTableColumn<BannerRow>[] = [
    {
      id: 'name',
      meta: { label: 'Banner', pinned: true, mobile: 'title' },
      header: 'Banner',
      cell: ({ row }) => (
        <span className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          {row.original.headline ? (
            <span className="text-xs text-muted-foreground">{row.original.headline}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'placement',
      meta: { label: 'Where', mobile: 'detail' },
      header: 'Where',
      cell: ({ row }) => PLACEMENT_LABELS[row.original.placement] ?? row.original.placement,
    },
    {
      id: 'status',
      meta: { label: 'Status', mobile: 'detail' },
      header: 'Status',
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge tone="success">On</Badge>
        ) : (
          <Badge tone="neutral">Off</Badge>
        ),
    },
    {
      id: 'schedule',
      meta: { label: 'Shown', mobile: 'detail' },
      header: 'Shown',
      cell: ({ row }) => windowLabel(row.original.startsAt, row.original.endsAt, formatDate),
    },
    {
      id: 'devices',
      meta: { label: 'Devices', mobile: 'hidden' },
      header: 'Devices',
      cell: ({ row }) =>
        DEVICE_LABELS[row.original.deviceVisibility] ?? row.original.deviceVisibility,
    },
    {
      id: 'position',
      meta: { label: 'Order', mobile: 'hidden', align: 'right' },
      header: 'Order',
      cell: ({ row }) => <span className="tabular">{row.original.position}</span>,
    },
    {
      id: 'actions',
      meta: { label: 'Actions', align: 'right', mobile: 'detail' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <RowActions
          label={row.original.name}
          onEdit={canCall(e.updateBanner) ? () => setEditing(row.original) : undefined}
          onDelete={canCall(e.removeBanner) ? () => setRemoving(row.original) : undefined}
          extra={
            canCall(e.bannerStats) ? (
              <DropdownMenuItem onSelect={() => showStats(row.original.id)}>
                Statistics
              </DropdownMenuItem>
            ) : null
          }
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Banners"
        description="Promotional banners and where they appear on the storefront."
        actions={
          canCall(e.createBanner) ? (
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden />
              New banner
            </Button>
          ) : null
        }
      />
      <DataTable
        label="Banners"
        columns={columns}
        query={rows}
        getRowId={(row) => row.id}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="banners"
        filtered={params.activeFilterCount > 0}
        toolbar={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <FilterSelect
              label="Where"
              value={params.filters.placement}
              options={options(PLACEMENT_LABELS)}
              onChange={(v) => params.setFilter('placement', v)}
            />
            <FilterSelect
              label="Status"
              value={params.filters.isActive}
              options={[
                { value: 'true', label: 'On' },
                { value: 'false', label: 'Off' },
              ]}
              onChange={(v) => params.setFilter('isActive', v)}
            />
            {canCall(e.reorderBanners) ? (
              <Button
                variant="outline"
                size="sm"
                className="sm:ml-auto"
                disabled={!params.filters.placement}
                title={params.filters.placement ? undefined : 'Choose a placement first'}
                onClick={() => setOrdering(true)}
              >
                <ArrowUpDown aria-hidden />
                Change order
              </Button>
            ) : null}
          </div>
        }
        empty={
          <EmptyState
            icon={PanelTop}
            title="No banners yet"
            description="Create one to show an image or promotion in a chosen place on the storefront."
          />
        }
        emptyFiltered={
          <EmptyState
            title="No banner matches these filters"
            action={
              <Button variant="outline" onClick={params.clearAll}>
                Clear filters
              </Button>
            }
          />
        }
      />
      {editing ? (
        <BannerDialog
          row={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            setEditing(null);
          }}
        />
      ) : null}
      {ordering && params.filters.placement ? (
        <OrderDialog
          placement={params.filters.placement}
          onClose={() => setOrdering(false)}
          onSaved={refresh}
        />
      ) : null}
      {statsId ? <StatsDialog id={statsId} onClose={() => showStats(null)} /> : null}
      {removing ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setRemoving(null))}
          title={`Delete "${removing.name}"?`}
          description="The banner disappears from the storefront at once. Its statistics go with it."
          confirmLabel="Delete banner"
          level="destructive"
          onConfirm={async () => {
            await contentApi.removeBanner(removing.id);
            refresh();
            notifySuccess('Banner deleted');
          }}
        />
      ) : null}
    </>
  );
}
