'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eraser, Heart, ShoppingCart } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import type { AdminCartRowDto } from '@shared/types/cart';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { FilterSelect } from '@/components/patterns/data-table/filter-select';
import { SearchInput } from '@/components/patterns/data-table/search-input';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { PageHeader } from '@/components/patterns/page-header';
import {
  EmptyState,
  ErrorState,
  PermissionNotice,
  SectionLoader,
} from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/surface';
import { cartsRoutes } from '@/lib/api/routes/carts';
import { formatNumber, formatRelative } from '@/lib/format/datetime';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';
import { cn } from '@/lib/utils';

import { formatRupees } from '../catalog/model';

import { cartKeys, cartsApi, type CartListQuery } from './api';
import { CART_STATUS_LABELS, bpPercent } from './model';

const CartDetailSheet = dynamic(
  () => import('./cart-detail-sheet').then((m) => m.CartDetailSheet),
  { ssr: false },
);
const CleanupDialog = dynamic(() => import('./cleanup-dialog').then((m) => m.CleanupDialog), {
  ssr: false,
});

const HREF = '/carts';

export function CartsScreen() {
  const { canCall } = usePermissions();
  const tab = useSearchParams().get('tab') === 'wishlists' ? 'wishlists' : 'carts';
  const router = useRouter();
  if (!canCall(cartsRoutes.list))
    return <PermissionNotice area="carts and wishlists" all={['order.customer.read']} />;
  return (
    <>
      <PageHeader
        title="Carts & wishlists"
        description="What shoppers are about to buy, what they leave behind and what they save. Read-only: carts belong to customers."
      />
      <div role="tablist" aria-label="Carts and wishlists" className="mb-4 flex gap-1 border-b">
        {(
          [
            ['carts', 'Carts'],
            ['wishlists', 'Wishlists'],
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
              router.replace(id === 'carts' ? HREF : `${HREF}?tab=wishlists`, { scroll: false })
            }
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'carts' ? <Carts /> : <Wishlists />}
    </>
  );
}

function Stats() {
  const stats = useQuery({
    queryKey: cartKeys.stats(),
    queryFn: ({ signal }) => cartsApi.stats(signal),
    ...cachePolicy.diagnostic,
  });
  if (stats.isPending) return <SectionLoader label="Loading cart figures…" />;
  if (stats.error)
    return <ErrorState error={stats.error} onRetry={() => void stats.refetch()} compact />;
  const s = stats.data;
  return (
    <div className="mb-6 flex flex-col gap-4">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Active carts', formatNumber(s.totals.active)],
          ['Value in active carts', formatRupees(s.activeValuePaise)],
          ['Abandonment rate', bpPercent(s.abandonmentRateBp)],
          ['Average cart', formatRupees(s.averageValuePaise)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="tabular text-xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {s.topAbandonedProducts.length > 0 ? (
        <details className="rounded-lg border bg-card p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Most often left in abandoned carts
          </summary>
          <table className="mt-2 w-full text-sm">
            <caption className="sr-only">Products most often left in abandoned carts</caption>
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 font-medium">Product</th>
                <th className="py-1 text-right font-medium">Carts</th>
                <th className="py-1 text-right font-medium">Units</th>
              </tr>
            </thead>
            <tbody>
              {s.topAbandonedProducts.map((p) => (
                <tr key={p.productId} className="border-t">
                  <td className="py-1">
                    {p.name} <span className="text-xs text-muted-foreground">{p.sku}</span>
                  </td>
                  <td className="tabular py-1 text-right">{formatNumber(p.carts)}</td>
                  <td className="tabular py-1 text-right">{formatNumber(p.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
    </div>
  );
}

function Carts() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const params = useListParams<'status' | 'hasCustomer' | 'id' | 'customer'>({
    filters: ['status', 'hasCustomer', 'id', 'customer'],
    defaultSort: 'lastActivityAt',
  });
  const [cleaning, setCleaning] = useState(false);
  const [customer, setCustomer] = useState('');
  const query: CartListQuery = {
    page: params.page,
    limit: params.limit,
    sort: params.sort,
    order: params.order,
    ...(params.q ? { q: params.q } : {}),
    ...(params.filters.status ? { status: params.filters.status } : {}),
    ...(params.filters.hasCustomer ? { hasCustomer: params.filters.hasCustomer } : {}),
  };
  const rows = useQuery({
    queryKey: cartKeys.list(query),
    queryFn: ({ signal }) => cartsApi.list(query, signal),
    ...cachePolicy.list,
  });

  const columns: DataTableColumn<AdminCartRowDto>[] = [
    {
      id: 'customer',
      meta: { label: 'Shopper', pinned: true, mobile: 'title' },
      header: 'Shopper',
      cell: ({ row }) => (
        <button
          type="button"
          className="flex flex-col items-start text-left"
          onClick={() => params.setFilter('id', row.original.id)}
        >
          <span className="font-medium hover:underline">
            {row.original.customerName ?? (row.original.isGuest ? 'Guest' : 'Unknown')}
          </span>
          <span className="text-xs text-muted-foreground">{row.original.customerEmail ?? ''}</span>
        </button>
      ),
    },
    {
      id: 'status',
      meta: { label: 'Status', mobile: 'detail' },
      header: 'Status',
      cell: ({ row }) => (
        <Badge
          tone={
            row.original.status === 'ACTIVE'
              ? 'success'
              : row.original.status === 'ABANDONED'
                ? 'warning'
                : 'neutral'
          }
        >
          {CART_STATUS_LABELS[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    {
      id: 'items',
      meta: { label: 'Items', mobile: 'detail', align: 'right' },
      header: 'Items',
      cell: ({ row }) => (
        <span className="tabular">{formatNumber(row.original.quantityTotal)}</span>
      ),
    },
    {
      id: 'value',
      meta: { label: 'Last quoted', mobile: 'detail', align: 'right' },
      header: 'Last quoted',
      cell: ({ row }) =>
        row.original.lastQuotedTotalPaise === null
          ? '—'
          : formatRupees(row.original.lastQuotedTotalPaise),
    },
    {
      id: 'lastActivityAt',
      meta: { label: 'Last activity', sortKey: 'lastActivityAt', mobile: 'detail' },
      header: 'Last activity',
      cell: ({ row }) => formatRelative(row.original.lastActivityAt),
    },
  ];

  const findCustomer = (e: FormEvent) => {
    e.preventDefault();
    if (customer.trim()) params.setFilter('customer', customer.trim());
  };

  return (
    <>
      <Stats />
      <DataTable
        label="Carts"
        columns={columns}
        query={rows}
        getRowId={(row) => row.id}
        sort={{ field: params.sort, order: params.order, onChange: params.setSort }}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="carts"
        filtered={Boolean(params.q || params.filters.status || params.filters.hasCustomer)}
        toolbar={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput
              value={params.q}
              onSearch={params.setSearch}
              label="Search shopper name or email"
              minLength={2}
            />
            <FilterSelect
              label="Status"
              value={params.filters.status}
              options={Object.entries(CART_STATUS_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              onChange={(v) => params.setFilter('status', v)}
            />
            <FilterSelect
              label="Shopper"
              value={params.filters.hasCustomer}
              options={[
                { value: 'true', label: 'Signed-in customers' },
                { value: 'false', label: 'Guests' },
              ]}
              onChange={(v) => params.setFilter('hasCustomer', v)}
            />
            {canCall(cartsRoutes.cleanup) ? (
              <Button
                variant="outline"
                size="sm"
                className="sm:ml-auto"
                onClick={() => setCleaning(true)}
              >
                <Eraser aria-hidden />
                Clean up old carts
              </Button>
            ) : null}
          </div>
        }
        empty={<EmptyState icon={ShoppingCart} title="No carts yet" />}
        emptyFiltered={
          <EmptyState
            title="No cart matches these filters"
            action={
              <Button variant="outline" onClick={params.clearAll}>
                Clear filters
              </Button>
            }
          />
        }
      />
      {canCall(cartsRoutes.customerCart) ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">A customer&apos;s live cart</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={findCustomer} className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="customer-id" className="text-sm font-medium">
                  Customer ID
                </label>
                <Input
                  id="customer-id"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  className="w-72 font-mono text-xs"
                  placeholder="From an order or support ticket"
                />
              </div>
              <Button type="submit" variant="outline" disabled={!customer.trim()}>
                Show cart
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
      {params.filters.id || params.filters.customer ? (
        <CartDetailSheet
          id={params.filters.id}
          customerId={params.filters.id ? undefined : params.filters.customer}
          onClose={() => {
            params.setFilter('id', null);
            params.setFilter('customer', null);
          }}
        />
      ) : null}
      {cleaning ? (
        <CleanupDialog
          onClose={() => setCleaning(false)}
          onDone={() => void queryClient.invalidateQueries({ queryKey: cartKeys.all })}
        />
      ) : null}
    </>
  );
}

function Wishlists() {
  const stats = useQuery({
    queryKey: cartKeys.wishlists(),
    queryFn: ({ signal }) => cartsApi.wishlistStats(signal),
    ...cachePolicy.diagnostic,
  });
  if (stats.isPending) return <SectionLoader label="Loading wishlists…" />;
  if (stats.error) return <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />;
  const s = stats.data;
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          ['Wishlists', formatNumber(s.totals.lists)],
          ['Saved products', formatNumber(s.totals.items)],
          ['Shared publicly', formatNumber(s.totals.publicLists)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="tabular text-xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Heart aria-hidden className="size-4" />
              Most wished for
            </CardTitle>
          </CardHeader>
          <CardContent>
            {s.mostWishlisted.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing saved yet.</p>
            ) : (
              <ol className="flex flex-col divide-y text-sm" aria-label="Most wished for">
                {s.mostWishlisted.map((p) => (
                  <li key={p.productId} className="flex justify-between gap-2 py-1.5">
                    <span>
                      {p.name} <span className="text-xs text-muted-foreground">{p.sku}</span>
                    </span>
                    <span className="tabular">{formatNumber(p.count)}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cheaper than when saved</CardTitle>
          </CardHeader>
          <CardContent>
            {s.priceDropCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved product is cheaper now.</p>
            ) : (
              <ol className="flex flex-col divide-y text-sm" aria-label="Cheaper than when saved">
                {s.priceDropCandidates.map((p) => (
                  <li key={p.productId} className="flex flex-wrap justify-between gap-2 py-1.5">
                    <span>{p.name}</span>
                    <span className="tabular text-muted-foreground">
                      {formatRupees(p.addedPricePaise)} → {formatRupees(p.currentPricePaise)} ·{' '}
                      {formatNumber(p.watchers)} watching
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
