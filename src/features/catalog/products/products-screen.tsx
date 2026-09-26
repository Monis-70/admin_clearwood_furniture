'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageOff, MoreHorizontal, Package, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';

import type { AdminProductSummaryDto } from '@shared/types/catalogAdmin';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { FilterSelect } from '@/components/patterns/data-table/filter-select';
import { SavedFiltersMenu } from '@/components/patterns/data-table/saved-filters-menu';
import { SearchInput } from '@/components/patterns/data-table/search-input';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { PageHeader } from '@/components/patterns/page-header';
import { EmptyState, PermissionNotice } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { catalogRoutes } from '@/lib/api/routes/catalog';
import { productsRoutes } from '@/lib/api/routes/products';
import { formatNumber, formatRelative } from '@/lib/format/datetime';
import { notifyError, notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { catalogApi, catalogKeys, type ProductListQuery } from '../api';
import { flattenTree, useBrandOptions, useCategoryOptions } from '../lookups';
import { PRODUCT_STATUS, PUBLICATION, formatRupees } from '../model';

import { productHref } from './href';

// Row actions are rare next to reading the list, so their API calls load when one is used.
const productsApi = () => import('./api').then((m) => m.productsApi);

const BulkActions = dynamic(() => import('./bulk-actions').then((m) => m.BulkActions), {
  ssr: false,
});

const FILTERS = [
  'status',
  'publication',
  'stock',
  'hasMedia',
  'completenessMax',
  'categoryId',
  'collectionId',
  'brandId',
  'visibility',
  'madeToOrder',
  'customizable',
  'isFeatured',
  'isNewArrival',
  'isSpecialCollection',
  'includeDeleted',
] as const;
type Filter = (typeof FILTERS)[number];

const opts = (entries: Record<string, string>) =>
  Object.entries(entries).map(([value, label]) => ({ value, label }));
const STATUS_OPTIONS = opts({ DRAFT: 'Draft', ACTIVE: 'Active', ARCHIVED: 'Archived' });
const PUBLICATION_OPTIONS = opts({
  LIVE: 'Live',
  SCHEDULED: 'Scheduled',
  DRAFT: 'Not published',
  ARCHIVED: 'Archived',
});
const STOCK_OPTIONS = opts({
  IN_STOCK: 'In stock',
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
});
const MEDIA_OPTIONS = opts({ false: 'Without images', true: 'With images' });
const COMPLETENESS_OPTIONS = opts({ '50': 'Below 50% complete', '80': 'Below 80% complete' });
const VISIBILITY_OPTIONS = opts({
  PUBLIC: 'Everywhere',
  CATALOG_ONLY: 'Catalogue only',
  SEARCH_ONLY: 'Search only',
  HIDDEN: 'Hidden',
});
const YES_NO = opts({ true: 'Yes', false: 'No' });
const TRASH_OPTIONS = opts({ true: 'Include deleted' });

export function ProductsScreen() {
  const { canCall } = usePermissions();
  if (!canCall(catalogRoutes.products)) {
    return <PermissionNotice area="products" all={['catalog.product.read']} />;
  }
  return <ProductsList />;
}

function ProductsList() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const params = useListParams<Filter>({ filters: FILTERS, defaultSort: 'updatedAt' });
  const f = params.filters;
  const categories = useCategoryOptions();
  const brands = useBrandOptions();
  const collections = useQuery({
    queryKey: catalogKeys.collections({ page: 1, limit: 100, order: 'asc' }),
    queryFn: ({ signal }) => catalogApi.collections({ page: 1, limit: 100, order: 'asc' }, signal),
    enabled: canCall(catalogRoutes.collections),
    ...cachePolicy.reference,
  });
  const [trashing, setTrashing] = useState<AdminProductSummaryDto | null>(null);
  const query: ProductListQuery = {
    page: params.page,
    limit: params.limit,
    sort: params.sort,
    order: params.order,
    q: params.q || undefined,
    status: f.status,
    publication: f.publication,
    stock: f.stock,
    hasMedia: f.hasMedia,
    completenessMax: f.completenessMax ? Number(f.completenessMax) - 1 : undefined,
    categoryId: f.categoryId,
    collectionId: f.collectionId,
    brandId: f.brandId,
    visibility: f.visibility,
    madeToOrder: f.madeToOrder,
    customizable: f.customizable,
    isFeatured: f.isFeatured,
    isNewArrival: f.isNewArrival,
    isSpecialCollection: f.isSpecialCollection,
    includeDeleted: f.includeDeleted,
  };
  const products = useQuery({
    queryKey: catalogKeys.products(query),
    queryFn: ({ signal }) => catalogApi.products(query, signal),
    ...cachePolicy.list,
  });
  const categoryName = new Map((categories.data ?? []).map((c) => [c.id, c.name]));

  const act = async (label: string, run: () => Promise<unknown>) => {
    try {
      await run();
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      notifySuccess(label);
    } catch (error) {
      notifyError(error, 'Could not complete the action');
    }
  };

  const columns: DataTableColumn<AdminProductSummaryDto>[] = [
    {
      id: 'name',
      meta: { label: 'Product', sortKey: 'name', pinned: true, mobile: 'title' },
      header: 'Product',
      cell: ({ row }) => (
        <span className="flex items-center gap-3">
          {row.original.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- static export; the API serves renditions
            <img
              src={row.original.thumbnailUrl}
              alt=""
              width={40}
              height={40}
              loading="lazy"
              className="size-10 shrink-0 rounded-md border object-cover"
            />
          ) : (
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground"
              title="No image yet"
            >
              <ImageOff aria-hidden className="size-4" />
              <span className="sr-only">No image</span>
            </span>
          )}
          <span className="flex min-w-0 flex-col">
            <Link
              href={productHref(row.original.id)}
              className="truncate font-medium hover:underline"
            >
              {row.original.name}
            </Link>
            <span className="font-mono text-xs text-muted-foreground">{row.original.sku}</span>
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
          {row.original.deletedAt ? (
            <StatusBadge
              status="DELETED"
              registry={{ DELETED: { label: 'In trash', tone: 'danger' } }}
            />
          ) : (
            <>
              <StatusBadge status={row.original.status} registry={PRODUCT_STATUS} />
              <StatusBadge status={row.original.publication} registry={PUBLICATION} />
            </>
          )}
        </span>
      ),
    },
    {
      id: 'category',
      meta: { label: 'Category', mobile: 'detail' },
      header: 'Category',
      cell: ({ row }) =>
        row.original.primaryCategoryId ? (
          (categoryName.get(row.original.primaryCategoryId) ?? '—')
        ) : (
          <span className="text-muted-foreground">None</span>
        ),
    },
    {
      id: 'basePricePaise',
      meta: { label: 'Base price', sortKey: 'basePricePaise', align: 'right', mobile: 'detail' },
      header: 'Base price',
      cell: ({ row }) => (
        <span className="tabular">{formatRupees(row.original.basePricePaise)}</span>
      ),
    },
    {
      id: 'stock',
      meta: { label: 'Stock', align: 'right', mobile: 'detail' },
      header: 'Stock',
      cell: ({ row }) => (
        <span className="tabular">
          {formatNumber(row.original.totalStock)}
          <span className="text-xs text-muted-foreground">
            {' '}
            · {row.original.variantCount} variant{row.original.variantCount === 1 ? '' : 's'}
          </span>
        </span>
      ),
    },
    {
      id: 'completeness',
      meta: { label: 'Complete', align: 'right', mobile: 'detail' },
      header: 'Complete',
      cell: ({ row }) => {
        const score = row.original.completenessScore;
        return (
          <span
            className={score < 50 ? 'font-medium text-danger' : score < 80 ? 'text-warning' : ''}
            title="How much of the recommended product information is filled in"
          >
            {score}%
          </span>
        );
      },
    },
    {
      id: 'updatedAt',
      meta: { label: 'Updated', sortKey: 'updatedAt', mobile: 'hidden' },
      header: 'Updated',
      cell: ({ row }) => formatRelative(row.original.updatedAt),
    },
    {
      id: 'actions',
      meta: { label: 'Actions', align: 'right', mobile: 'detail' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const product = row.original;
        const live = product.publication === 'LIVE' || product.publication === 'SCHEDULED';
        const canPublish = canCall(productsRoutes.publish) && !product.deletedAt;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${product.name}`}>
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={productHref(product.id)}>Open</Link>
              </DropdownMenuItem>
              {!product.deletedAt ? (
                <DropdownMenuItem asChild>
                  <Link href={productHref(product.id, 'publishing')}>Publishing checklist</Link>
                </DropdownMenuItem>
              ) : null}
              {canPublish ? (
                <DropdownMenuItem
                  onSelect={() =>
                    void act(live ? 'Product unpublished' : 'Product published', async () => {
                      const api = await productsApi();
                      return live ? api.unpublish(product.id) : api.publish(product.id);
                    })
                  }
                >
                  {live ? 'Unpublish' : 'Publish now'}
                </DropdownMenuItem>
              ) : null}
              {product.deletedAt && canCall(productsRoutes.restore) ? (
                <DropdownMenuItem
                  onSelect={() =>
                    void act('Product restored', async () =>
                      (await productsApi()).restore(product.id),
                    )
                  }
                >
                  Restore
                </DropdownMenuItem>
              ) : null}
              {!product.deletedAt && canCall(productsRoutes.remove) ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setTrashing(product)}
                  >
                    Move to trash…
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const orderedCategories = flattenTree(categories.data ?? []);

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything in the catalog, with what each product still needs before customers see it."
        actions={
          canCall(productsRoutes.create) ? (
            <Button asChild>
              <Link href="/catalog/products/new">
                <Plus aria-hidden />
                New product
              </Link>
            </Button>
          ) : undefined
        }
      />
      <DataTable
        label="Products"
        columns={columns}
        query={products}
        getRowId={(row) => row.id}
        sort={{ field: params.sort, order: params.order, onChange: params.setSort }}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="products"
        filtered={params.activeFilterCount > 0}
        bulkActions={(selected, clear) => <BulkActions selected={selected} onDone={clear} />}
        toolbar={
          <div className="flex w-full flex-col gap-2">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <SearchInput
                value={params.q}
                onSearch={params.setSearch}
                label="Search name or SKU"
                minLength={2}
              />
              <FilterSelect
                label="Status"
                value={f.status}
                options={STATUS_OPTIONS}
                onChange={(v) => params.setFilter('status', v)}
              />
              <FilterSelect
                label="Publication"
                value={f.publication}
                options={PUBLICATION_OPTIONS}
                onChange={(v) => params.setFilter('publication', v)}
              />
              <FilterSelect
                label="Category"
                value={f.categoryId}
                options={orderedCategories.map((c) => ({
                  value: c.id,
                  label: `${'\u00a0\u00a0'.repeat(c.depth)}${c.name}`,
                }))}
                onChange={(v) => params.setFilter('categoryId', v)}
              />
              <FilterSelect
                label="Stock"
                value={f.stock}
                options={STOCK_OPTIONS}
                onChange={(v) => params.setFilter('stock', v)}
              />
              <div className="sm:ml-auto">
                <SavedFiltersMenu listId="products" />
              </div>
            </div>
            <details
              className="group"
              open={[
                'collectionId',
                'brandId',
                'visibility',
                'madeToOrder',
                'customizable',
                'isFeatured',
                'isNewArrival',
                'isSpecialCollection',
                'hasMedia',
                'completenessMax',
                'includeDeleted',
              ].some((k) => f[k as Filter])}
            >
              <summary className="w-fit cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                More filters
              </summary>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <FilterSelect
                  label="Collection"
                  value={f.collectionId}
                  options={(collections.data?.items ?? []).map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                  onChange={(v) => params.setFilter('collectionId', v)}
                />
                <FilterSelect
                  label="Brand"
                  value={f.brandId}
                  options={(brands.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
                  onChange={(v) => params.setFilter('brandId', v)}
                />
                <FilterSelect
                  label="Visibility"
                  value={f.visibility}
                  options={VISIBILITY_OPTIONS}
                  onChange={(v) => params.setFilter('visibility', v)}
                />
                <FilterSelect
                  label="Made to order"
                  value={f.madeToOrder}
                  options={YES_NO}
                  onChange={(v) => params.setFilter('madeToOrder', v)}
                />
                <FilterSelect
                  label="Customisable"
                  value={f.customizable}
                  options={YES_NO}
                  onChange={(v) => params.setFilter('customizable', v)}
                />
                <FilterSelect
                  label="Featured"
                  value={f.isFeatured}
                  options={YES_NO}
                  onChange={(v) => params.setFilter('isFeatured', v)}
                />
                <FilterSelect
                  label="New arrival"
                  value={f.isNewArrival}
                  options={YES_NO}
                  onChange={(v) => params.setFilter('isNewArrival', v)}
                />
                <FilterSelect
                  label="Special collection"
                  value={f.isSpecialCollection}
                  options={YES_NO}
                  onChange={(v) => params.setFilter('isSpecialCollection', v)}
                />
                <FilterSelect
                  label="Images"
                  value={f.hasMedia}
                  options={MEDIA_OPTIONS}
                  onChange={(v) => params.setFilter('hasMedia', v)}
                />
                <FilterSelect
                  label="Completeness"
                  value={f.completenessMax}
                  options={COMPLETENESS_OPTIONS}
                  onChange={(v) => params.setFilter('completenessMax', v)}
                />
                <FilterSelect
                  label="Trash"
                  value={f.includeDeleted}
                  options={TRASH_OPTIONS}
                  onChange={(v) => params.setFilter('includeDeleted', v)}
                />
              </div>
            </details>
          </div>
        }
        empty={
          <EmptyState
            icon={Package}
            title="No products yet"
            description="Create the first product; it stays a draft until you publish it."
          />
        }
        emptyFiltered={
          <EmptyState
            title="No product matches these filters"
            action={
              <Button variant="outline" onClick={params.clearAll}>
                Clear filters
              </Button>
            }
          />
        }
      />
      {trashing ? (
        <LazyConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setTrashing(null))}
          title={`Move ${trashing.name} to trash?`}
          description="It disappears from the storefront and from this list. Restore it any time from the Trash filter."
          confirmLabel="Move to trash"
          level="destructive"
          onConfirm={async () => {
            await (await productsApi()).remove(trashing.id);
            void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
            notifySuccess('Product moved to trash');
          }}
        />
      ) : null}
    </>
  );
}
