'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, MoreHorizontal, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { FilterSelect } from '@/components/patterns/data-table/filter-select';
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
import { catalogRoutes } from '@/lib/api/routes/catalog';
import { collectionsRoutes } from '@/lib/api/routes/collections';
import { formatNumber, formatRelative } from '@/lib/format/datetime';
import { notifyError, notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { catalogKeys } from '../api';

import { collectionKeys, collectionsApi, type CollectionDetail } from './api';

import { collectionHref, scheduleText } from './model';

const FILTERS = ['includeDeleted'] as const;

export function CollectionsScreen() {
  const { canCall } = usePermissions();
  if (!canCall(catalogRoutes.collections)) {
    return <PermissionNotice area="collections" all={['catalog.collection.read']} />;
  }
  return <CollectionsList />;
}

function CollectionsList() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const params = useListParams<(typeof FILTERS)[number]>({
    filters: FILTERS,
    defaultSort: 'position',
    defaultOrder: 'asc',
  });
  const [removing, setRemoving] = useState<CollectionDetail | null>(null);
  const query = {
    page: params.page,
    limit: params.limit,
    sort: params.sort,
    order: params.order,
    ...(params.filters.includeDeleted ? { includeDeleted: true } : {}),
  };
  const rows = useQuery({
    queryKey: [...collectionKeys.all, 'list', query],
    queryFn: ({ signal }) => collectionsApi.list(query, signal),
    ...cachePolicy.list,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: collectionKeys.all });
    void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
  };

  const columns: DataTableColumn<CollectionDetail>[] = [
    {
      id: 'name',
      meta: { label: 'Collection', sortKey: 'name', pinned: true, mobile: 'title' },
      header: 'Collection',
      cell: ({ row }) => (
        <span className="flex flex-col">
          {row.original.deletedAt ? (
            <span className="font-medium text-muted-foreground line-through">
              {row.original.name}
            </span>
          ) : (
            <Link href={collectionHref(row.original.id)} className="font-medium hover:underline">
              {row.original.name}
            </Link>
          )}
          <span className="text-xs text-muted-foreground">/{row.original.slug}</span>
        </span>
      ),
    },
    {
      id: 'type',
      meta: { label: 'Type', mobile: 'detail' },
      header: 'Type',
      cell: ({ row }) =>
        row.original.type === 'AUTOMATIC' ? (
          <Badge tone="info">Automatic (rules)</Badge>
        ) : (
          <Badge tone="neutral">Manual</Badge>
        ),
    },
    {
      id: 'status',
      meta: { label: 'Status', mobile: 'detail' },
      header: 'Status',
      cell: ({ row }) =>
        row.original.deletedAt ? (
          <Badge tone="danger">Deleted</Badge>
        ) : row.original.isActive ? (
          <Badge tone="success">Active</Badge>
        ) : (
          <Badge tone="warning">Inactive</Badge>
        ),
    },
    {
      id: 'products',
      meta: { label: 'Products', align: 'right', mobile: 'detail' },
      header: 'Products',
      cell: ({ row }) => (
        <span className="tabular">{formatNumber(row.original.evaluatedCount)}</span>
      ),
    },
    {
      id: 'schedule',
      meta: { label: 'Shown', mobile: 'detail' },
      header: 'Shown',
      cell: ({ row }) => scheduleText(row.original),
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
        const c = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`}>
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {c.deletedAt ? (
                canCall(collectionsRoutes.restore) ? (
                  <DropdownMenuItem
                    onSelect={() =>
                      void collectionsApi
                        .restore(c.id)
                        .then(() => {
                          refresh();
                          notifySuccess('Collection restored');
                        })
                        .catch((error: unknown) => notifyError(error, 'Could not restore'))
                    }
                  >
                    Restore
                  </DropdownMenuItem>
                ) : null
              ) : (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={collectionHref(c.id)}>Open</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href={collectionHref(c.id, c.type === 'AUTOMATIC' ? 'rules' : 'products')}
                    >
                      {c.type === 'AUTOMATIC' ? 'Edit rules' : 'Choose products'}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/catalog/products?collectionId=${encodeURIComponent(c.id)}`}>
                      View products
                    </Link>
                  </DropdownMenuItem>
                  {canCall(collectionsRoutes.remove) ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setRemoving(c)}
                      >
                        Delete…
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Collections"
        description="Hand-picked and rule-based groups of products shown on the storefront, such as New Arrivals."
        actions={
          canCall(collectionsRoutes.create) ? (
            <Button asChild>
              <Link href="/catalog/collections/new">
                <Plus aria-hidden />
                New collection
              </Link>
            </Button>
          ) : undefined
        }
      />
      <DataTable
        label="Collections"
        columns={columns}
        query={rows}
        getRowId={(row) => row.id}
        sort={{ field: params.sort, order: params.order, onChange: params.setSort }}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="collections"
        filtered={params.activeFilterCount > 0}
        toolbar={
          <FilterSelect
            label="Trash"
            value={params.filters.includeDeleted}
            options={[{ value: 'true', label: 'Include deleted' }]}
            onChange={(v) => params.setFilter('includeDeleted', v)}
          />
        }
        empty={
          <EmptyState
            icon={Layers}
            title="No collections yet"
            description="Group products by hand, or let rules pick them."
          />
        }
      />
      {removing ? (
        <LazyConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setRemoving(null))}
          title={`Delete ${removing.name}?`}
          description="It leaves the storefront. Restore it from the Trash filter."
          confirmLabel="Delete collection"
          level="destructive"
          onConfirm={async () => {
            await collectionsApi.remove(removing.id);
            refresh();
            notifySuccess('Collection deleted');
          }}
        />
      ) : null}
    </>
  );
}
