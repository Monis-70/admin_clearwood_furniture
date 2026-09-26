import { formatRupees } from '../catalog/model';

import { percent } from './lookups';
import type { CouponRow } from './promotions-api';

export const TYPE_LABELS: Record<string, string> = {
  PERCENT: 'Percentage off',
  FIXED: 'Amount off',
  FREE_SHIPPING: 'Free delivery',
  TIERED: 'Tiered',
};

export function describeCoupon(
  c: Pick<CouponRow, 'type' | 'valueBp' | 'valuePaise' | 'maxDiscountPaise' | 'minSubtotalPaise'>,
) {
  const value =
    c.type === 'PERCENT'
      ? `${percent(c.valueBp)} off`
      : c.type === 'FIXED'
        ? `${formatRupees(c.valuePaise)} off`
        : c.type === 'FREE_SHIPPING'
          ? 'Free delivery'
          : 'Tiered discount';
  const parts = [value];
  if (c.maxDiscountPaise) parts.push(`at most ${formatRupees(c.maxDiscountPaise)}`);
  if (c.minSubtotalPaise) parts.push(`on carts from ${formatRupees(c.minSubtotalPaise)}`);
  return parts.join(', ');
}

export function couponState(c: CouponRow, now = Date.now()) {
  if (!c.isActive) return { label: 'Off', tone: 'neutral' as const };
  if (c.endsAt && Date.parse(c.endsAt) < now) return { label: 'Ended', tone: 'neutral' as const };
  if (c.startsAt && Date.parse(c.startsAt) > now)
    return { label: 'Scheduled', tone: 'info' as const };
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit)
    return { label: 'Used up', tone: 'warning' as const };
  return { label: 'Active', tone: 'success' as const };
}
