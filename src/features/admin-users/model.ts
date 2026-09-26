import type { AdminRoleCode, AdminUserStatus } from '@shared/enums';
import type { AdminUserDto } from '@shared/types/auth';

import type { StatusRegistry } from '@/components/patterns/status-badge';

export const ADMIN_STATUS: StatusRegistry<AdminUserStatus> = {
  ACTIVE: { label: 'Active', tone: 'success', description: 'Can sign in and work.' },
  INVITED: {
    label: 'Invited',
    tone: 'info',
    description: 'Created without a password; cannot sign in until one is set.',
  },
  SUSPENDED: {
    label: 'Suspended',
    tone: 'warning',
    description: 'Temporarily blocked from signing in. Can be reactivated.',
  },
  DISABLED: {
    label: 'Disabled',
    tone: 'danger',
    description: 'Blocked from signing in until an admin reactivates the account.',
  },
};

export const ADMIN_STATUS_OPTIONS = (Object.keys(ADMIN_STATUS) as AdminUserStatus[]).map(
  (value) => ({ value, label: ADMIN_STATUS[value].label }),
);

export const SUPER_ADMIN = 'SUPER_ADMIN';

/**
 * The built-in roles of the shared contract (`ADMIN_ROLE_CODES`), for admins who may add admins
 * (`system.user.create`) but cannot read the role list (`system.role.read`). Super Admin is left out:
 * only a Super Admin can grant it, and a Super Admin can always read the role list. The API still
 * refuses any role that carries permissions the actor does not hold (ROLE_NOT_GRANTABLE).
 */
export const STANDARD_ROLES: readonly { code: AdminRoleCode; name: string; summary: string }[] = [
  { code: 'ADMIN', name: 'Admin', summary: 'Runs the business day to day.' },
  { code: 'CATALOG_MANAGER', name: 'Catalog Manager', summary: 'Products, categories and media.' },
  { code: 'ORDER_MANAGER', name: 'Order Manager', summary: 'Orders, customers and inventory.' },
  { code: 'CONTENT_MANAGER', name: 'Content Manager', summary: 'Pages, banners and enquiries.' },
];

export const isSuperAdmin = (user: Pick<AdminUserDto, 'roles'>): boolean =>
  user.roles.some((role) => role.code === SUPER_ADMIN);

/**
 * Why an account cannot be managed from this row, before asking the API. The API applies the full
 * rule (you must hold every permission the target holds; the last Super Admin is protected) and
 * answers with its own explanation when this early hint does not cover the case.
 */
export function manageBlock(
  target: AdminUserDto,
  actor: { id: string; roles: readonly string[] },
): string | null {
  if (target.id === actor.id) return 'This is your own account. Use My account instead.';
  if (isSuperAdmin(target) && !actor.roles.includes(SUPER_ADMIN)) {
    return 'Only a Super Admin can manage a Super Admin account.';
  }
  return null;
}
