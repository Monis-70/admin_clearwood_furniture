'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { FormAlert } from '@/components/patterns/form/form-alert';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { PageHeader } from '@/components/patterns/page-header';
import {
  EmptyState,
  ErrorState,
  PermissionNotice,
  SectionLoader,
} from '@/components/patterns/states';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { pricingRoutes } from '@/lib/api/routes/pricing';
import { formatDateTime } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import {
  CheckField,
  EditorForm,
  FieldGrid,
  NumberField,
  TextAreaField,
  TextField,
  intInput,
  optionalText,
  requiredInt,
  requiredText,
  textInput,
} from '../catalog/form-kit';
import { RecordDialog } from '../catalog/record-dialog';

import { bpInput, optionalPercentBp, percent } from './lookups';
import { customerGroupsApi, promotionsKeys, type CustomerGroupRow } from './promotions-api';

const schema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]{1,31}$/, 'Use UPPER_SNAKE_CASE, e.g. TRADE'),
  name: requiredText(2, 120, 'Name'),
  description: optionalText(500),
  isDefault: z.boolean(),
  priority: requiredInt(0, 10_000, 'Priority'),
  discountBp: optionalPercentBp('Group discount'),
  isActive: z.boolean(),
});
type Values = z.input<typeof schema>;

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

function GroupDialog({
  group,
  onClose,
  onSaved,
}: {
  group: CustomerGroupRow | null;
  onClose(): void;
  onSaved(): void;
}) {
  const keyFor = useIdempotencyKey();
  return (
    <RecordDialog title={group ? `Edit ${group.name}` : 'New customer group'} onClose={onClose}>
      <EditorForm
        schema={schema}
        defaultValues={{
          code: textInput(group?.code),
          name: textInput(group?.name),
          description: textInput(group?.description),
          isDefault: group?.isDefault ?? false,
          priority: intInput(group?.priority ?? 100),
          discountBp: bpInput(group?.discountBp),
          isActive: group?.isActive ?? true,
        }}
        successMessage={group ? 'Group saved' : 'Group created'}
        submitLabel={group ? 'Save changes' : 'Create group'}
        onSubmit={async ({ code, ...values }) => {
          if (group)
            await customerGroupsApi.update(group.id, { ...values, version: group.version });
          else {
            const input = { ...values, code };
            await customerGroupsApi.create(input, keyFor(input));
          }
          onSaved();
        }}
      >
        <FieldGrid>
          <TextField<Values> name="name" label="Name" required />
          {group ? null : <TextField<Values> name="code" label="Code" required />}
        </FieldGrid>
        <TextAreaField<Values> name="description" label="Description" rows={2} />
        <FieldGrid>
          <TextField<Values>
            name="discountBp"
            label="Group discount"
            prefix="%"
            inputMode="decimal"
            description="Applied by the pricing engine; empty for none."
          />
          <NumberField<Values>
            name="priority"
            label="Priority"
            required
            description="A customer in several groups gets the highest."
          />
        </FieldGrid>
        <FieldGrid>
          <CheckField<Values>
            name="isDefault"
            label="Default group"
            description="Guests and ungrouped customers. Only one group can be the default."
          />
          <CheckField<Values> name="isActive" label="Active" />
        </FieldGrid>
      </EditorForm>
    </RecordDialog>
  );
}

const ID = /^[a-z0-9]{20,40}$/i;

function Members({ id, canManage }: { id: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const members = useQuery({
    queryKey: promotionsKeys.members(id),
    queryFn: ({ signal }) => customerGroupsApi.members(id, signal),
    ...cachePolicy.list,
  });
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const ids = [
    ...new Set(
      text
        .split(/[\s,]+/)
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
  const invalid = ids.filter((v) => !ID.test(v));
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: promotionsKeys.members(id) });
  const add = useMutation({
    mutationFn: () => customerGroupsApi.addMembers(id, ids),
    onSuccess: ({ added }) => {
      setText('');
      refresh();
      notifySuccess(`${added} customer${added === 1 ? '' : 's'} added`);
    },
  });

  return (
    <div className="mt-4 flex flex-col gap-4">
      <Alert tone="info" title="Customers are added by their ID">
        The admin has no customer directory yet, so members are added by customer ID (shown on
        orders and carts).
      </Alert>
      {canManage ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="member-ids">Add customers</Label>
          <Textarea
            id="member-ids"
            rows={3}
            value={text}
            placeholder="One customer ID per line"
            aria-invalid={invalid.length > 0}
            onChange={(e) => setText(e.target.value)}
          />
          {invalid.length > 0 ? (
            <p className="text-sm text-destructive">
              Not a customer ID: {invalid.slice(0, 3).join(', ')}
            </p>
          ) : null}
          <FormAlert error={add.error} />
          <Button
            className="w-fit"
            size="sm"
            disabled={ids.length === 0 || invalid.length > 0 || ids.length > 500}
            loading={add.isPending}
            onClick={() => add.mutate()}
          >
            Add {ids.length || ''} customer{ids.length === 1 ? '' : 's'}
          </Button>
        </div>
      ) : null}
      {members.isPending ? (
        <SectionLoader label="Loading members…" />
      ) : members.error ? (
        <ErrorState error={members.error} onRetry={() => void members.refetch()} compact />
      ) : members.data.length === 0 ? (
        <EmptyState title="No members yet" compact />
      ) : (
        <>
          <ul className="flex flex-col divide-y rounded-md border text-sm" aria-label="Members">
            {members.data.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                {canManage ? (
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    aria-label={`Select customer ${m.customerId}`}
                    checked={selected.has(m.customerId)}
                    onChange={(e) =>
                      setSelected((all) => {
                        const next = new Set(all);
                        if (e.target.checked) next.add(m.customerId);
                        else next.delete(m.customerId);
                        return next;
                      })
                    }
                  />
                ) : null}
                <span className="font-mono">{m.customerId}</span>
                <span className="ml-auto text-muted-foreground">
                  {formatDateTime(m.assignedAt)}
                </span>
              </li>
            ))}
          </ul>
          {members.data.length >= 500 ? (
            <p className="text-xs text-muted-foreground">
              Showing the 500 most recently added members.
            </p>
          ) : null}
          {canManage ? (
            <Button
              variant="outline"
              className="w-fit"
              size="sm"
              disabled={selected.size === 0}
              onClick={() => setConfirming(true)}
            >
              Remove {selected.size || ''} selected
            </Button>
          ) : null}
        </>
      )}
      {confirming ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setConfirming(false))}
          title={`Remove ${selected.size} customer${selected.size === 1 ? '' : 's'} from the group?`}
          description="They are priced as the default group (or their other groups) from now on."
          confirmLabel="Remove from group"
          level="destructive"
          onConfirm={async () => {
            const { removed } = await customerGroupsApi.removeMembers(id, [...selected]);
            setSelected(new Set());
            refresh();
            notifySuccess(`${removed} removed`);
          }}
        />
      ) : null}
    </div>
  );
}
