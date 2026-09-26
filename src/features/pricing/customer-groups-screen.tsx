'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Plus, Users } from 'lucide-react';
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
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { percent } from './lookups';
import { customerGroupsApi, promotionsKeys, type CustomerGroupRow } from './promotions-api';

const GroupDialog = dynamic(() => import('./customer-group-dialogs').then((m) => m.GroupDialog), {
  ssr: false,
});
const Members = dynamic(() => import('./customer-group-dialogs').then((m) => m.Members), {
  ssr: false,
});

export function CustomerGroupsScreen() {
  const { canCall } = usePermissions();
  if (!canCall(pricingRoutes.customerGroups)) {
    return <PermissionNotice area="customer groups" all={['order.customer.read']} />;
  }
  return <CustomerGroups />;
}

function CustomerGroups() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const params = useListParams<'id'>({
    filters: ['id'],
    defaultSort: 'priority',
    defaultOrder: 'desc',
  });
  const [editing, setEditing] = useState<CustomerGroupRow | 'new' | null>(null);
  const [removing, setRemoving] = useState<CustomerGroupRow | null>(null);
  const query = { page: params.page, limit: params.limit };
  const groups = useQuery({
    queryKey: promotionsKeys.groupList(query),
    queryFn: ({ signal }) => customerGroupsApi.list(query, signal),
    ...cachePolicy.list,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: promotionsKeys.groups });
  const canManage = canCall(pricingRoutes.updateCustomerGroup);
  const open = groups.data?.items.find((g) => g.id === params.filters.id);

  const columns: DataTableColumn<CustomerGroupRow>[] = [
    {
      id: 'name',
      meta: { label: 'Group', pinned: true, mobile: 'title' },
      header: 'Group',
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
      id: 'discount',
      meta: { label: 'Group discount', align: 'right', mobile: 'detail' },
      header: 'Group discount',
      cell: ({ row }) => <span className="tabular">{percent(row.original.discountBp)}</span>,
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
        <span className="flex flex-wrap gap-1">
          {row.original.isDefault ? <Badge tone="brand">Default</Badge> : null}
          <Badge tone={row.original.isActive ? 'success' : 'neutral'}>
            {row.original.isActive ? 'Active' : 'Off'}
          </Badge>
        </span>
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
              Members
            </DropdownMenuItem>
            {canManage ? (
              <DropdownMenuItem onSelect={() => setEditing(row.original)}>Edit</DropdownMenuItem>
            ) : null}
            {canCall(pricingRoutes.removeCustomerGroup) && !row.original.isDefault ? (
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
        title="Customer groups"
        description="Groups that receive their own prices: a group discount, price lists and tiers. Shoppers without a group are priced as the default group."
        actions={
          canCall(pricingRoutes.createCustomerGroup) ? (
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden />
              New group
            </Button>
          ) : undefined
        }
      />
      <DataTable
        label="Customer groups"
        columns={columns}
        query={groups}
        getRowId={(row) => row.id}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="customer-groups"
        empty={
          <EmptyState
            icon={Users}
            title="No customer groups"
            description="Create one, e.g. Trade partners."
          />
        }
      />
      {editing ? (
        <GroupDialog
          group={editing === 'new' ? null : editing}
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
          description="Its members are priced as the default group from now on. Its price lists and tiers stop applying."
          confirmLabel="Delete group"
          level="destructive"
          onConfirm={async () => {
            await customerGroupsApi.remove(removing.id);
            refresh();
            notifySuccess('Customer group deleted');
          }}
        />
      ) : null}
      {params.filters.id ? (
        <Sheet open onOpenChange={(o) => (o ? undefined : params.setFilter('id', null))}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
            <SheetHeader className="p-0">
              <SheetTitle>{open?.name ?? 'Customer group'}</SheetTitle>
              <SheetDescription>Members of this group</SheetDescription>
            </SheetHeader>
            <Members id={params.filters.id} canManage={canManage} />
          </SheetContent>
        </Sheet>
      ) : null}
    </>
  );
}
