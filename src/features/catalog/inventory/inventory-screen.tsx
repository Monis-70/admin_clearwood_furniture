'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, History, MoreHorizontal, Warehouse } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';

import type { InventoryLedgerEntryDto, LowStockItemDto } from '@shared/types/catalogAdmin';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { FilterSelect } from '@/components/patterns/data-table/filter-select';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { catalogRoutes } from '@/lib/api/routes/catalog';
import { inventoryRoutes } from '@/lib/api/routes/inventory';
import { formatDateTime, formatNumber } from '@/lib/format/datetime';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { catalogApi, catalogKeys, type SimpleListQuery } from '../api';
import { STOCK_STATUS } from '../model';
import { inventoryApi, productKeys } from '../products/api';
import { productHref } from '../products/href';

import { REASON_LABELS } from './model';

const StockAdjustDialog = dynamic(
  () => import('./stock-adjust-dialog').then((m) => m.StockAdjustDialog),
  { ssr: false },
);
const BulkAdjustDialog = dynamic(
  () => import('./bulk-adjust-dialog').then((m) => m.BulkAdjustDialog),
  { ssr: false },
);

type Adjusting = { variantId: string; label: string; productId?: string };
const FILTERS = ['variantId', 'includeBackorder'] as const;
type Filter = (typeof FILTERS)[number];

export function InventoryScreen() {
  const { canCall } = usePermissions();
  const params = useListParams<Filter>({ filters: FILTERS });
  if (params.filters.variantId) {
    if (!canCall(inventoryRoutes.snapshot))
      return <PermissionNotice area="stock history" all={['catalog.inventory.read']} />;
    return <VariantStock variantId={params.filters.variantId} />;
  }
  if (!canCall(catalogRoutes.lowStock)) {
    return <PermissionNotice area="inventory" all={['catalog.inventory.read']} />;
  }
  return <LowStockList params={params} />;
}

