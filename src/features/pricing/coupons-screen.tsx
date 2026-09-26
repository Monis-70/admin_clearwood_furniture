'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Plus, TicketPercent, Wand2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { FilterSelect } from '@/components/patterns/data-table/filter-select';
import { SearchInput } from '@/components/patterns/data-table/search-input';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { PageHeader } from '@/components/patterns/page-header';
import { EmptyState, PermissionNotice } from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { pricingRoutes } from '@/lib/api/routes/pricing';
import { formatDate, formatNumber } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { TYPE_LABELS, couponState, describeCoupon } from './coupon-model';
import { couponsApi, promotionsKeys, type CouponListQuery, type CouponRow } from './promotions-api';

const CouponDialog = dynamic(() => import('./coupon-dialogs').then((m) => m.CouponDialog), {
  ssr: false,
});
const GenerateDialog = dynamic(() => import('./coupon-dialogs').then((m) => m.GenerateDialog), {
  ssr: false,
});
const CouponSheet = dynamic(() => import('./coupon-dialogs').then((m) => m.CouponSheet), {
  ssr: false,
});

const FILTERS = ['id', 'type', 'isActive'] as const;

export function CouponsScreen() {
  const { canCall } = usePermissions();
  if (!canCall(pricingRoutes.coupons)) {
    return <PermissionNotice area="coupons" all={['pricing.coupon.read']} />;
  }
  return <Coupons />;
}

function Coupons() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const params = useListParams<(typeof FILTERS)[number]>({
    filters: FILTERS,
    defaultSort: 'createdAt',
  });
  const f = params.filters;
  const [editing, setEditing] = useState<CouponRow | 'new' | null>(null);
  const [generating, setGenerating] = useState(false);
  const [removing, setRemoving] = useState<CouponRow | null>(null);
  const query: CouponListQuery = {
    page: params.page,
    limit: params.limit,
    ...(params.q ? { q: params.q } : {}),
    ...(f.type ? { type: f.type } : {}),
    ...(f.isActive ? { isActive: f.isActive } : {}),
  };
  const coupons = useQuery({
    queryKey: promotionsKeys.couponList(query),
    queryFn: ({ signal }) => couponsApi.list(query, signal),
    ...cachePolicy.list,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: promotionsKeys.coupons });
  const filtered = Boolean(params.q || f.type || f.isActive);

  const columns: DataTableColumn<CouponRow>[] = [
    {
      id: 'code',
      meta: { label: 'Coupon', pinned: true, mobile: 'title' },
      header: 'Coupon',
      cell: ({ row }) => (
        <button
          type="button"
          className="flex flex-col text-left"
          onClick={() => params.setFilter('id', row.original.id)}
        >
          <span className="font-mono font-medium hover:underline">{row.original.code}</span>
          <span className="text-xs text-muted-foreground">{row.original.name}</span>
        </button>
      ),
    },
    {
      id: 'value',
      meta: { label: 'Gives', mobile: 'detail' },
      header: 'Gives',
      cell: ({ row }) => describeCoupon(row.original),
    },
    {
      id: 'window',
      meta: { label: 'Valid', mobile: 'detail' },
      header: 'Valid',
      cell: ({ row }) =>
        row.original.startsAt || row.original.endsAt
          ? `${row.original.startsAt ? formatDate(row.original.startsAt) : 'Now'} – ${row.original.endsAt ? formatDate(row.original.endsAt) : 'no end'}`
          : 'Always',
    },
    {
      id: 'used',
      meta: { label: 'Used', align: 'right', mobile: 'detail' },
      header: 'Used',
      cell: ({ row }) => (
        <span className="tabular">
          {formatNumber(row.original.usedCount)}
          {row.original.usageLimit ? ` / ${formatNumber(row.original.usageLimit)}` : ''}
        </span>
      ),
    },
    {
      id: 'status',
      meta: { label: 'Status', mobile: 'detail' },
      header: 'Status',
      cell: ({ row }) => {
        const state = couponState(row.original);
        return <Badge tone={state.tone}>{state.label}</Badge>;
      },
    },
    {
      id: 'actions',
      meta: { label: 'Actions', align: 'right', mobile: 'detail' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.code}`}>
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => params.setFilter('id', row.original.id)}>
              Details
            </DropdownMenuItem>
            {canCall(pricingRoutes.updateCoupon) ? (
              <DropdownMenuItem onSelect={() => setEditing(row.original)}>Edit</DropdownMenuItem>
            ) : null}
            {canCall(pricingRoutes.removeCoupon) ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setRemoving(row.original)}
                >
                  Delete…
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Codes customers enter at checkout, and automatic coupons. Whether a coupon applies is decided by the pricing engine."
        actions={
          canCall(pricingRoutes.createCoupon) ? (
            <>
              <Button variant="outline" onClick={() => setGenerating(true)}>
                <Wand2 aria-hidden />
                Generate codes
              </Button>
              <Button onClick={() => setEditing('new')}>
                <Plus aria-hidden />
                New coupon
              </Button>
            </>
          ) : undefined
        }
      />
      <DataTable
        label="Coupons"
        columns={columns}
        query={coupons}
        getRowId={(row) => row.id}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="coupons"
        filtered={filtered}
        toolbar={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput
              value={params.q}
              onSearch={params.setSearch}
              label="Search coupons"
              minLength={1}
            />
            <FilterSelect
              label="Type"
              value={f.type}
              options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              onChange={(v) => params.setFilter('type', v)}
            />
            <FilterSelect
              label="Switched on"
              value={f.isActive}
              options={[
                { value: 'true', label: 'On' },
                { value: 'false', label: 'Off' },
              ]}
              onChange={(v) => params.setFilter('isActive', v)}
            />
          </div>
        }
        empty={
          <EmptyState
            icon={TicketPercent}
            title="No coupons yet"
            description="Create a code such as WELCOME10."
          />
        }
        emptyFiltered={
          <EmptyState
            title="No coupon matches"
            action={
              <Button variant="outline" onClick={params.clearAll}>
                Clear filters
              </Button>
            }
          />
        }
      />
      {editing ? (
        <CouponDialog
          coupon={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            setEditing(null);
          }}
        />
      ) : null}
      {generating ? <GenerateDialog onClose={() => setGenerating(false)} onDone={refresh} /> : null}
      {removing ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setRemoving(null))}
          title={`Delete coupon ${removing.code}?`}
          description="Customers can no longer use it. Orders that already used it keep their discount."
          confirmLabel="Delete coupon"
          level="destructive"
          onConfirm={async () => {
            await couponsApi.remove(removing.id);
            refresh();
            params.setFilter('id', null);
            notifySuccess('Coupon deleted');
          }}
        />
      ) : null}
      {f.id ? (
        <CouponSheet
          id={f.id}
          onClose={() => params.setFilter('id', null)}
          onEdit={(c) => setEditing(c)}
        />
      ) : null}
    </>
  );
}
