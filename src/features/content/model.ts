import type { StatusRegistry } from '@/components/patterns/status-badge';
import { ApiError } from '@/lib/api/errors';

import type { CmsPageRow, HelpCategoryNode, PublishBlocker } from './api';

/** Every help category with its nesting level, parents first. */
export function flattenHelp(
  nodes: readonly HelpCategoryNode[],
  level = 0,
): (HelpCategoryNode & { level: number })[] {
  return [...nodes]
    .sort((a, b) => a.position - b.position)
    .flatMap((n) => [{ ...n, level }, ...flattenHelp(n.children ?? [], level + 1)]);
}

export const PAGE_STATUS: StatusRegistry<CmsPageRow['status']> = {
  DRAFT: { label: 'Draft', tone: 'neutral', description: 'Not visible on the storefront.' },
  SCHEDULED: { label: 'Scheduled', tone: 'info', description: 'Publishes at its scheduled time.' },
  PUBLISHED: { label: 'Published', tone: 'success', description: 'Live on the storefront.' },
  ARCHIVED: { label: 'Archived', tone: 'warning', description: 'Taken down; kept for reference.' },
};

export const PAGE_TYPE_LABELS: Record<string, string> = {
  STANDARD: 'Standard',
  LANDING: 'Landing page',
  POLICY: 'Policy',
  HOME: 'Homepage',
  CATEGORY_LANDING: 'Category landing',
  HELP: 'Help',
};

export const PLACEMENT_LABELS: Record<string, string> = {
  HOME_HERO: 'Homepage hero',
  HOME_STRIP: 'Homepage strip',
  CATEGORY_TOP: 'Top of category pages',
  PDP_SIDEBAR: 'Product page sidebar',
  CART_PROMO: 'Cart',
  CHECKOUT: 'Checkout',
  ANNOUNCEMENT_BAR: 'Announcement bar',
  POPUP: 'Pop-up',
  FOOTER: 'Footer',
};

export const DEVICE_LABELS: Record<string, string> = {
  ALL: 'All devices',
  DESKTOP_ONLY: 'Computers only',
  MOBILE_ONLY: 'Phones only',
};

export const FAQ_VISIBILITY_LABELS: Record<string, string> = {
  GLOBAL: 'Everywhere',
  PRODUCT: 'Product pages',
  CATEGORY: 'Category pages',
  ORDER: 'Orders',
  SHIPPING: 'Shipping',
  PAYMENT: 'Payment',
  WARRANTY: 'Warranty',
  CARE: 'Care',
};

export const CONTENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

export const ITEM_TYPE_LABELS: Record<string, string> = {
  CATEGORY: 'Category',
  COLLECTION: 'Collection',
  PAGE: 'Content page',
  URL: 'Link',
  LEAD_FORM: 'Enquiry form',
};

export const options = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

/** A stored JSON id list (`...IdsJson`) to an array; anything unreadable is treated as empty. */
export function parseIds(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** Positions 0..n-1 in the order shown, for the `{ order: [{ id, position }] }` reorder routes. */
export const reorderBody = (ids: readonly string[]) => ({
  order: ids.map((id, position) => ({ id, position })),
});

/** "Shown" wording for a starts/ends window. */
export function windowLabel(
  startsAt: string | null,
  endsAt: string | null,
  format: (iso: string) => string,
): string {
  if (!startsAt && !endsAt) return 'Always';
  return `${startsAt ? format(startsAt) : 'Now'} – ${endsAt ? format(endsAt) : 'no end'}`;
}

/* ------------------------------------------------------------ publish gate */

const BLOCKER_TEXT: Record<string, string> = {
  NO_BLOCKS: 'The page has no active blocks.',
  NO_TITLE: 'The page has no title.',
  BLOCK_INCOMPLETE: 'A block is not complete enough to show customers.',
  BLOCK_REFERENCE_MISSING: 'A block points at something that no longer exists.',
};

/** The blockers of a 422 PAGE_NOT_PUBLISHABLE, or null for any other error. */
export function publishBlockers(error: unknown): PublishBlocker[] | null {
  if (!(error instanceof ApiError) || error.code !== 'PAGE_NOT_PUBLISHABLE') return null;
  const details = error.details as { blockers?: PublishBlocker[] } | undefined;
  return details?.blockers ?? [];
}

export const blockerText = (blocker: PublishBlocker) =>
  BLOCKER_TEXT[blocker.code] ?? blocker.code.replace(/_/g, ' ').toLowerCase();
