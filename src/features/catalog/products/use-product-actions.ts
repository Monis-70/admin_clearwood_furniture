'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import type { AdminProductDetailDto } from '@shared/types/catalogAdmin';

import { hasCode } from '@/lib/api/errors';
import { notifyError, notifySuccess } from '@/lib/notify';

import { catalogKeys } from '../api';

import { productsApi, productKeys } from './api';
import { productHref } from './model';

/** Publishing, trash and restore for one product; every answer refreshes the cached detail. */
export function useProductActions(product: Pick<AdminProductDetailDto, 'id' | 'name'>) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const settle = (next: AdminProductDetailDto | null) => {
    if (next) queryClient.setQueryData(productKeys.detail(product.id), next);
    void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
  };

  const publish = useMutation({
    mutationFn: (publishAt?: string) => productsApi.publish(product.id, publishAt),
    onSuccess: (next) => {
      settle(next);
      notifySuccess(
        next.publication === 'SCHEDULED' ? 'Publishing scheduled' : 'Product published',
        next.publication === 'SCHEDULED' ? undefined : `${next.name} is now visible to customers.`,
      );
    },
    onError: (error) => {
      if (hasCode(error, 'PRODUCT_NOT_PUBLISHABLE')) {
        void queryClient.invalidateQueries({ queryKey: productKeys.detail(product.id) });
        router.push(productHref(product.id, 'publishing'));
      }
      notifyError(error, 'Could not publish');
    },
  });

  const unpublish = useMutation({
    mutationFn: () => productsApi.unpublish(product.id),
    onSuccess: (next) => {
      settle(next);
      notifySuccess('Product unpublished', 'Customers can no longer see it.');
    },
    onError: (error) => notifyError(error, 'Could not unpublish'),
  });

  const remove = useMutation({
    mutationFn: () => productsApi.remove(product.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: productKeys.detail(product.id) });
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      notifySuccess('Product moved to trash', `${product.name} can be restored from the list.`);
      router.push('/catalog/products');
    },
    onError: (error) => notifyError(error, 'Could not delete'),
  });

  const restore = useMutation({
    mutationFn: () => productsApi.restore(product.id),
    onSuccess: (next) => {
      settle(next);
      notifySuccess('Product restored');
    },
    onError: (error) => notifyError(error, 'Could not restore'),
  });

  return { publish, unpublish, remove, restore };
}