function LowStockList({ params }: { params: ReturnType<typeof useListParams<Filter>> }) {
  const { canCall } = usePermissions();
  const [adjusting, setAdjusting] = useState<Adjusting | null>(null);
  const [bulk, setBulk] = useState<LowStockItemDto[] | 'sku' | null>(null);
  const query: SimpleListQuery & { includeBackorder?: boolean } = {
    page: params.page,
    limit: params.limit,
    order: params.order,
    ...(params.filters.includeBackorder ? { includeBackorder: true } : {}),
  };
  const rows = useQuery({
    queryKey: catalogKeys.lowStock(query),
    queryFn: ({ signal }) => catalogApi.lowStock(query, signal),
    ...cachePolicy.list,
  });
  const canAdjust = canCall(inventoryRoutes.adjust);
  const canBulk = canCall(inventoryRoutes.bulkAdjust);
  const labelOf = (row: LowStockItemDto) =>
    `${row.productName}${row.variantName ? ` · ${row.variantName}` : ''} (${row.sku})`;

  const columns: DataTableColumn<LowStockItemDto>[] = [
    {
      id: 'product',
      meta: { label: 'Product', pinned: true, mobile: 'title' },
      header: 'Product',
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <Link
            href={productHref(row.original.productId, 'inventory')}
            className="truncate font-medium hover:underline"
          >
            {row.original.productName}
          </Link>
          {row.original.variantName ? (
            <span className="truncate text-xs text-muted-foreground">
              {row.original.variantName}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'sku',
      meta: { label: 'Variant SKU', mobile: 'detail' },
      header: 'Variant SKU',
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.sku}</span>,
    },
    {
      id: 'status',
      meta: { label: 'Status', mobile: 'detail' },
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.stockStatus} registry={STOCK_STATUS} />,
    },
    {
      id: 'available',
      meta: { label: 'Available', align: 'right', mobile: 'detail' },
      header: 'Available',
      cell: ({ row }) => (
        <span className="tabular font-medium">{formatNumber(row.original.availableQty)}</span>
      ),
    },
    {
      id: 'stock',
      meta: { label: 'In stock / reserved', align: 'right', mobile: 'detail' },
      header: 'In stock / reserved',
      cell: ({ row }) => (
        <span className="tabular">
          {formatNumber(row.original.stockQty)} / {formatNumber(row.original.reservedQty)}
        </span>
      ),
    },
    {
      id: 'threshold',
      meta: { label: 'Low-stock level', align: 'right', mobile: 'hidden' },
      header: 'Low-stock level',
      cell: ({ row }) => (
        <span className="tabular">{formatNumber(row.original.lowStockThreshold)}</span>
      ),
    },
    {
      id: 'actions',
      meta: { label: 'Actions', align: 'right', mobile: 'detail' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.sku}`}>
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canAdjust ? (
              <DropdownMenuItem
                onSelect={() =>
                  setAdjusting({
                    variantId: row.original.variantId,
                    label: labelOf(row.original),
                    productId: row.original.productId,
                  })
                }
              >
                Adjust stock…
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem asChild>
              <Link
                href={`/catalog/inventory?variantId=${encodeURIComponent(row.original.variantId)}`}
              >
                Stock history
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={productHref(row.original.productId, 'inventory')}>Open product</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Variants at or below their low-stock level. Made-to-order products are not listed: they are built for each order."
        actions={
          canBulk ? (
            <Button variant="outline" onClick={() => setBulk('sku')}>
              Bulk adjust by SKU
            </Button>
          ) : undefined
        }
      />
      <DataTable
        label="Low stock variants"
        columns={columns}
        query={rows}
        getRowId={(row) => row.variantId}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="low-stock"
        filtered={Boolean(params.filters.includeBackorder)}
        bulkActions={
          canBulk
            ? (selected, clear) => (
                <Button
                  size="sm"
                  onClick={() => {
                    setBulk(selected);
                    clear();
                  }}
                >
                  Restock {selected.length} selected…
                </Button>
              )
            : undefined
        }
        toolbar={
          <FilterSelect
            label="Back-orders"
            value={params.filters.includeBackorder}
            options={[{ value: 'true', label: 'Include back-orderable variants' }]}
            onChange={(v) => params.setFilter('includeBackorder', v)}
          />
        }
        empty={
          <EmptyState
            icon={Warehouse}
            title="Nothing is running low"
            description="Every variant is above its low-stock level."
          />
        }
      />
      {adjusting ? <StockAdjustDialog {...adjusting} onClose={() => setAdjusting(null)} /> : null}
      {bulk ? (
        <BulkAdjustDialog
          rows={
            bulk === 'sku'
              ? null
              : bulk.map((row) => ({
                  variantId: row.variantId,
                  sku: row.sku,
                  label: labelOf(row),
                  stockQty: row.stockQty,
                }))
          }
          onClose={() => setBulk(null)}
        />
      ) : null}
    </>
  );
}

function VariantStock({ variantId }: { variantId: string }) {
  const { canCall } = usePermissions();
  const [page, setPage] = useState(1);
  const [adjusting, setAdjusting] = useState(false);
  const snapshot = useQuery({
    queryKey: productKeys.stock(variantId),
    queryFn: ({ signal }) => inventoryApi.snapshot(variantId, signal),
    ...cachePolicy.detail,
  });
  const ledger = useQuery({
    queryKey: productKeys.ledger(variantId, page),
    queryFn: ({ signal }) => inventoryApi.history(variantId, page, signal),
    enabled: canCall(inventoryRoutes.history),
    ...cachePolicy.list,
  });

  const columns: DataTableColumn<InventoryLedgerEntryDto>[] = [
    {
      id: 'when',
      meta: { label: 'When', pinned: true, mobile: 'title' },
      header: 'When',
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      id: 'change',
      meta: { label: 'Change', align: 'right', mobile: 'detail' },
      header: 'Change',
      cell: ({ row }) => (
        <span
          className={`tabular font-medium ${row.original.delta < 0 ? 'text-danger' : 'text-success'}`}
        >
          {row.original.delta > 0 ? '+' : ''}
          {formatNumber(row.original.delta)}
        </span>
      ),
    },
    {
      id: 'balance',
      meta: { label: 'Stock after', align: 'right', mobile: 'detail' },
      header: 'Stock after',
      cell: ({ row }) => <span className="tabular">{formatNumber(row.original.balanceAfter)}</span>,
    },
    {
      id: 'reason',
      meta: { label: 'Reason', mobile: 'detail' },
      header: 'Reason',
      cell: ({ row }) => REASON_LABELS[row.original.reason] ?? row.original.reason,
    },
    {
      id: 'note',
      meta: { label: 'Note', mobile: 'detail' },
      header: 'Note',
      cell: ({ row }) =>
        row.original.note ?? (row.original.refType ? `${row.original.refType}` : '—'),
    },
    {
      id: 'actor',
      meta: { label: 'By', mobile: 'hidden' },
      header: 'By',
      cell: ({ row }) => (
        <Badge tone="outline">
          {row.original.actorType === 'SYSTEM'
            ? 'System'
            : row.original.actorType === 'ADMIN'
              ? 'Admin'
              : row.original.actorType}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={snapshot.data ? `Stock · ${snapshot.data.sku}` : 'Stock'}
        description="Every movement of this variant's stock, newest first. Orders, returns and manual changes all write here."
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link href="/catalog/inventory">
                <ArrowLeft aria-hidden />
                Inventory
              </Link>
            </Button>
            {canCall(inventoryRoutes.adjust) && snapshot.data ? (
              <Button onClick={() => setAdjusting(true)}>Adjust stock…</Button>
            ) : null}
          </>
        }
      />
      {snapshot.isPending ? (
        <SectionLoader label="Loading stock…" />
      ) : snapshot.error ? (
        <ErrorState error={snapshot.error} onRetry={() => void snapshot.refetch()} />
      ) : (
        <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ['In stock', formatNumber(snapshot.data.stockQty)],
            ['Reserved', formatNumber(snapshot.data.reservedQty)],
            ['Available', formatNumber(snapshot.data.availableQty)],
            ['Low-stock level', formatNumber(snapshot.data.lowStockThreshold)],
            ['Back-orders', snapshot.data.allowBackorder ? 'Allowed' : 'Not allowed'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border bg-card p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="tabular text-lg font-semibold">{value}</dd>
            </div>
          ))}
          <div className="col-span-2 flex items-center gap-2 sm:col-span-5">
            <StatusBadge status={snapshot.data.stockStatus} registry={STOCK_STATUS} />
          </div>
        </dl>
      )}
      {canCall(inventoryRoutes.history) ? (
        <DataTable
          label="Stock movements"
          columns={columns}
          query={ledger}
          getRowId={(row) => row.id}
          onPageChange={setPage}
          onLimitChange={() => undefined}
          preferenceKey="stock-ledger"
          empty={
            <EmptyState
              icon={History}
              title="No movements yet"
              description="The first stock change will appear here."
            />
          }
        />
      ) : null}
      {adjusting && snapshot.data ? (
        <StockAdjustDialog
          variantId={variantId}
          label={snapshot.data.sku}
          onClose={() => setAdjusting(false)}
        />
      ) : null}
    </>
  );
}
