import type { AdminProductDetailDto, PublishBlockerDto } from '@shared/types/catalogAdmin';

import type { StatusRegistry } from '@/components/patterns/status-badge';

export const PRODUCT_TABS = [
  { id: 'general', label: 'General' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'specifications', label: 'Specifications' },
  { id: 'variants', label: 'Variants' },
  { id: 'media', label: 'Media' },
  { id: 'merchandising', label: 'Merchandising' },
  { id: 'related', label: 'Related' },
  { id: 'fulfilment', label: 'Fulfilment' },
  { id: 'seo', label: 'SEO' },
  { id: 'publishing', label: 'Publishing' },
  { id: 'history', label: 'History' },
] as const;

export type ProductTab = (typeof PRODUCT_TABS)[number]['id'];

export const isProductTab = (value: string | null): value is ProductTab =>
  PRODUCT_TABS.some((tab) => tab.id === value);

export { productHref } from './href';

/**
 * Where each API completeness factor and publish blocker is fixed. Navigation only: which factors
 * and blockers exist, and whether they are satisfied, is decided by the API.
 */
const FACTOR_TAB: Record<string, ProductTab> = {
  name: 'general',
  description: 'general',
  primaryCategory: 'general',
  primaryMedia: 'media',
  gallery: 'media',
  price: 'pricing',
  taxClass: 'pricing',
  variants: 'variants',
  dimensions: 'fulfilment',
  warranty: 'fulfilment',
  seo: 'seo',
  searchKeywords: 'seo',
};

const BLOCKER_TAB: Record<string, ProductTab> = {
  DUPLICATE_SKU: 'general',
  DUPLICATE_SLUG: 'seo',
  INVALID_PRICE: 'pricing',
  NO_PRIMARY_CATEGORY: 'general',
  PRIMARY_CATEGORY_UNAVAILABLE: 'general',
  NO_TAX_CLASS: 'pricing',
  TAX_CLASS_INACTIVE: 'pricing',
  BRAND_INACTIVE: 'general',
  NO_ACTIVE_VARIANT: 'variants',
  NO_PRIMARY_MEDIA: 'media',
  MEDIA_NOT_READY: 'media',
  INVALID_CATEGORY_ATTRIBUTES: 'specifications',
};

export const factorTab = (key: string): ProductTab | null => FACTOR_TAB[key] ?? null;
export const blockerTab = (blocker: PublishBlockerDto): ProductTab | null =>
  BLOCKER_TAB[blocker.code] ?? null;

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  SIMPLE: 'Simple (one version)',
  VARIABLE: 'With variants',
  CONFIGURABLE: 'Configurable',
  MADE_TO_ORDER: 'Made to order',
  BUNDLE: 'Bundle',
};

export const VISIBILITY: StatusRegistry<string> = {
  PUBLIC: { label: 'Everywhere', tone: 'success', description: 'In the catalogue and in search.' },
  CATALOG_ONLY: { label: 'Catalogue only', tone: 'info', description: 'Browsable, not in search.' },
  SEARCH_ONLY: { label: 'Search only', tone: 'info', description: 'Found by search, not browsed.' },
  HIDDEN: { label: 'Hidden', tone: 'neutral', description: 'Only reachable by its link.' },
};

export function isLive(product: Pick<AdminProductDetailDto, 'publication'>): boolean {
  return product.publication === 'LIVE' || product.publication === 'SCHEDULED';
}
