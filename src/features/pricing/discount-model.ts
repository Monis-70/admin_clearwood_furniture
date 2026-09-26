'use client';

import type { DiscountAction, RuleCondition } from '@shared/types/pricing';

import { formatRupees } from '../catalog/model';

/** How each condition field is entered and shown. The API owns the evaluation. */
export type FieldKind =
  | 'money'
  | 'count'
  | 'weekday'
  | 'boolean'
  | 'category'
  | 'brand'
  | 'collection'
  | 'group'
  | 'channel'
  | 'text'
  | 'product';

export const CONDITION_FIELDS: Record<string, { label: string; kind: FieldKind }> = {
  qty: { label: 'Quantity of the product', kind: 'count' },
  unitPricePaise: { label: 'Unit price', kind: 'money' },
  lineSubtotalPaise: { label: 'Line subtotal', kind: 'money' },
  cartSubtotalPaise: { label: 'Cart subtotal', kind: 'money' },
  cartItemCount: { label: 'Items in the cart', kind: 'count' },
  productId: { label: 'Product', kind: 'product' },
  variantId: { label: 'Variant ID', kind: 'text' },
  categoryId: { label: 'Category', kind: 'category' },
  collectionId: { label: 'Collection', kind: 'collection' },
  brandId: { label: 'Brand', kind: 'brand' },
  attributeValueId: { label: 'Option value ID', kind: 'text' },
  customerGroupCode: { label: 'Customer group', kind: 'group' },
  channel: { label: 'Channel', kind: 'channel' },
  pincode: { label: 'Delivery pincode', kind: 'text' },
  isFirstOrder: { label: 'First order', kind: 'boolean' },
  weekday: { label: 'Day of the week', kind: 'weekday' },
};

export const OPERATOR_LABELS: Record<string, string> = {
  EQUALS: 'is',
  NOT_EQUALS: 'is not',
  GREATER_THAN: 'is more than',
  GREATER_OR_EQUAL: 'is at least',
  LESS_THAN: 'is less than',
  LESS_OR_EQUAL: 'is at most',
  IN: 'is one of',
  NOT_IN: 'is none of',
  CONTAINS: 'contains',
};

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function operatorsFor(kind: FieldKind): string[] {
  switch (kind) {
    case 'money':
    case 'count':
      return [
        'EQUALS',
        'NOT_EQUALS',
        'GREATER_THAN',
        'GREATER_OR_EQUAL',
        'LESS_THAN',
        'LESS_OR_EQUAL',
      ];
    case 'boolean':
      return ['EQUALS'];
    case 'text':
      return ['EQUALS', 'NOT_EQUALS', 'IN', 'NOT_IN', 'CONTAINS'];
    default:
      return ['EQUALS', 'NOT_EQUALS', 'IN', 'NOT_IN'];
  }
}

export const isList = (operator: string) => operator === 'IN' || operator === 'NOT_IN';

/** A condition row as typed: `value` is text (comma-separated for lists, rupees for money). */
export interface ConditionDraft {
  field: string;
  operator: string;
  value: string;
}

const MONEY = /^\d{1,9}(\.\d{1,2})?$/;

/** Draft rows to the stored shape, or the first problem found. */
export function toConditions(drafts: readonly ConditionDraft[]): RuleCondition[] | string {
  const out: RuleCondition[] = [];
  for (const [index, d] of drafts.entries()) {
    const kind = CONDITION_FIELDS[d.field]?.kind ?? 'text';
    const raw = d.value.trim();
    const where = `Condition ${index + 1}`;
    if (raw === '') return `${where}: choose or enter a value.`;
    if (kind === 'money') {
      if (!MONEY.test(raw)) return `${where}: enter rupees, for example 25000.`;
      out.push({ field: d.field, operator: d.operator, value: Math.round(Number(raw) * 100) });
    } else if (kind === 'count' || kind === 'weekday') {
      if (!/^\d+$/.test(raw)) return `${where}: enter a whole number.`;
      out.push({ field: d.field, operator: d.operator, value: Number(raw) });
    } else if (kind === 'boolean') {
      out.push({ field: d.field, operator: d.operator, value: raw === 'true' });
    } else if (isList(d.operator)) {
      const values = raw
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      if (values.length === 0) return `${where}: choose at least one value.`;
      out.push({ field: d.field, operator: d.operator, value: values });
    } else {
      out.push({ field: d.field, operator: d.operator, value: raw });
    }
  }
  return out;
}

export function fromConditions(conditions: readonly RuleCondition[]): ConditionDraft[] {
  return conditions.map((c) => {
    const kind = CONDITION_FIELDS[c.field]?.kind ?? 'text';
    const value = Array.isArray(c.value)
      ? c.value.join(',')
      : kind === 'money' && typeof c.value === 'number'
        ? String(c.value / 100)
        : String(c.value);
    return { field: c.field, operator: c.operator, value };
  });
}

export interface ActionDraft {
  type: string;
  value: string;
  max: string;
}

export function toActions(drafts: readonly ActionDraft[]): DiscountAction[] | string {
  const out: DiscountAction[] = [];
  for (const [index, d] of drafts.entries()) {
    const where = `Discount ${index + 1}`;
    const max = d.max.trim();
    if (max && !MONEY.test(max)) return `${where}: the cap is rupees, for example 5000.`;
    const cap = max ? { maxDiscountPaise: Math.round(Number(max) * 100) } : {};
    if (d.type === 'PERCENT') {
      if (!/^\d{1,3}(\.\d{1,2})?$/.test(d.value.trim()) || Number(d.value) > 100)
        return `${where}: enter a percentage up to 100.`;
      out.push({ type: 'PERCENT', valueBp: Math.round(Number(d.value) * 100), ...cap });
    } else if (d.type === 'FIXED') {
      if (!MONEY.test(d.value.trim())) return `${where}: enter rupees, for example 1000.`;
      out.push({ type: 'FIXED', valuePaise: Math.round(Number(d.value) * 100), ...cap });
    } else {
      out.push({ type: 'FREE_SHIPPING' });
    }
  }
  return out;
}

export function fromActions(actions: readonly DiscountAction[]): ActionDraft[] {
  return actions.map((a) => ({
    type: a.type,
    value:
      a.type === 'PERCENT'
        ? String((a.valueBp ?? 0) / 100)
        : a.type === 'FIXED'
          ? String((a.valuePaise ?? 0) / 100)
          : '',
    max: a.maxDiscountPaise ? String(a.maxDiscountPaise / 100) : '',
  }));
}

/** "10% off (at most ₹5,000)" — the stored action in words. */
export function describeAction(action: DiscountAction): string {
  const cap = action.maxDiscountPaise ? ` (at most ${formatRupees(action.maxDiscountPaise)})` : '';
  if (action.type === 'PERCENT') return `${(action.valueBp ?? 0) / 100}% off${cap}`;
  if (action.type === 'FIXED') return `${formatRupees(action.valuePaise ?? 0)} off${cap}`;
  return 'Free delivery';
}
