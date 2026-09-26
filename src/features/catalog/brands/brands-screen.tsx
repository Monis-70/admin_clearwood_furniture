'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Plus, Tag } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
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
import { endpoints } from '@/lib/api/endpoints';
import { formatRelative } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { brandsApi, taxonomyKeys, type BrandRow } from '../taxonomy/api';

const BrandDialog = dynamic(() => import('./brand-dialog').then((m) => m.BrandDialog), {
  ssr: false,
});

export function BrandsScreen() {
  const { canCall } = usePermissions();
  if (!canCall(endpoints.brands.list))
    return <PermissionNotice area="brands" all={['catalog.product.read']} />;
  return <BrandsList />;
}

function BrandsList() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const params = useListParams<never>({
    filters: [],
    defaultSort: 'position',
    defaultOrder: 'asc',
  });
  const [editing, setEditing] = useState<BrandRow | 'new' | null>(null);
  const [removing, setRemoving] = useState<BrandRow | null>(null);
  const query = { page: params.page, limit: params.limit, ...(params.q ? { q: params.q } : {}) };
  const brands = useQuery({
    queryKey: taxonomyKeys.brandList(query),
    queryFn: ({ signal }) => brandsApi.list(query, signal),
    ...cachePolicy.list,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: taxonomyKeys.brands });
  const canEdit = canCall(endpoints.brands.update);

  const columns: DataTableColumn<BrandRow>[] = [
    {
      id: 'name',
      meta: { label: 'Brand', pinned: true, mobile: 'title' },
      header: 'Brand',
      cell: ({ row }) => (
        <span className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{row.original.slug}</span>
        </span>
      ),
    },
    {
      id: 'status',
      meta: { label: 'Status', mobile: 'detail' },
      header: 'Status',
      cell: ({ row }) => (
        <Badge tone={row.original.isActive ? 'success' : 'neutral'}>
          {row.original.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      id: 'position',
      meta: { label: 'Order', align: 'right', mobile: 'hidden' },
      header: 'Order',
      cell: ({ row }) => <span className="tabular">{row.original.position}</span>,
    },
    {
      id: 'products',
      meta: { label: 'Products', mobile: 'detail' },
      header: 'Products',
      cell: ({ row }) => (
        <Link
          className="text-sm underline-offset-2 hover:underline"
          href={`/catalog/products?brandId=${encodeURIComponent(row.original.id)}`}
        >
          View products
        </Link>
      ),
    },
    {
      id: 'updatedAt',
      meta: { label: 'Updated', mobile: 'hidden' },
      header: 'Updated',
      cell: ({ row }) => formatRelative(row.original.updatedAt),
    },
    {
      id: 'actions',
      meta: { label: 'Actions', align: 'right', mobile: 'detail' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) =>
        canEdit || canCall(endpoints.brands.remove) ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${row.original.name}`}
              >
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit ? (
                <DropdownMenuItem onSelect={() => setEditing(row.original)}>Edit</DropdownMenuItem>
              ) : null}
              {canCall(endpoints.brands.remove) ? (
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
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Brands"
        description="Brand names shown on products and used as a storefront filter."
        actions={
          canCall(endpoints.brands.create) ? (
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden />
              New brand
            </Button>
          ) : undefined
        }
      />
      <DataTable
        label="Brands"
        columns={columns}
        query={brands}
        getRowId={(row) => row.id}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="brands"
        filtered={Boolean(params.q)}
        toolbar={
          <SearchInput
            value={params.q}
            onSearch={params.setSearch}
            label="Search brands"
            minLength={1}
          />
        }
        empty={
          <EmptyState
            icon={Tag}
            title="No brands yet"
            description="Products work without a brand; add one when you sell under a label."
          />
        }
        emptyFiltered={
          <EmptyState
            title="No brand matches"
            action={
              <Button variant="outline" onClick={params.clearAll}>
                Clear search
              </Button>
            }
          />
        }
      />
      {editing ? (
        <BrandDialog
          brand={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            setEditing(null);
          }}
        />
      ) : null}
      {removing ? (
        <LazyConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setRemoving(null))}
          title={`Delete ${removing.name}?`}
          description="Only possible when no product uses it."
          confirmLabel="Delete brand"
          level="destructive"
          onConfirm={async () => {
            await brandsApi.remove(removing.id);
            refresh();
            notifySuccess('Brand deleted');
          }}
        />
      ) : null}
    </>
  );
}
