'use client';

import { useMemo } from 'react';

import type { AdminUserDto } from '@shared/types/auth';

import { KeyValueList } from '@/components/patterns/key-value-list';
import { StatusBadge } from '@/components/patterns/status-badge';
import { ErrorState, PermissionNotice, SectionLoader } from '@/components/patterns/states';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { endpoints } from '@/lib/api/endpoints';
import { formatDateTime, formatRelative } from '@/lib/format/datetime';
import { usePermissions } from '@/lib/permissions/use-permissions';

import { EntityHistory } from '../audit/entity-history';
import { PermissionMatrix } from '../roles/permission-matrix';
import { usePermissionRegistry, useRoleDetails } from '../roles/queries';

import { ADMIN_STATUS, isSuperAdmin } from './model';

function EffectivePermissions({ user }: { user: AdminUserDto }) {
  const { canCall } = usePermissions();
  const roleIds = useMemo(() => user.roles.map((role) => role.id), [user.roles]);
  const details = useRoleDetails(roleIds);
  const registry = usePermissionRegistry();

  if (!canCall(endpoints.roles.get)) {
    return <PermissionNotice area="what each role allows" all={['system.role.read']} compact />;
  }
  if (user.roles.length === 0) {
    return (
      <Alert tone="warning" title="No role">
        This admin can sign in but do nothing yet.
      </Alert>
    );
  }
  const failed = details.find((query) => query.error)?.error ?? registry.error;
  if (failed) return <ErrorState error={failed} compact />;
  const catalog = registry.data;
  if (!catalog || details.some((query) => query.isPending)) {
    return <SectionLoader label="Loading permissions…" />;
  }

  const granted = new Set<string>();
  const superAdmin = isSuperAdmin(user);
  for (const query of details) for (const code of query.data?.permissions ?? []) granted.add(code);
  if (superAdmin)
    for (const list of Object.values(catalog)) for (const p of list) granted.add(p.code);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {superAdmin
          ? 'Super Admin allows everything, including permissions added in future releases.'
          : `Everything their ${user.roles.length === 1 ? 'role allows' : 'roles allow together'}. The server checks these on every action.`}
      </p>
      <PermissionMatrix mode="view" registry={catalog} granted={granted} />
    </div>
  );
}

export function AdminUserSheet({
  user,
  onOpenChange,
  actions,
}: {
  user: AdminUserDto | null;
  onOpenChange(open: boolean): void;
  actions?: React.ReactNode;
}) {
  return (
    <Sheet open={Boolean(user)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        {user ? (
          <>
            <SheetHeader className="border-b">
              <SheetTitle className="flex flex-wrap items-center gap-2">
                {user.name}
                <StatusBadge status={user.status} registry={ADMIN_STATUS} />
              </SheetTitle>
              <SheetDescription>{user.email}</SheetDescription>
              {actions ? <div className="flex flex-wrap gap-2 pt-2">{actions}</div> : null}
            </SheetHeader>
            <Tabs defaultValue="details" className="p-4">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="permissions">Permissions</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="flex flex-col gap-4 pt-4">
                {user.mustChangePassword ? (
                  <Alert tone="info" title="Temporary password">
                    They must choose their own password the next time they sign in.
                  </Alert>
                ) : null}
                <KeyValueList
                  items={[
                    { label: 'Email', value: user.email },
                    { label: 'Mobile', value: user.phone ?? '—' },
                    {
                      label: 'Roles',
                      value: (
                        <span className="flex flex-wrap gap-1">
                          {user.roles.length > 0
                            ? user.roles.map((role) => (
                                <Badge key={role.id} tone="info">
                                  {role.name}
                                </Badge>
                              ))
                            : 'None'}
                        </span>
                      ),
                    },
                    {
                      label: 'Last sign-in',
                      value: user.lastLoginAt
                        ? `${formatRelative(user.lastLoginAt)} (${formatDateTime(user.lastLoginAt)})`
                        : 'Never',
                    },
                    { label: 'Added', value: formatDateTime(user.createdAt) },
                  ]}
                />
              </TabsContent>
              <TabsContent value="permissions" className="pt-4">
                <EffectivePermissions user={user} />
              </TabsContent>
              <TabsContent value="history" className="pt-4">
                <EntityHistory entity="AdminUser" entityId={user.id} />
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
