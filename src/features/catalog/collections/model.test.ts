import { describe, expect, it } from 'vitest';

import { blankRule, coerceValue, describeRules, hasEnded, type NameLookup } from './model';

const names: NameLookup = {
  category: (id) => ({ cat_sofas: 'Sofas' })[id],
  brand: (id) => ({ brand_cw: 'ClearWood' })[id],
  taxClass: () => undefined,
  attributeValue: () => undefined,
};

describe('collection rule helpers', () => {
  it('describes the stored rules in words, naming records it knows', () => {
    expect(
      describeRules(
        {
          match: 'ALL',
          groups: [
            {
              match: 'ALL',
              rules: [
                { field: 'brandId', operator: 'EQUALS', value: 'brand_cw' },
                { field: 'basePricePaise', operator: 'LESS_OR_EQUAL', value: 2_000_000 },
              ],
            },
          ],
          limit: 24,
        } as never,
        names,
      ),
    ).toBe(
      'Published products where Brand is ClearWood and Base price is at most ₹20,000, at most 24.',
    );
  });

  it('brackets groups and says so when a referenced record is unknown', () => {
    const text = describeRules(
      {
        match: 'ANY',
        groups: [
          {
            match: 'ALL',
            rules: [
              { field: 'categoryId', operator: 'IN', value: ['cat_sofas', 'cat_gone'] },
              { field: 'isFeatured', operator: 'EQUALS', value: true },
            ],
          },
          { match: 'ALL', rules: [{ field: 'taxClassId', operator: 'EQUALS', value: 'tax_x' }] },
        ],
      } as never,
      names,
    );
    expect(text).toBe(
      'Published products where (Category is any of Sofas, a category and Featured: yes) or Tax class is a tax class.',
    );
  });

  it('keeps a rule value in the shape its operator needs', () => {
    const price = blankRule('basePricePaise');
    expect(price).toEqual({ field: 'basePricePaise', operator: 'LESS_OR_EQUAL', value: 0 });
    expect(coerceValue({ ...price, value: 500 }, 'BETWEEN')).toEqual([500, 500]);
    expect(coerceValue({ ...price, value: [100, 900] }, 'EQUALS')).toBe(100);
    const brand = blankRule('brandId');
    expect(coerceValue(brand, 'IN')).toEqual([]);
    expect(coerceValue({ ...brand, value: 'brand_cw' }, 'IN')).toEqual(['brand_cw']);
    expect(blankRule('isFeatured').value).toBe(true);
  });

  it('treats only a past end date as ended', () => {
    const now = Date.parse('2026-05-10T00:00:00Z');
    expect(hasEnded(null, now)).toBe(false);
    expect(hasEnded('2026-05-09T00:00:00Z', now)).toBe(true);
    expect(hasEnded('2026-05-11T00:00:00Z', now)).toBe(false);
  });
});
