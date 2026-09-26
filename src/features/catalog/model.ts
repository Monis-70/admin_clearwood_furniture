import type { StatusRegistry } from '@/components/patterns/status-badge';

export const PRODUCT_STATUS: StatusRegistry<string> = {
  DRAFT: { label: 'Draft', tone: 'neutral', description: 'Not visible on the storefront yet.' },
  ACTIVE: { label: 'Active', tone: 'success', description: 'Can be shown on the storefront.' },
  ARCHIVED: { label: 'Archived', tone: 'warning', description: 'Retired; hidden from customers.' },
};

export const PUBLICATION: StatusRegistry<'DRAFT' | 'SCHEDULED' | 'LIVE' | 'ARCHIVED'> = {
  DRAFT: { label: 'Not published', tone: 'neutral', description: 'Customers cannot see it.' },
  SCHEDULED: {
    label: 'Scheduled',
    tone: 'info',
    description: 'Goes live automatically at its publish time.',
  },
  LIVE: { label: 'Live', tone: 'success', description: 'Visible to customers now.' },
  ARCHIVED: { label: 'Archived', tone: 'warning', description: 'Hidden from customers.' },
};

export const STOCK_STATUS: StatusRegistry<string> = {
  IN_STOCK: { label: 'In stock', tone: 'success' },
  LOW_STOCK: {
    label: 'Low stock',
    tone: 'warning',
    description: 'At or below its low-stock level.',
  },
  OUT_OF_STOCK: { label: 'Out of stock', tone: 'danger' },
  PREORDER: { label: 'Pre-order', tone: 'info' },
  MADE_TO_ORDER: {
    label: 'Made to order',
    tone: 'info',
    description: 'Built after the order is placed; stock is not held.',
  },
};

/** Paise to "₹12,499" without pulling the full money module into every list. */
export function formatRupees(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paise / 100);
}
