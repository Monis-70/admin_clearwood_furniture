'use client';

import { useQuery } from '@tanstack/react-query';
import { MoreHorizontal, UserPlus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import type { AdminUserStatus } from '@shared/enums';
import type { AdminUserDto } from '@shared/types/auth';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { FilterSelect } from '@/components/patterns/data-table/filter-select';
import { SearchInput } from '@/components/patterns/data-table/search-input';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { GuardedButton } from '@/components/patterns/guarded-button';
import { PageHeader } from '@/components/patterns/page-header';
import { EmptyState, PermissionNotice } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { endpoints } from '@/lib/api/endpoints';
import { useCurrentAdmin } from '@/lib/auth/session';
import { formatDateTime, formatRelative } from '@/lib/format/datetime';
import { useRecentItems } from '@/lib/local-history';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import type { AdminUserDialog as Dialog } from './admin-user-dialog-host';
import { adminUserKeys, adminUsersApi, type AdminUserListQuery } from './api';
import { ADMIN_STATUS, ADMIN_STATUS_OPTIONS, manageBlock } from './model';

// Forms (Zod + React Hook Form) and the detail sheet load when first opened, not with the list.
const AdminUserDialogHost = dynamic(
  () => import('./admin-user-dialog-host').then((m) => m.AdminUserDialogHost),
  { ssr: false },
);
const AdminUserSheet = dynamic(() => import('./admin-user-sheet').then((m) => m.AdminUserSheet), {
  ssr: false,
});

function RowActions({
  user,
  open,
  onView,
}: {
  user: AdminUserDto;
  open(dialog: Dialog): void;
  onView(): void;
}) {
  const me = useCurrentAdmin();
  const { canCall } = usePermissions();
  const block = manageBlock(user, { id: me.user.id, roles: me.roles });
  const canUpdate = canCall(endpoints.users.update) && !block;
  const canRoles = canCall(endpoints.users.setRoles) && !block;
  const canDelete = canCall(endpoints.users.remove) && !block;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${user.name}`}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onSelect={onView}>View details and permissions</DropdownMenuItem>
        {block ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {block}
            </DropdownMenuLabel>
          </>
        ) : null}
        {canUpdate || canRoles ? <DropdownMenuSeparator /> : null}
        {canUpdate ? (
          <DropdownMenuItem onSelect={() => open({ kind: 'edit', user })}>
            Edit name or mobile
          </DropdownMenuItem>
        ) : null}
        {canRoles ? (
          <DropdownMenuItem onSelect={() => open({ kind: 'roles', user })}>
            Change roles
          </DropdownMenuItem>
        ) : canUpdate ? (
          <DropdownMenuItem disabled className="flex-col items-start gap-0">
            Change roles
            <span className="text-xs text-muted-foreground">
              Needs &lsquo;View roles and permissions&rsquo;.
            </span>
          </DropdownMenuItem>
        ) : null}
        {canUpdate ? (
          <DropdownMenuItem onSelect={() => open({ kind: 'password', user })}>
            Reset password
          </DropdownMenuItem>
        ) : null}
        {canUpdate ? (
          <>
            <DropdownMenuSeparator />
            {user.status === 'ACTIVE' ? (
              <>
                <DropdownMenuItem
                  onSelect={() => open({ kind: 'status', user, status: 'SUSPENDED' })}
                >
                  Suspend
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => open({ kind: 'status', user, status: 'DISABLED' })}
                >
                  Disable
                </DropdownMenuItem>
              </>
            ) : user.status === 'SUSPENDED' || user.status === 'DISABLED' ? (
              <DropdownMenuItem onSelect={() => open({ kind: 'status', user, status: 'ACTIVE' })}>
                Reactivate
              </DropdownMenuItem>
            ) : null}
          </>
        ) : null}
        {canDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => open({ kind: 'delete', user })}
            >
              Delete admin
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminUsersScreen() {
  const { canCall } = usePermissions();
  if (!canCall(endpoints.users.list)) {
    return <PermissionNotice area="admin users" all={['system.user.read']} />;
  }
  return <AdminUsersList />;
}

function AdminUsersList() {
  const params = useListParams<'status' | 'id' | 'new'>({ filters: ['status', 'id', 'new'] });
  const { canCall } = usePermissions();
  const { record } = useRecentItems();
  const creating = params.filters.new === '1' && canCall(endpoints.users.create);
  const setCreating = (open: boolean) => params.setFilter('new', open ? '1' : null);
  const [dialog, setOpenDialog] = useState<Dialog | null>(null);
  const [opened, setOpened] = useState(false);
  const setDialog = (next: Dialog | null) => {
    if (next) setOpened(true);
    setOpenDialog(next);
  };
  // Stays mounted once used, so dialogs can animate closed.
  const dialogsUsed = opened || creating || dialog !== null;

  const query: AdminUserListQuery = {
    page: params.page,
    limit: params.limit,
    sort: params.sort,
    order: params.order,
    search: params.q || undefined,
    status: params.filters.status as AdminUserStatus | undefined,
  };
  const users = useQuery({
    queryKey: adminUserKeys.list(query),
    queryFn: ({ signal }) => adminUsersApi.list(query, signal),
    ...cachePolicy.list,
  });

  const viewing = params.filters.id
    ? (users.data?.items.find((user) => user.id === params.filters.id) ?? null)
    : null;
  const notOnPage = Boolean(params.filters.id && users.data && !viewing);

  const recorded = useRef<string | null>(null);
  useEffect(() => {
    if (!viewing || recorded.current === viewing.id) return;
    recorded.current = viewing.id;
    record({
      key: `admin-user:${viewing.id}`,
      kind: 'Admin user',
      label: viewing.name,
      // There is no single-admin endpoint: the search brings the admin onto the first page.
      href: `/system/users?id=${encodeURIComponent(viewing.id)}&q=${encodeURIComponent(viewing.name)}`,
    });
  }, [viewing, record]);

  const columns: DataTableColumn<AdminUserDto>[] = [
    {
      id: 'name',
      meta: { label: 'Name', sortKey: 'name', pinned: true, mobile: 'title' },
      header: 'Name',
      cell: ({ row }) => (
        <button
          type="button"
          className="flex flex-col items-start rounded-sm text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={() => params.setFilter('id', row.original.id)}
        >
          <span className="font-medium text-foreground hover:underline">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">{row.original.email}</span>
        </button>
      ),
    },
    {
      id: 'roles',
      meta: { label: 'Roles', mobile: 'detail' },
      header: 'Roles',
      cell: ({ row }) => (
        <span className="flex flex-wrap gap-1">
          {row.original.roles.length > 0 ? (
            row.original.roles.map((role) => (
              <Badge key={role.id} tone="info">
                {role.name}
              </Badge>
            ))
          ) : (
            <Badge tone="warning">No role</Badge>
          )}
        </span>
      ),
    },
    {
      id: 'status',
      meta: { label: 'Status', sortKey: 'status', mobile: 'detail' },
      header: 'Status',
      cell: ({ row }) => (
        <span className="flex flex-wrap items-center gap-1">
          <StatusBadge status={row.original.status} registry={ADMIN_STATUS} />
          {row.original.mustChangePassword ? (
            <Badge tone="outline" title="Must choose a new password at next sign-in">
              Temporary password
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: 'lastLoginAt',
      meta: { label: 'Last sign-in', sortKey: 'lastLoginAt', mobile: 'detail' },
      header: 'Last sign-in',
      cell: ({ row }) =>
        row.original.lastLoginAt ? (
          <time
            dateTime={row.original.lastLoginAt}
            title={formatDateTime(row.original.lastLoginAt)}
          >
            {formatRelative(row.original.lastLoginAt)}
          </time>
        ) : (
          <span className="text-muted-foreground">Never</span>
        ),
    },
    {
      id: 'createdAt',
      meta: { label: 'Added', sortKey: 'createdAt', mobile: 'hidden' },
      header: 'Added',
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      id: 'actions',
      meta: { label: 'Actions', pinned: true, align: 'right', mobile: 'detail' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <RowActions
          user={row.original}
          open={setDialog}
          onView={() => params.setFilter('id', row.original.id)}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Admin users"
        description="Who can sign in to this admin, which roles they have, and whether their account is active. Every change is recorded in the audit log."
        actions={
          <GuardedButton endpoint={endpoints.users.create} onClick={() => setCreating(true)}>
            <UserPlus aria-hidden />
            Add admin
          </GuardedButton>
        }
      />

      {notOnPage ? (
        <p role="status" className="mb-3 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          The admin you opened is not in this list. Search by their name or email to find them.
        </p>
      ) : null}

      <DataTable
        label="Admin users"
        columns={columns}
        query={users}
        getRowId={(row) => row.id}
        sort={{ field: params.sort, order: params.order, onChange: params.setSort }}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="admin-users"
        filtered={params.activeFilterCount > 0}
        toolbar={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput
              value={params.q}
              onSearch={params.setSearch}
              label="Search by name or email"
              minLength={2}
            />
            <FilterSelect
              label="Status"
              value={params.filters.status}
              options={ADMIN_STATUS_OPTIONS}
              onChange={(value) => params.setFilter('status', value)}
            />
          </div>
        }
        empty={
          <EmptyState
            title="No admins yet"
            description="Add the people who run the store. Each gets their own sign-in."
          />
        }
        emptyFiltered={
          <EmptyState
            title="No admin matches these filters"
            description="Try a different name or email, or clear the filters."
            action={
              <Button variant="outline" onClick={params.clearAll}>
                Clear filters
              </Button>
            }
          />
        }
      />

      {viewing ? (
        <AdminUserSheet
          user={viewing}
          onOpenChange={(open) => (open ? undefined : params.setFilter('id', null))}
          actions={<RowActions user={viewing} open={setDialog} onView={() => undefined} />}
        />
      ) : null}

      {dialogsUsed ? (
        <AdminUserDialogHost
          creating={creating}
          setCreating={setCreating}
          dialog={dialog}
          close={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}
