import type { CollectionRules } from '@shared/schemas/catalogAdmin';

import { formatDate } from '@/lib/format/datetime';

import { formatRupees } from '../model';
import { PRODUCT_TYPE_LABELS } from '../products/model';

export const collectionHref = (id: string, tab?: string) =>
  `/catalog/collections/edit?id=${encodeURIComponent(id)}${tab ? `&tab=${tab}` : ''}`;

export function scheduleText(row: { startsAt: string | null; endsAt: string | null }): string {
  if (!row.startsAt && !row.endsAt) return 'Always';
  return `${row.startsAt ? formatDate(row.startsAt) : 'Now'} – ${row.endsAt ? formatDate(row.endsAt) : 'no end'}`;
}

export function hasEnded(endsAt: string | null, now = Date.now()): boolean {
  return endsAt ? Date.parse(endsAt) <= now : false;
}

export const COLLECTION_TABS = ['details', 'products', 'rules', 'history'] as const;
export type CollectionTab = (typeof COLLECTION_TABS)[number];

export type RuleKind =
  | 'category'
  | 'categoryPath'
  | 'brand'
  | 'taxClass'
  | 'attributeValue'
  | 'money'
  | 'number'
  | 'boolean'
  | 'text'
  | 'productType'
  | 'stockStatus';
type Operator = CollectionRules['groups'][number]['rules'][number]['operator'];
export type Rule = CollectionRules['groups'][number]['rules'][number];

/**
 * The rule fields this editor offers, with the operators the API's rule compiler gives a clear
 * meaning to for that field. (createdAt and ratingAvgBp are left out: their stored units are not
 * something an admin can type safely.)
 */
export const RULE_FIELDS: Record<string, { label: string; kind: RuleKind; operators: Operator[] }> =
  {
    categoryId: {
      label: 'Category',
      kind: 'category',
      operators: ['EQUALS', 'NOT_EQUALS', 'IN', 'NOT_IN'],
    },
    categoryPath: { label: 'Category branch', kind: 'categoryPath', operators: ['EQUALS'] },
    brandId: { label: 'Brand', kind: 'brand', operators: ['EQUALS', 'NOT_EQUALS', 'IN', 'NOT_IN'] },
    taxClassId: {
      label: 'Tax class',
      kind: 'taxClass',
      operators: ['EQUALS', 'NOT_EQUALS', 'IN', 'NOT_IN'],
    },
    attributeValueId: {
      label: 'Option value',
      kind: 'attributeValue',
      operators: ['EQUALS', 'NOT_EQUALS', 'IN', 'NOT_IN'],
    },
    basePricePaise: {
      label: 'Base price',
      kind: 'money',
      operators: [
        'LESS_OR_EQUAL',
        'LESS_THAN',
        'GREATER_OR_EQUAL',
        'GREATER_THAN',
        'BETWEEN',
        'EQUALS',
      ],
    },
    compareAtPricePaise: {
      label: 'Compare-at price',
      kind: 'money',
      operators: [
        'LESS_OR_EQUAL',
        'LESS_THAN',
        'GREATER_OR_EQUAL',
        'GREATER_THAN',
        'BETWEEN',
        'EQUALS',
      ],
    },
    productType: {
      label: 'Product type',
      kind: 'productType',
      operators: ['EQUALS', 'NOT_EQUALS', 'IN', 'NOT_IN'],
    },
    stockStatus: { label: 'Stock status', kind: 'stockStatus', operators: ['EQUALS', 'IN'] },
    soldCount: {
      label: 'Units sold',
      kind: 'number',
      operators: [
        'GREATER_OR_EQUAL',
        'GREATER_THAN',
        'LESS_OR_EQUAL',
        'LESS_THAN',
        'BETWEEN',
        'EQUALS',
      ],
    },
    searchKeywords: {
      label: 'Search keywords',
      kind: 'text',
      operators: ['CONTAINS', 'STARTS_WITH', 'EQUALS'],
    },
    tags: { label: 'Tag', kind: 'text', operators: ['CONTAINS'] },
    isFeatured: { label: 'Featured', kind: 'boolean', operators: ['EQUALS'] },
    isNewArrival: { label: 'New arrival', kind: 'boolean', operators: ['EQUALS'] },
    isBestSeller: { label: 'Best seller', kind: 'boolean', operators: ['EQUALS'] },
    isSpecialCollection: { label: 'Special collection', kind: 'boolean', operators: ['EQUALS'] },
    isMadeToOrder: { label: 'Made to order', kind: 'boolean', operators: ['EQUALS'] },
  };

