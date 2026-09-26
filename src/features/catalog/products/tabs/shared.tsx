'use client';

import type { QueryClient } from '@tanstack/react-query';

import type { ProductUpdateInput } from '@shared/schemas/catalogAdmin';
import type { AdminProductDetailDto } from '@shared/types/catalogAdmin';

import type { ConflictField } from '@/components/patterns/form/version-conflict-dialog';
import { Alert } from '@/components/ui/alert';

import { catalogKeys } from '../../api';
import { productsApi, productKeys } from '../api';

type Wire = Omit<ProductUpdateInput, 'featuredUntil'> & { featuredUntil?: string | null };

/** PATCH with the version the screen was loaded with; the answer replaces the cached detail. */
export async function saveProduct(
  queryClient: QueryClient,
  product: Pick<AdminProductDetailDto, 'id' | 'version'>,
  changes: Omit<Wire, 'version'>,
): Promise<AdminProductDetailDto> {
  const next = await productsApi.update(product.id, { ...changes, version: product.version });
  queryClient.setQueryData(productKeys.detail(product.id), next);
  void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
  return next;
}

/** "Someone else saved this product": compare their values with yours, or reload theirs. */
export function productConflict(
  product: AdminProductDetailDto,
  queryClient: QueryClient,
  fields: readonly ConflictField<AdminProductDetailDto>[],
) {
  return {
    fields,
    yours: (values: object) => values as Partial<AdminProductDetailDto>,
    loadLatest: () => productsApi.get(product.id),
    onReload: (latest: AdminProductDetailDto) =>
      queryClient.setQueryData(productKeys.detail(product.id), latest),
  };
}

export function ReadOnlyNotice({ product }: { product: Pick<AdminProductDetailDto, 'deletedAt'> }) {
  return (
    <Alert tone="info" title="View only">
      {product.deletedAt
        ? 'Restore this product before changing it.'
        : 'Your role can view this product but not change it.'}
    </Alert>
  );
}
