import { describe, expect, it } from 'vitest';

import { blockerTab, factorTab, isProductTab } from './model';

describe('product editor navigation', () => {
  // The codes and keys the API's publish gate and completeness score emit
  // (catalog-admin/product.admin.service.ts at the pinned backend commit).
  const BLOCKERS = [
    'DUPLICATE_SKU',
    'DUPLICATE_SLUG',
    'INVALID_PRICE',
    'NO_PRIMARY_CATEGORY',
    'PRIMARY_CATEGORY_UNAVAILABLE',
    'NO_TAX_CLASS',
    'TAX_CLASS_INACTIVE',
    'BRAND_INACTIVE',
    'NO_ACTIVE_VARIANT',
    'NO_PRIMARY_MEDIA',
    'MEDIA_NOT_READY',
    'INVALID_CATEGORY_ATTRIBUTES',
  ];
  const FACTORS = [
    'name',
    'description',
    'primaryCategory',
    'primaryMedia',
    'gallery',
    'price',
    'taxClass',
    'variants',
    'dimensions',
    'warranty',
    'seo',
    'searchKeywords',
  ];

  it('sends every known blocker and factor to the tab that fixes it', () => {
    for (const code of BLOCKERS) expect(blockerTab({ code, message: code }), code).not.toBeNull();
    for (const key of FACTORS) expect(factorTab(key), key).not.toBeNull();
    expect(blockerTab({ code: 'NO_PRIMARY_MEDIA', message: '' })).toBe('media');
    expect(factorTab('taxClass')).toBe('pricing');
  });

  it('shows an unknown blocker without inventing a destination', () => {
    expect(blockerTab({ code: 'SOMETHING_NEW', message: 'New rule' })).toBeNull();
    expect(factorTab('somethingNew')).toBeNull();
  });

  it('accepts only real tab names from the URL', () => {
    expect(isProductTab('variants')).toBe(true);
    expect(isProductTab('admin')).toBe(false);
    expect(isProductTab(null)).toBe(false);
  });
});
