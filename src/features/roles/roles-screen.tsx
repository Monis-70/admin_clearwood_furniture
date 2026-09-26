'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import type { RoleDto } from '@shared/types/auth';

import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { GuardedButton } from '@/components/patterns/guarded-button';
import { PageHeader } from '@/components/patterns/page-header';
import {
  EmptyState,
  ErrorState,
  NotFoundState,
  PermissionNotice,
  SectionLoader,
} from '@/components/patterns/states';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/surface';
import { rolesRoutes } from '@/lib/api/routes/roles';
import { isApiError } from '@/lib/api/errors';
import { useRecentItems } from '@/lib/local-history';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';

import { roleKeys, rolesApi } from './api';
import { PermissionMatrix } from './permission-matrix';
import { usePermissionRegistry, useRole, useRoles } from './queries';

// Zod + React Hook Form load only when a role is created or edited.
const RoleEditorDialog = dynamic(
  () => import('./role-editor-dialog').then((m) => m.RoleEditorDialog),
  { ssr: false },
);

function RoleBadges({ role }: { role: RoleDto }) {
  return (
    <span className="flex flex-wrap gap-1">
      <Badge tone={role.isSystem ? 'neutral' : 'info'}>
        {role.isSystem ? 'Built-in' : 'Custom'}
      </Badge>
      {role.isActive ? null : <Badge tone="warning">Inactive</Badge>}
    </span>
  );
}

export function RolesScreen() {
  const { canCall } = usePermissions();
  const id = useSearchParams().get('id');
  if (!canCall(rolesRoutes.list)) {
    return <PermissionNotice area="roles and permissions" all={['system.role.read']} />;
  }
  return id ? <RoleDetail id={id} /> : <RolesList />;
}

function RolesList() {
  const roles = useRoles();
  const router = useRouter();
  const params = useSearchParams();
  const { canCall } = usePermissions();
  const creating = params.get('new') === '1' && canCall(rolesRoutes.create);
  const setCreating = (open: boolean) =>
    router.replace(open ? '/system/roles?new=1' : '/system/roles', { scroll: false });

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        description="A role is a named set of permissions. Every admin gets one or more roles; the server checks their permissions on every action."
        actions={
          <GuardedButton endpoint={rolesRoutes.create} onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            New role
          </GuardedButton>
        }
      />
      {roles.isPending ? (
        <SectionLoader label="Loading roles…" />
      ) : roles.error ? (
        <ErrorState error={roles.error} onRetry={() => void roles.refetch()} />
      ) : roles.data.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No roles"
          description="Roles are created by the seed."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {roles.data.map((role) => (
            <li key={role.id}>
              <Link
                href={`/system/roles?id=${encodeURIComponent(role.id)}`}
                className="flex h-full flex-col gap-2 rounded-lg border bg-card p-4 shadow-card transition-colors hover:border-input hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold">{role.name}</span>
                  <RoleBadges role={role} />
                </span>
                <span className="font-mono text-xs text-muted-foreground">{role.code}</span>
                <span className="text-sm text-muted-foreground">
                  {role.description ?? 'No description.'}
                </span>
                <span className="mt-auto text-sm font-medium">
                  {role.permissionCount} permission{role.permissionCount === 1 ? '' : 's'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {creating ? (
        <RoleEditorDialog
          open
          onOpenChange={setCreating}
          onSaved={(role) => router.push(`/system/roles?id=${encodeURIComponent(role.id)}`)}
        />
      ) : null}
    </>
  );
}

function RoleDetail({ id }: { id: string }) {
  const role = useRole(id);
  const registry = usePermissionRegistry();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { record } = useRecentItems();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const recorded = useRef<string | null>(null);

  useEffect(() => {
    if (!role.data || recorded.current === role.data.id) return;
    recorded.current = role.data.id;
    record({
      key: `role:${role.data.id}`,
      kind: 'Role',
      label: role.data.name,
      href: `/system/roles?id=${encodeURIComponent(role.data.id)}`,
    });
  }, [role.data, record]);

  const remove = useMutation({ mutationFn: () => rolesApi.remove(id) });

  const back = (
    <Link href="/system/roles" className="inline-flex items-center gap-1 hover:text-foreground">
      <ArrowLeft aria-hidden className="size-4" />
      All roles
    </Link>
  );

  if (role.isPending) return <SectionLoader label="Loading role…" />;
  if (role.error) {
    if (isApiError(role.error) && role.error.status === 404) {
      return (
        <NotFoundState title="Role not found" backHref="/system/roles" backLabel="All roles" />
      );
    }
    return <ErrorState error={role.error} onRetry={() => void role.refetch()} />;
  }

  const data = role.data;
  const granted = new Set(data.permissions ?? []);
  const isSuper = data.code === 'SUPER_ADMIN';
  if (isSuper && registry.data) {
    for (const list of Object.values(registry.data)) for (const p of list) granted.add(p.code);
  }

  return (
    <>
      <PageHeader
        eyebrow={back}
        title={data.name}
        status={<RoleBadges role={data} />}
        description={data.description ?? undefined}
        actions={
          <>
            <GuardedButton
              variant="outline"
              endpoint={rolesRoutes.update}
              unavailableReason={
                isSuper
                  ? 'Super Admin always allows everything; there is nothing to edit.'
                  : undefined
              }
              onClick={() => setEditing(true)}
            >
              <Pencil aria-hidden />
              Edit
            </GuardedButton>
            {data.isSystem ? null : (
              <GuardedButton
                variant="outline"
                endpoint={rolesRoutes.remove}
                onClick={() => setDeleting(true)}
              >
                <Trash2 aria-hidden />
                Delete
              </GuardedButton>
            )}
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>What this role allows</CardTitle>
          <CardDescription>
            <span className="font-mono">{data.code}</span> ·{' '}
            {isSuper ? 'every permission' : `${granted.size} permissions`}
            {isSuper ? ', including ones added in future releases' : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {registry.isPending ? (
            <SectionLoader label="Loading permissions…" />
          ) : registry.error ? (
            <ErrorState error={registry.error} onRetry={() => void registry.refetch()} compact />
          ) : (
            <PermissionMatrix mode="view" registry={registry.data} granted={granted} />
          )}
        </CardContent>
      </Card>

      {data.isActive ? null : (
        <Alert tone="warning" title="Inactive role" className="mt-4">
          It cannot be given to anyone new. Admins who already have it keep its permissions.
        </Alert>
      )}

      {editing ? <RoleEditorDialog role={data} open onOpenChange={setEditing} /> : null}
      {deleting ? (
        <LazyConfirmDialog
          open
          onOpenChange={setDeleting}
          title={`Delete the role ${data.name}?`}
          description={
            <p>
              Only a custom role that no admin holds can be deleted. This cannot be undone. To stop
              using it without deleting it, make it inactive instead.
            </p>
          }
          confirmLabel="Delete role"
          level="irreversible"
          confirmText={data.code}
          onConfirm={async () => {
            await remove.mutateAsync();
            notifySuccess('Role deleted', data.name);
            queryClient.removeQueries({ queryKey: roleKeys.detail(id) });
            await queryClient.invalidateQueries({ queryKey: roleKeys.list() });
            router.replace('/system/roles');
          }}
        />
      ) : null}
    </>
  );
}
