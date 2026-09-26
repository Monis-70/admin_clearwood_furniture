import { describe, expect, it } from 'vitest';

import { dangerReason, groupPermissions, matchesSearch } from './permission-model';

const dto = (code: string, isDangerous = false) => ({
  id: code,
  code,
  name: code,
  group: code.split('.')[0]!,
  description: null,
  isDangerous,
});

describe('permission model', () => {
  it('groups by business area and resource with readable labels', () => {
    const [catalog] = groupPermissions({
      catalog: [
        dto('catalog.product.read'),
        dto('catalog.product.export', true),
        dto('catalog.category.read'),
      ],
    });
    expect(catalog!.label).toBe('Catalog');
    expect(catalog!.sections.map((s) => s.label)).toEqual(['Products', 'Categories']);
    const exportEntry = catalog!.sections[0]!.entries[1]!;
    expect(exportEntry).toMatchObject({ label: 'Export catalog data', dangerous: true });
    expect(exportEntry.danger).toMatch(/customer details/);
  });

  it('explains every dangerous family', () => {
    expect(dangerReason('system.role.update')).toMatch(/every admin/);
    expect(dangerReason('system.user.delete')).toMatch(/Permanently/);
    expect(dangerReason('payment.settings.update')).toMatch(/on hold/);
    expect(dangerReason('catalog.product.read')).toBeNull();
  });

  it('searches labels, codes and resource names', () => {
    const [catalog] = groupPermissions({ catalog: [dto('catalog.inventory.update')] });
    const section = catalog!.sections[0]!;
    expect(matchesSearch(section.entries[0]!, section, 'inventory')).toBe(true);
    expect(matchesSearch(section.entries[0]!, section, 'adjust')).toBe(true);
    expect(matchesSearch(section.entries[0]!, section, 'coupon')).toBe(false);
  });
});
