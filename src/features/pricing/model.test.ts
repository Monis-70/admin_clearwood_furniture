import { describe, expect, it } from 'vitest';

import { adjustmentState, describeAdjustment } from './model';

const rule = {
  adjustmentType: 'PERCENT',
  basis: 'BASE',
  valuePaise: null,
  valueBp: -1000,
  minQty: null,
  maxQty: null,
  startsAt: null,
  endsAt: null,
  isActive: true,
};

describe('price rule helpers', () => {
  it('reads the display state from the switch and the dates only', () => {
    const now = Date.parse('2026-05-10T00:00:00Z');
    expect(adjustmentState({ ...rule, isActive: false }, now)).toBe('OFF');
    expect(adjustmentState({ ...rule, endsAt: '2026-05-01T00:00:00Z' }, now)).toBe('ENDED');
    expect(adjustmentState({ ...rule, startsAt: '2026-06-01T00:00:00Z' }, now)).toBe('SCHEDULED');
    expect(adjustmentState(rule, now)).toBe('ACTIVE');
  });

  it('restates the stored rule in words without computing a price', () => {
    expect(describeAdjustment(rule, 'Sofas')).toBe('10% off on the base price for Sofas.');
    expect(describeAdjustment({ ...rule, valueBp: 500 })).toMatch(/^5% extra on /);
    expect(
      describeAdjustment({
        ...rule,
        adjustmentType: 'FIXED_AMOUNT',
        valueBp: null,
        valuePaise: -50_000,
      }),
    ).toMatch(/^₹500 off on /);
    expect(describeAdjustment({ ...rule, minQty: 4, maxQty: null })).toContain(
      'when buying 4 or more',
    );
    expect(describeAdjustment({ ...rule, valueBp: null })).toBe('A percentage on the base price.');
  });
});
