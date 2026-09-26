'use client';

import { useQuery } from '@tanstack/react-query';

import { pricingRoutes } from '@/lib/api/routes/pricing';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { customerGroupsApi, promotionsKeys } from './promotions-api';

/** Customer groups for pickers; empty (never requested) without `order.customer.read`. */
export function useCustomerGroupOptions(wanted = true) {
  const { canCall } = usePermissions();
  return useQuery({
    queryKey: promotionsKeys.groupList({ all: true }),
    queryFn: ({ signal }) => customerGroupsApi.all(signal),
    enabled: wanted && canCall(pricingRoutes.customerGroups),
    ...cachePolicy.reference,
  });
}

export const CHANNEL_LABELS: Record<string, string> = {
  ALL: 'Every channel',
  WEB: 'Website',
  APP: 'App',
  STORE: 'Showroom',
  B2B: 'Business (B2B)',
};

export const CONDITIONS: Record<string, { label: string; unit: string }> = {
  PRICE: { label: 'Cart value', unit: '₹' },
  WEIGHT: { label: 'Weight', unit: 'grams' },
  ITEM_COUNT: { label: 'Number of items', unit: 'items' },
};

export const SHIPPING_METHOD_LABELS: Record<string, string> = {
  STANDARD: 'Standard delivery',
  EXPRESS: 'Express delivery',
  WHITE_GLOVE: 'White-glove delivery',
  SELF_PICKUP: 'Pickup from a store',
};

export const percent = (bp: number | null | undefined) =>
  bp === null || bp === undefined
    ? '—'
    : `${(bp / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;

export const bpInput = (bp: number | null | undefined): string =>
  bp === null || bp === undefined ? '' : String(bp / 100);
