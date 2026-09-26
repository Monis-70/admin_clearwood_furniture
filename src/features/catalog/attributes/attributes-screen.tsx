'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListChecks, MoreHorizontal, Plus } from 'lucide-react';
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
import { attributesRoutes } from '@/lib/api/routes/attributes';
import { formatNumber } from '@/lib/format/datetime';
import { notifyError, notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { useAttributeGroups } from '../lookups';
import { attributesApi, taxonomyKeys, type AttributeRow } from '../taxonomy/api';

import { INPUT_LABELS } from './model';

const AttributeEditor = dynamic(() => import('./attribute-editor').then((m) => m.AttributeEditor), {
  ssr: false,
});
const GroupsDialog = dynamic(() => import('./groups-dialog').then((m) => m.GroupsDialog), {
  ssr: false,
});

const FILTERS = ['id', 'groupId', 'isVariantDefining'] as const;
type Filter = (typeof FILTERS)[number];
const YES_NO = [
  { value: 'true', label: 'Variant options' },
  { value: 'false', label: 'Descriptive only' },
];

export function AttributesScreen() {
  const { canCall } = usePermissions();
  if (!canCall(attributesRoutes.list))
    return <PermissionNotice area="attributes" all={['catalog.attribute.read']} />;
  return <Attributes />;
}

function Attributes() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const params = useListParams<Filter>({
    filters: FILTERS,
    defaultSort: 'position',
    defaultOrder: 'asc',
  });
  const f = params.filters;
  const groups = useAttributeGroups();
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [removing, setRemoving] = useState<AttributeRow | null>(null);
  const query = {
    page: params.page,
    limit: params.limit,
    sort: params.sort,
    order: params.order,
    ...(params.q ? { q: params.q } : {}),
    ...(f.groupId ? { groupId: f.groupId } : {}),
    ...(f.isVariantDefining ? { isVariantDefining: f.isVariantDefining === 'true' } : {}),
  };
  const attributes = useQuery({
    queryKey: taxonomyKeys.attributeList(query),
    queryFn: ({ signal }) => attributesApi.list(query, signal),
    ...cachePolicy.list,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: taxonomyKeys.attributes });
  const groupName = new Map((groups.data ?? []).map((g) => [g.id, g.name]));
  const filtered = Boolean(params.q || f.groupId || f.isVariantDefining);
  // Order is only meaningful on the unfiltered list sorted by position.
  const canReorder =
    canCall(attributesRoutes.reorder) &&
    !filtered &&
    params.sort === 'position' &&
    params.order === 'asc';

  const move = useMutation({
    mutationFn: async ({ index, by }: { index: number; by: -1 | 1 }) => {
      const rows = [...(attributes.data?.items ?? [])];
      const [row] = rows.splice(index, 1);
      rows.splice(index + by, 0, row!);
      const offset = (params.page - 1) * params.limit;
      await attributesApi.reorder(rows.map((r, i) => ({ id: r.id, position: offset + i })));
    },
    onSuccess: refresh,
    onError: (error) => notifyError(error, 'Could not reorder'),
  });

  const columns: DataTableColumn<AttributeRow>[] = [
    {
      id: 'name',
      meta: { label: 'Attribute', sortKey: 'name', pinned: true, mobile: 'title' },
      header: 'Attribute',
      cell: ({ row }) => (
        <button
          type="button"
          className="flex flex-col text-left"
          onClick={() => params.setFilter('id', row.original.id)}
        >
          <span className="font-medium hover:underline">{row.original.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{row.original.code}</span>
        </button>
      ),
    },
    {
      id: 'group',
      meta: { label: 'Group', mobile: 'detail' },
      header: 'Group',
      cell: ({ row }) =>
        row.original.groupId ? (groupName.get(row.original.groupId) ?? '—') : '—',
    },
    {
      id: 'input',
      meta: { label: 'Input', mobile: 'detail' },
      header: 'Input',
      cell: ({ row }) => INPUT_LABELS[row.original.inputType] ?? row.original.inputType,
    },
    {
      id: 'flags',
      meta: { label: 'Used as', mobile: 'detail' },
      header: 'Used as',
      cell: ({ row }) => (
        <span className="flex flex-wrap gap-1">
          {row.original.isVariantDefining ? <Badge tone="brand">Variant option</Badge> : null}
          {row.original.isFilterable ? <Badge tone="info">Filter</Badge> : null}
          {row.original.isRequired ? <Badge tone="warning">Required</Badge> : null}
          {!row.original.isActive ? <Badge tone="neutral">Inactive</Badge> : null}
        </span>
      ),
    },
    {
      id: 'values',
      meta: { label: 'Values', align: 'right', mobile: 'detail' },
      header: 'Values',
      cell: ({ row }) => (
        <span className="tabular">{formatNumber(row.original.values?.length ?? 0)}</span>
      ),
    },
    {
      id: 'position',
      meta: { label: 'Order', sortKey: 'position', align: 'right', mobile: 'hidden' },
      header: 'Order',
      cell: ({ row }) => <span className="tabular">{row.original.position}</span>,
    },
    {
      id: 'actions',
      meta: { label: 'Actions', align: 'right', mobile: 'detail' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const items = attributes.data?.items ?? [];
        return (
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
              <DropdownMenuItem onSelect={() => params.setFilter('id', row.original.id)}>
                {canCall(attributesRoutes.update) ? 'Edit and values' : 'View values'}
              </DropdownMenuItem>
              {canReorder ? (
                <>
                  <DropdownMenuItem
                    disabled={row.index === 0}
                    onSelect={() => move.mutate({ index: row.index, by: -1 })}
                  >
                    Move up
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={row.index === items.length - 1}
                    onSelect={() => move.mutate({ index: row.index, by: 1 })}
                  >
                    Move down
                  </DropdownMenuItem>
                </>
              ) : null}
              {canCall(attributesRoutes.remove) ? (
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
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Attributes"
        description="Specifications (material, finish, seating) and the options variants are made of."
        actions={
          <>
            {canCall(attributesRoutes.groups) ? (
              <Button variant="outline" onClick={() => setGroupsOpen(true)}>
                Groups
              </Button>
            ) : null}
            {canCall(attributesRoutes.create) ? (
              <Button onClick={() => params.setFilter('id', 'new')}>
                <Plus aria-hidden />
                New attribute
              </Button>
            ) : null}
          </>
        }
      />
      <DataTable
        label="Attributes"
        columns={columns}
        query={attributes}
        getRowId={(row) => row.id}
        sort={{ field: params.sort, order: params.order, onChange: params.setSort }}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="attributes"
        filtered={filtered}
        toolbar={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput
              value={params.q}
              onSearch={params.setSearch}
              label="Search attributes"
              minLength={1}
            />
            <FilterSelect
              label="Group"
              value={f.groupId}
              options={(groups.data ?? []).map((g) => ({ value: g.id, label: g.name }))}
              onChange={(v) => params.setFilter('groupId', v)}
            />
            <FilterSelect
              label="Kind"
              value={f.isVariantDefining}
              options={YES_NO}
              onChange={(v) => params.setFilter('isVariantDefining', v)}
            />
          </div>
        }
        empty={
          <EmptyState
            icon={ListChecks}
            title="No attributes yet"
            description="Create attributes such as Material or Seating, then add their values."
          />
        }
        emptyFiltered={
          <EmptyState
            title="No attribute matches"
            action={
              <Button variant="outline" onClick={params.clearAll}>
                Clear filters
              </Button>
            }
          />
        }
      />
      {f.id ? (
        <AttributeEditor
          id={f.id === 'new' ? null : f.id}
          groups={groups.data ?? []}
          onClose={() => params.setFilter('id', null)}
          onCreated={(id) => params.setFilter('id', id)}
        />
      ) : null}
      {groupsOpen ? <GroupsDialog onClose={() => setGroupsOpen(false)} /> : null}
      {removing ? (
        <LazyConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setRemoving(null))}
          title={`Delete ${removing.name}?`}
          description="Refused while products or categories still use it."
          confirmLabel="Delete attribute"
          level="destructive"
          onConfirm={async () => {
            await attributesApi.remove(removing.id);
            refresh();
            notifySuccess('Attribute deleted');
          }}
        />
      ) : null}
    </>
  );
}
