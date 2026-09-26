import type { Permission } from '@shared/enums';
import type { PermissionDto } from '@shared/types/auth';

import { PERMISSION_GROUP_LABELS, PERMISSION_LABELS } from '@/lib/permissions/labels';

import type { PermissionRegistry } from './api';

const RESOURCE_LABELS: Readonly<Record<string, string>> = {
  category: 'Categories',
  attribute: 'Attributes',
  product: 'Products',
  variant: 'Variants',
  inventory: 'Inventory',
  collection: 'Collections',
  asset: 'Media library',
  tax: 'Tax and delivery charges',
  adjustment: 'Price adjustments',
  coupon: 'Coupons',
  order: 'Orders',
  customer: 'Customers, carts and wishlists',
  refund: 'Refunds',
  settings: 'Payment settings',
  split: 'Payment splits',
  page: 'Pages, help centre, stores and testimonials',
  banner: 'Banners and announcements',
  faq: 'FAQs',
  navigation: 'Navigation menus',
  enquiry: 'Enquiries',
  user: 'Admin users',
  role: 'Roles',
  setting: 'Site settings',
  audit: 'Audit log',
};

/** Why a permission carries a warning, in the operator's words. */
export function dangerReason(code: string): string | null {
  if (code.startsWith('system.role.')) return 'Changes what every admin with this role can do.';
  if (code === 'system.user.delete') return 'Permanently removes admin accounts.';
  if (code.startsWith('payment.'))
    return 'Touches payment settings and money flows (payments are on hold).';
  if (code === 'order.refund.approve') return 'Approves refunds (refunds are on hold).';
  if (code.endsWith('.export'))
    return 'Downloads data in bulk, which can include customer details.';
  return null;
}

export interface PermissionEntry {
  code: string;
  label: string;
  dangerous: boolean;
  danger: string | null;
}

export interface PermissionSection {
  resource: string;
  label: string;
  entries: PermissionEntry[];
}

export interface PermissionDomain {
  group: string;
  label: string;
  sections: PermissionSection[];
  total: number;
}

function entryOf(dto: PermissionDto): PermissionEntry {
  return {
    code: dto.code,
    label: PERMISSION_LABELS[dto.code as Permission] ?? dto.name,
    dangerous: dto.isDangerous,
    danger: dto.isDangerous ? (dangerReason(dto.code) ?? 'Handle with care.') : null,
  };
}

/** Domain → resource → permission, in the API's order, for display and editing. */
export function groupPermissions(registry: PermissionRegistry): PermissionDomain[] {
  return Object.entries(registry).map(([group, list]) => {
    const sections = new Map<string, PermissionSection>();
    for (const dto of list) {
      const resource = dto.code.split('.')[1] ?? 'other';
      const section = sections.get(resource) ?? {
        resource,
        label: RESOURCE_LABELS[resource] ?? resource,
        entries: [],
      };
      section.entries.push(entryOf(dto));
      sections.set(resource, section);
    }
    return {
      group,
      label: PERMISSION_GROUP_LABELS[group] ?? group,
      sections: [...sections.values()],
      total: list.length,
    };
  });
}

export function matchesSearch(entry: PermissionEntry, section: PermissionSection, term: string) {
  if (!term) return true;
  const needle = term.toLowerCase();
  return (
    entry.label.toLowerCase().includes(needle) ||
    entry.code.toLowerCase().includes(needle) ||
    section.label.toLowerCase().includes(needle)
  );
}
