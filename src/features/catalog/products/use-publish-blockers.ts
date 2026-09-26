'use client';

import { useQuery } from '@tanstack/react-query';

import type { AdminProductDetailDto } from '@shared/types/catalogAdmin';

import { productsRoutes } from '@/lib/api/routes/products';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { productsApi, productKeys } from './api';

/**
 * The publish gate as the API evaluates it now (`GET …/publish-blockers`). The detail's
 * `publishBlockers` only records the last publish attempt, so a live product can show none there
 * while the current gate would refuse it. One shared query serves the workbench, the tab badge and
 * the Publishing tab; it refetches whenever the product's version changes.
 */
export function usePublishBlockers(
  product: Pick<AdminProductDetailDto, 'id' | 'version' | 'deletedAt'>,
) {
  const { canCall } = usePermissions();
  return useQuery({
    queryKey: [...productKeys.detail(product.id), 'blockers', product.version],
    queryFn: ({ signal }) => productsApi.blockers(product.id, signal),
    enabled: canCall(productsRoutes.blockers) && !product.deletedAt,
    ...cachePolicy.detail,
    staleTime: 0,
  });
}
