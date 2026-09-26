import { describe, expect, it } from 'vitest';

import { PERMISSION_CODES, type Permission } from '@shared/enums';

import { NAVIGATION, isBuilt, visibleNavigation } from '@/config/navigation';
import { endpoints } from '@/lib/api/endpoints';
import { ROLE_PERMISSIONS, type SeededRole } from '@/tests/fixtures/roles';

import { PERMISSION_GROUP_LABELS, PERMISSION_LABELS, describeRequirement } from './labels';
import { missingFor, requirementOf, satisfies } from './requirements';

const held = (role: SeededRole) => new Set<Permission>(ROLE_PERMISSIONS[role]);
const visibleIds = (role: SeededRole, phase = 10) =>
  visibleNavigation(held(role), phase).flatMap((group) => group.items.map((item) => item.id));

describe('permission labels', () => {
  it('names exactly the backend permission codes', () => {
    expect(Object.keys(PERMISSION_LABELS).sort()).toEqual([...PERMISSION_CODES].sort());
    expect(PERMISSION_CODES).toHaveLength(86);
  });

  it('labels every permission group', () => {
    for (const code of PERMISSION_CODES)
      expect(PERMISSION_GROUP_LABELS[code.split('.')[0]!]).toBeTruthy();
  });

  it('describes requirements in words', () => {
    expect(describeRequirement(['catalog.product.read', 'catalog.product.update'])).toBe(
      'View products and Edit products',
    );
    expect(describeRequirement([], ['order.order.export', 'catalog.inventory.read'])).toBe(
      'one of: Export orders and sales reports, View inventory',
    );
  });
});

describe('requirements', () => {
  const set = new Set<Permission>(['catalog.product.read']);

  it('checks all-of and any-of', () => {
    expect(satisfies('session', set)).toBe(true);
    expect(satisfies({ all: ['catalog.product.read'] }, set)).toBe(true);
    expect(satisfies({ all: ['catalog.product.read', 'catalog.product.update'] }, set)).toBe(false);
    expect(satisfies({ any: ['catalog.product.update', 'catalog.product.read'] }, set)).toBe(true);
    expect(satisfies({ any: ['catalog.product.update'] }, set)).toBe(false);
  });

  it('reports what is missing', () => {
    expect(missingFor({ all: ['catalog.product.read', 'catalog.product.update'] }, set)).toEqual({
      all: ['catalog.product.update'],
      any: [],
    });
  });

  it('derives UI gating from the endpoint registry', () => {
    expect(requirementOf(endpoints.auth.me.access)).toBe('session');
    expect(requirementOf(endpoints.system.version.access)).toBe('session');
  });
});

describe('seeded roles (backend seed, b5861fd)', () => {
  it.each([
    ['SUPER_ADMIN', 86],
    ['ADMIN', 79],
    ['CATALOG_MANAGER', 36],
    ['ORDER_MANAGER', 15],
    ['CONTENT_MANAGER', 24],
  ] as const)('%s holds %i permissions', (role, count) => {
    expect(ROLE_PERMISSIONS[role]).toHaveLength(count);
  });
});

describe('navigation visibility (full information architecture)', () => {
  it('shows a Super Admin every entry', () => {
    const all = NAVIGATION.flatMap((group) => group.items.map((item) => item.id));
    expect(visibleIds('SUPER_ADMIN')).toEqual(all);
  });

  it('shows a Catalog Manager the catalog, media and pricing rules but not orders or admin users', () => {
    const ids = visibleIds('CATALOG_MANAGER');
    expect(ids).toEqual(
      expect.arrayContaining(['products', 'categories', 'media', 'price-rules', 'import-export']),
    );
    expect(ids).not.toEqual(expect.arrayContaining(['orders']));
    expect(ids).not.toContain('admin-users');
    expect(ids).not.toContain('coupons');
    expect(ids).not.toContain('enquiries');
  });

  it('shows a Content Manager content and enquiries but no pricing', () => {
    const ids = visibleIds('CONTENT_MANAGER');
    expect(ids).toEqual(expect.arrayContaining(['pages', 'banners', 'faqs', 'enquiries']));
    expect(ids).not.toContain('price-rules');
    expect(ids).not.toContain('admin-users');
  });

  it('shows an Order Manager orders, inventory and enquiries, but no editing of catalog structure or admins', () => {
    const ids = visibleIds('ORDER_MANAGER');
    expect(ids).toEqual(
      expect.arrayContaining(['orders', 'reports', 'inventory', 'products', 'carts', 'enquiries']),
    );
    expect(ids).not.toContain('categories');
    expect(ids).not.toContain('pages');
    expect(ids).not.toContain('admin-users');
  });

  it('shows only built phases', () => {
    expect(visibleIds('SUPER_ADMIN', 0)).toEqual(['dashboard', 'system-status']);
  });

  it('gives every built area an icon and a description', () => {
    const missing = NAVIGATION.flatMap((group) => group.items)
      .filter((item) => isBuilt(item) && (!item.icon || !item.description))
      .map((item) => item.id);
    expect(missing).toEqual([]);
  });

  it('never gates on a permission the backend does not define', () => {
    const codes = new Set<string>(PERMISSION_CODES);
    for (const item of NAVIGATION.flatMap((group) => group.items)) {
      if (item.requires === 'session') continue;
      for (const code of [...(item.requires.all ?? []), ...(item.requires.any ?? [])])
        expect(codes.has(code)).toBe(true);
    }
  });
});
