import type { StatusRegistry } from '@/components/patterns/status-badge';
import { formatDate } from '@/lib/format/datetime';

import { formatRupees } from '../catalog/model';

export const ADJUSTMENT_SCOPES: Record<string, string> = {
  GLOBAL: 'Every product',
  CATEGORY: 'A category',
  PRODUCT: 'One product',
  VARIANT: 'One variant',
  ATTRIBUTE_VALUE: 'An option value (e.g. Leather)',
  CUSTOMIZATION: 'Customisation charges',
};

export const ADJUSTMENT_TYPES: Record<string, string> = {
  FIXED_AMOUNT: 'Fixed amount (₹)',
  PERCENT: 'Percentage (%)',
  PER_UNIT: 'Per unit (₹ each)',
  MULTIPLIER: 'Multiplier (×)',
};

export const ADJUSTMENT_BASES: Record<string, string> = {
  BASE: 'the base price',
  RUNNING_SUBTOTAL: 'the price after earlier rules',
};

export const ADJUSTMENT_STATE: StatusRegistry<string> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  SCHEDULED: { label: 'Scheduled', tone: 'info', description: 'Starts later.' },
  ENDED: { label: 'Ended', tone: 'neutral', description: 'Its end date has passed.' },
  OFF: { label: 'Off', tone: 'neutral', description: 'Switched off by an admin.' },
};

interface RuleLike {
  adjustmentType: string;
  basis: string;
  valuePaise: number | null;
  valueBp: number | null;
  minQty: number | null;
  maxQty: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

/** Display state from the rule's own switch and dates; the pricing engine decides what applies. */
export function adjustmentState(rule: RuleLike, now = Date.now()): string {
  if (!rule.isActive) return 'OFF';
  if (rule.endsAt && Date.parse(rule.endsAt) <= now) return 'ENDED';
  if (rule.startsAt && Date.parse(rule.startsAt) > now) return 'SCHEDULED';
  return 'ACTIVE';
}

const signed = (value: number, render: (abs: number) => string) =>
  value < 0 ? `${render(-value)} off` : `${render(value)} extra`;

/**
 * "10% off the base price for Sofas, 5 Oct – 20 Oct" — the rule as stored, in words. It restates
 * the fields; it never computes a price.
 */
export function describeAdjustment(rule: RuleLike, target?: string): string {
  const value = (() => {
    switch (rule.adjustmentType) {
      case 'PERCENT':
        return rule.valueBp === null
          ? 'a percentage'
          : signed(rule.valueBp, (abs) => `${abs / 100}%`);
      case 'MULTIPLIER':
        return rule.valueBp === null ? 'a multiplier' : `× ${rule.valueBp / 10_000}`;
      case 'PER_UNIT':
        return rule.valuePaise === null
          ? 'an amount per unit'
          : `${signed(rule.valuePaise, (abs) => formatRupees(abs))} per unit`;
      default:
        return rule.valuePaise === null
          ? 'an amount'
          : signed(rule.valuePaise, (abs) => formatRupees(abs));
    }
  })();
  const parts = [`${value} on ${ADJUSTMENT_BASES[rule.basis] ?? rule.basis}`];
  if (target) parts.push(`for ${target}`);
  if (rule.minQty || rule.maxQty) {
    parts.push(
      rule.minQty && rule.maxQty
        ? `when buying ${rule.minQty}–${rule.maxQty}`
        : rule.minQty
          ? `when buying ${rule.minQty} or more`
          : `for up to ${rule.maxQty}`,
    );
  }
  if (rule.startsAt || rule.endsAt) {
    parts.push(
      rule.startsAt && rule.endsAt
        ? `from ${formatDate(rule.startsAt)} to ${formatDate(rule.endsAt)}`
        : rule.startsAt
          ? `from ${formatDate(rule.startsAt)}`
          : `until ${formatDate(rule.endsAt!)}`,
    );
  }
  return `${parts.join(' ')}.`.replace(/^./, (c) => c.toUpperCase());
}
