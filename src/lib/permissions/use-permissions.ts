'use client';

import { useCallback, useMemo } from 'react';

import type { Permission } from '@shared/enums';

import type { EndpointDef } from '@/lib/api/endpoint';
import { useSession } from '@/lib/auth/session';

import {
  missingFor,
  requirementOf,
  satisfies,
  type PermissionSet,
  type Requirement,
} from './requirements';

export interface PermissionApi {
  permissions: PermissionSet;
  can(code: Permission): boolean;
  canAll(codes: readonly Permission[]): boolean;
  canAny(codes: readonly Permission[]): boolean;
  allows(requirement: Requirement): boolean;
  /** UI gating derived from the endpoint registry, so a button and its API call never disagree. */
  canCall(def: EndpointDef): boolean;
  missing(requirement: Requirement): { all: Permission[]; any: Permission[] };
}

export function usePermissions(): PermissionApi {
  const { permissions } = useSession();
  const can = useCallback((code: Permission) => permissions.has(code), [permissions]);
  return useMemo(
    () => ({
      permissions,
      can,
      canAll: (codes) => codes.every((code) => permissions.has(code)),
      canAny: (codes) => codes.some((code) => permissions.has(code)),
      allows: (requirement) => satisfies(requirement, permissions),
      canCall: (def) => satisfies(requirementOf(def.access), permissions),
      missing: (requirement) => missingFor(requirement, permissions),
    }),
    [permissions, can],
  );
}
