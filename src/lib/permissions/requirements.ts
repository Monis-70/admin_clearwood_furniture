import type { Permission } from '@shared/enums';

import type { EndpointAccess } from '@/lib/api/endpoint';

/** What a screen, navigation entry or action needs. Mirrors the backend guard, never replaces it. */
export type Requirement =
  { readonly all?: readonly Permission[]; readonly any?: readonly Permission[] } | 'session';

export type PermissionSet = ReadonlySet<Permission>;

export const NO_PERMISSIONS: PermissionSet = new Set<Permission>();

export function satisfies(requirement: Requirement, held: PermissionSet): boolean {
  if (requirement === 'session') return true;
  const all = requirement.all ?? [];
  const any = requirement.any ?? [];
  return (
    all.every((code) => held.has(code)) && (any.length === 0 || any.some((code) => held.has(code)))
  );
}

/** The permission part of an endpoint's access rule, as a UI requirement. */
export function requirementOf(access: EndpointAccess): Requirement {
  switch (access.kind) {
    case 'public':
    case 'session':
      return 'session';
    case 'permission':
      return { all: access.all };
    case 'any-permission':
      return { any: access.any };
  }
}

export function missingFor(
  requirement: Requirement,
  held: PermissionSet,
): { all: Permission[]; any: Permission[] } {
  if (requirement === 'session') return { all: [], any: [] };
  const all = (requirement.all ?? []).filter((code) => !held.has(code));
  const anyList = requirement.any ?? [];
  const any = anyList.length > 0 && !anyList.some((code) => held.has(code)) ? [...anyList] : [];
  return { all, any };
}
