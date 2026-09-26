import type { ProductBadgeCode } from '@shared/enums';

export type BadgeCode = Exclude<ProductBadgeCode, 'CUSTOM'>;

/** The card badges the storefront can show; the words and colour are catalog settings. */
export const BADGES: readonly { code: BadgeCode; name: string; when: string }[] = [
  { code: 'NEW_ARRIVAL', name: 'New arrival', when: 'flagged new, or published recently' },
  { code: 'SALE', name: 'Sale', when: 'priced below its compare-at price' },
  { code: 'BEST_SELLER', name: 'Best seller', when: 'flagged best seller' },
  { code: 'FEATURED', name: 'Featured', when: 'featured (until its end date, if set)' },
  { code: 'SPECIAL_COLLECTION', name: 'Special collection', when: 'flagged special collection' },
  { code: 'MADE_TO_ORDER', name: 'Made to order', when: 'made to order' },
  { code: 'CUSTOMIZABLE', name: 'Customisable', when: 'open to customisation' },
  { code: 'IN_HOUSE', name: 'Made in-house', when: 'manufactured in-house' },
];
