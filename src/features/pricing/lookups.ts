'use client';

import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { endpoints } from '@/lib/api/endpoints';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { customerGroupsApi, promotionsKeys } from './promotions-api';

/** Customer groups for pickers; empty (never requested) without `order.customer.read`. */
export function useCustomerGroupOptions(wanted = true) {
  const { canCall } = usePermissions();
  return useQuery({
    queryKey: promotionsKeys.groupList({ all: true }),
    queryFn: ({ signal }) => customerGroupsApi.all(signal),
    enabled: wanted && canCall(endpoints.pricing.customerGroups),
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

const PERCENT = /^\d{1,3}(\.\d{1,2})?$/;

/** A percentage typed by a person ("12.5") as basis points (1250); '' is "not set". */
export const optionalPercentBp = (label = 'Percentage') =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || PERCENT.test(v), `${label}: enter a percentage like 10 or 12.5`)
    .transform((v) => (v === '' ? null : Math.round(Number(v) * 100)))
    .refine((v) => v === null || v <= 10_000, `${label}: at most 100%`);

export const bpInput = (bp: number | null | undefined): string =>
  bp === null || bp === undefined ? '' : String(bp / 100);
