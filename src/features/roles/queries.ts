'use client';

import { useQueries, useQuery } from '@tanstack/react-query';

import { rolesRoutes } from '@/lib/api/routes/roles';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { roleKeys, rolesApi } from './api';

/** Roles change rarely and are shared by the users and roles screens. */
export function useRoles() {
  const { canCall } = usePermissions();
  return useQuery({
    queryKey: roleKeys.list(),
    queryFn: ({ signal }) => rolesApi.list(signal),
    enabled: canCall(rolesRoutes.list),
    ...cachePolicy.reference,
  });
}

export function useRole(id: string | null) {
  const { canCall } = usePermissions();
  return useQuery({
    queryKey: roleKeys.detail(id ?? ''),
    queryFn: ({ signal }) => rolesApi.get(id!, signal),
    enabled: Boolean(id) && canCall(rolesRoutes.get),
    ...cachePolicy.detail,
  });
}

/** Grants of several roles at once (parallel, each cached on its own key). */
export function useRoleDetails(ids: readonly string[]) {
  const { canCall } = usePermissions();
  const allowed = canCall(rolesRoutes.get);
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: roleKeys.detail(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => rolesApi.get(id, signal),
      enabled: allowed,
      ...cachePolicy.detail,
    })),
  });
}

/** The registry only changes with a backend release. */
export function usePermissionRegistry() {
  const { canCall } = usePermissions();
  return useQuery({
    queryKey: roleKeys.permissions(),
    queryFn: ({ signal }) => rolesApi.permissions(signal),
    enabled: canCall(rolesRoutes.permissions),
    ...cachePolicy.config,
  });
}