export const OPERATOR_LABELS: Record<Operator, string> = {
  EQUALS: 'is',
  NOT_EQUALS: 'is not',
  GREATER_THAN: 'is more than',
  GREATER_OR_EQUAL: 'is at least',
  LESS_THAN: 'is less than',
  LESS_OR_EQUAL: 'is at most',
  BETWEEN: 'is between',
  CONTAINS: 'contains',
  STARTS_WITH: 'starts with',
  IN: 'is any of',
  NOT_IN: 'is none of',
};

export const STOCK_STATUS_LABELS: Record<string, string> = {
  IN_STOCK: 'In stock',
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
  PREORDER: 'Pre-order',
  MADE_TO_ORDER: 'Made to order',
};

export const isList = (operator: Operator) => operator === 'IN' || operator === 'NOT_IN';

/** A fresh rule for a field, with a value of the right shape. */
export function blankRule(field: string): Rule {
  const config = RULE_FIELDS[field]!;
  const operator = config.operators[0]!;
  const value =
    config.kind === 'boolean' ? true : config.kind === 'money' || config.kind === 'number' ? 0 : '';
  return { field: field as Rule['field'], operator, value };
}

/** Keeps the value's shape consistent with a new operator (list, pair or single). */
export function coerceValue(rule: Rule, operator: Operator): Rule['value'] {
  const current = rule.value;
  if (isList(operator))
    return Array.isArray(current) ? current : current === '' ? [] : [current as string];
  if (operator === 'BETWEEN')
    return Array.isArray(current) && current.length === 2
      ? current
      : [Number(current) || 0, Number(current) || 0];
  if (Array.isArray(current)) return current[0] ?? '';
  return current;
}

export interface NameLookup {
  category(id: string): string | undefined;
  brand(id: string): string | undefined;
  taxClass(id: string): string | undefined;
  attributeValue(id: string): string | undefined;
}

function valueText(rule: Rule, names: NameLookup): string {
  const kind = RULE_FIELDS[rule.field]?.kind;
  const one = (v: string | number | boolean): string => {
    switch (kind) {
      case 'category':
        return names.category(String(v)) ?? 'a category';
      case 'brand':
        return names.brand(String(v)) ?? 'a brand';
      case 'taxClass':
        return names.taxClass(String(v)) ?? 'a tax class';
      case 'attributeValue':
        return names.attributeValue(String(v)) ?? 'an option value';
      case 'money':
        return formatRupees(Number(v));
      case 'productType':
        return PRODUCT_TYPE_LABELS[String(v)] ?? String(v);
      case 'stockStatus':
        return STOCK_STATUS_LABELS[String(v)] ?? String(v);
      case 'boolean':
        return v ? 'yes' : 'no';
      default:
        return `“${String(v)}”`;
    }
  };
  if (rule.operator === 'BETWEEN' && Array.isArray(rule.value))
    return `${one(rule.value[0]!)} and ${one(rule.value[1]!)}`;
  if (Array.isArray(rule.value))
    return rule.value.length ? rule.value.map(one).join(', ') : '(nothing chosen)';
  return one(rule.value);
}

export function describeRule(rule: Rule, names: NameLookup): string {
  const config = RULE_FIELDS[rule.field];
  const label = config?.label ?? rule.field;
  if (config?.kind === 'boolean') return `${label}: ${rule.value ? 'yes' : 'no'}`;
  if (config?.kind === 'categoryPath') return `in /${String(rule.value)} or any subcategory`;
  return `${label} ${OPERATOR_LABELS[rule.operator]} ${valueText(rule, names)}`;
}

/** "Products where (Brand is ClearWood and Base price is at most ₹20,000)" — the stored rules in words. */
export function describeRules(rules: CollectionRules, names: NameLookup): string {
  const joiner = (match: string) => (match === 'ANY' ? ' or ' : ' and ');
  const groups = rules.groups.map((group) => {
    const text = group.rules.map((rule) => describeRule(rule, names)).join(joiner(group.match));
    return rules.groups.length > 1 && group.rules.length > 1 ? `(${text})` : text;
  });
  const body = groups.join(joiner(rules.match));
  return `Published products where ${body}${rules.limit ? `, at most ${rules.limit}` : ''}.`;
}
