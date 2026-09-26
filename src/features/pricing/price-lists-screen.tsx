'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, MoreHorizontal, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { pricingRoutes } from '@/lib/api/routes/pricing';
import { formatDate } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { CHANNEL_LABELS, useCustomerGroupOptions } from './lookups';
import { rulesApi, rulesKeys, type PriceListRow } from './rules-api';

const PriceListDialog = dynamic(
  () => import('./price-list-dialogs').then((m) => m.PriceListDialog),
  { ssr: false },
);
const PriceListItems = dynamic(() => import('./price-list-dialogs').then((m) => m.PriceListItems), {
  ssr: false,
});

const TierPricesPanel = dynamic(
  () => import('./tier-prices-panel').then((m) => m.TierPricesPanel),
  {
    ssr: false,
  },
);

const windowText = (row: Pick<PriceListRow, 'startsAt' | 'endsAt'>) =>
  row.startsAt || row.endsAt
    ? `${row.startsAt ? formatDate(row.startsAt) : 'Now'} – ${row.endsAt ? formatDate(row.endsAt) : 'no end'}`
    : 'Always';

export function PriceListsScreen() {
  const { canCall } = usePermissions();
  if (!canCall(pricingRoutes.priceLists)) {
    return <PermissionNotice area="price lists" all={['pricing.adjustment.read']} />;
  }
  return <PriceLists />;
}

function PriceLists() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const params = useListParams<'id'>({
    filters: ['id'],
    defaultSort: 'priority',
    defaultOrder: 'desc',
  });
  const groups = useCustomerGroupOptions();
  const [editing, setEditing] = useState<PriceListRow | 'new' | null>(null);
  const [removing, setRemoving] = useState<PriceListRow | null>(null);
  const query = { page: params.page, limit: params.limit };
  const lists = useQuery({
    queryKey: rulesKeys.priceLists(query),
    queryFn: ({ signal }) => rulesApi.priceLists(query, signal),
    ...cachePolicy.list,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: rulesKeys.all });
  const groupName = new Map((groups.data ?? []).map((g) => [g.id, g.name]));
  const open = params.filters.id ? lists.data?.items.find((l) => l.id === params.filters.id) : null;

  const columns: DataTableColumn<PriceListRow>[] = [
    {
      id: 'name',
      meta: { label: 'Price list', pinned: true, mobile: 'title' },
      header: 'Price list',
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
      id: 'audience',
      meta: { label: 'Who gets it', mobile: 'detail' },
      header: 'Who gets it',
      cell: ({ row }) =>
        `${row.original.customerGroupId ? (groupName.get(row.original.customerGroupId) ?? 'A customer group') : 'Everyone'} · ${CHANNEL_LABELS[row.original.channel] ?? row.original.channel}`,
    },
    {
      id: 'window',
      meta: { label: 'When', mobile: 'detail' },
      header: 'When',
      cell: ({ row }) => windowText(row.original),
    },
    {
      id: 'priority',
      meta: { label: 'Priority', align: 'right', mobile: 'detail' },
      header: 'Priority',
      cell: ({ row }) => <span className="tabular">{row.original.priority}</span>,
    },
    {
      id: 'status',
      meta: { label: 'Status', mobile: 'detail' },
      header: 'Status',
      cell: ({ row }) => (
        <Badge tone={row.original.isActive ? 'success' : 'neutral'}>
          {row.original.isActive ? 'Active' : 'Off'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      meta: { label: 'Actions', align: 'right', mobile: 'detail' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.name}`}>
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => params.setFilter('id', row.original.id)}>
              Prices
            </DropdownMenuItem>
            {canCall(pricingRoutes.updatePriceList) ? (
              <DropdownMenuItem onSelect={() => setEditing(row.original)}>Edit</DropdownMenuItem>
            ) : null}
            {canCall(pricingRoutes.removePriceList) ? (
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
        title="Price lists & tiers"
        description="Special prices for a customer group or channel, and quantity breaks. The pricing engine chooses which price applies at checkout."
        actions={
          canCall(pricingRoutes.createPriceList) ? (
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden />
              New price list
            </Button>
          ) : undefined
        }
      />
      <DataTable
        label="Price lists"
        columns={columns}
        query={lists}
        getRowId={(row) => row.id}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="price-lists"
        empty={
          <EmptyState
            icon={ClipboardList}
            title="No price lists"
            description="Create one to give a group or channel its own prices."
          />
        }
      />
      <div className="mt-8">
        <TierPricesPanel />
      </div>
      {editing ? (
        <PriceListDialog
          list={editing === 'new' ? null : editing}
          groups={(groups.data ?? []).map((g) => ({ value: g.id, label: g.name }))}
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
          onOpenChange={(o) => (o ? undefined : setRemoving(null))}
          title={`Delete ${removing.name}?`}
          description="Its prices stop applying at checkout immediately."
          confirmLabel="Delete price list"
          level="destructive"
          onConfirm={async () => {
            await rulesApi.removePriceList(removing.id);
            refresh();
            notifySuccess('Price list deleted');
          }}
        />
      ) : null}
      {params.filters.id ? (
        <Sheet open onOpenChange={(o) => (o ? undefined : params.setFilter('id', null))}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
            <SheetHeader className="p-0">
              <SheetTitle>{open?.name ?? 'Price list'}</SheetTitle>
              <SheetDescription>
                {open ? `${open.code} · ${windowText(open)}` : 'Prices in this list'}
              </SheetDescription>
            </SheetHeader>
            <PriceListItems id={params.filters.id} />
          </SheetContent>
        </Sheet>
      ) : null}
    </>
  );
}
