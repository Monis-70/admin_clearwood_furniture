'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpDown, BarChart3, PanelTop, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { FilterSelect } from '@/components/patterns/data-table/filter-select';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { PageHeader } from '@/components/patterns/page-header';
import {
  EmptyState,
  ErrorState,
  PermissionNotice,
  SectionLoader,
} from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { contentRoutes } from '@/lib/api/routes/content';
import { formatDate, formatNumber } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { contentApi, contentKeys, type BannerListQuery, type BannerRow } from './api';
import { ReorderList, RowActions } from './kit';
import { DEVICE_LABELS, PLACEMENT_LABELS, options, reorderBody, windowLabel } from './model';

const BannerDialog = dynamic(() => import('./dialogs/banner-dialog').then((m) => m.BannerDialog), {
  ssr: false,
});

const e = contentRoutes;
const HREF = '/content/banners';
const pct = (bp: number) => `${(bp / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;

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
        empty={<EmptyState icon={PanelTop} title="No banners yet" />}
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

function OrderDialog({
  placement,
  onClose,
  onSaved,
}: {
  placement: string;
  onClose(): void;
  onSaved(): void;
}) {
  const query: BannerListQuery = { page: 1, limit: 100, order: 'asc', placement };
  const rows = useQuery({
    queryKey: contentKeys.banners(query),
    queryFn: ({ signal }) => contentApi.banners(query, signal),
    ...cachePolicy.list,
  });
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Order: {PLACEMENT_LABELS[placement] ?? placement}</DialogTitle>
          <DialogDescription>The first banner shows first (or alone).</DialogDescription>
        </DialogHeader>
        {rows.isPending ? (
          <SectionLoader label="Loading banners…" />
        ) : rows.error ? (
          <ErrorState error={rows.error} onRetry={() => void rows.refetch()} compact />
        ) : (
          <ReorderList
            items={[...rows.data.items].sort((a, b) => a.position - b.position)}
            label="Banner order"
            canReorder
            render={(b) => (
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{b.name}</span>
                {b.isActive ? null : <Badge tone="neutral">Off</Badge>}
              </span>
            )}
            onSave={async (ids) => {
              await contentApi.reorderBanners(reorderBody(ids));
              onSaved();
              onClose();
            }}
            empty={<EmptyState title="No banners in this placement" compact />}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatsDialog({ id, onClose }: { id: string; onClose(): void }) {
  const stats = useQuery({
    queryKey: contentKeys.bannerStats(id),
    queryFn: ({ signal }) => contentApi.bannerStats(id, signal),
    ...cachePolicy.diagnostic,
  });
  const days = new Map<string, { views: number; clicks: number }>();
  for (const d of stats.data?.daily ?? []) {
    const day = days.get(d.dayKey) ?? { views: 0, clicks: 0 };
    if (d.entityType === 'BANNER_CLICK') day.clicks += d.viewCount;
    else day.views += d.viewCount;
    days.set(d.dayKey, day);
  }
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 aria-hidden className="size-4" />
            {stats.data ? stats.data.name : 'Banner statistics'}
          </DialogTitle>
          <DialogDescription>Counted by the storefront; up to the last 60 days.</DialogDescription>
        </DialogHeader>
        {stats.isPending ? (
          <SectionLoader label="Loading statistics…" />
        ) : stats.error ? (
          <ErrorState error={stats.error} onRetry={() => void stats.refetch()} compact />
        ) : (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-3 gap-3">
              {[
                ['Views', formatNumber(stats.data.impressionCount)],
                ['Clicks', formatNumber(stats.data.clickCount)],
                ['Click-through', pct(stats.data.clickThroughBp)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="tabular text-lg font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            {days.size === 0 ? (
              <p className="text-sm text-muted-foreground">No views recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <caption className="sr-only">Views and clicks per day</caption>
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 font-medium">Day</th>
                    <th className="py-1 text-right font-medium">Views</th>
                    <th className="py-1 text-right font-medium">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {[...days.entries()]
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([day, v]) => (
                      <tr key={day} className="border-t">
                        <td className="py-1">{day}</td>
                        <td className="tabular py-1 text-right">{formatNumber(v.views)}</td>
                        <td className="tabular py-1 text-right">{formatNumber(v.clicks)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
