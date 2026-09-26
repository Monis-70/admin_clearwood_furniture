'use client';

import { useQuery } from '@tanstack/react-query';

import { endpoints } from '@/lib/api/endpoints';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { catalogApi, catalogKeys } from '../catalog/api';
import {
  categoryTrail,
  flattenTree,
  useBrandOptions,
  useCategoryOptions,
} from '../catalog/lookups';

import { contentApi, contentKeys } from './api';

export interface Choice {
  value: string;
  label: string;
}

/** Categories as "Parent › Child" choices; empty without catalog.category.read. */
export function useCategoryChoices(): Choice[] {
  const tree = useCategoryOptions();
  const all = tree.data ?? [];
  return flattenTree(all).map((c) => ({ value: c.id, label: categoryTrail(all, c.id) }));
}

/** The first 100 collections by name; empty without catalog.collection.read. */
export function useCollectionChoices(): Choice[] {
  const { canCall } = usePermissions();
  const query = { page: 1, limit: 100, sort: 'name', order: 'asc' as const };
  const list = useQuery({
    queryKey: [...catalogKeys.all, 'collections', query],
    queryFn: ({ signal }) => catalogApi.collections(query, signal),
    enabled: canCall(endpoints.catalog.collections),
    ...cachePolicy.reference,
  });
  return (list.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }));
}

export function useBrandChoices(): Choice[] {
  const brands = useBrandOptions();
  return (brands.data ?? []).map((b) => ({ value: b.id, label: b.name }));
}

export function useFaqChoices(): Choice[] {
  const { canCall } = usePermissions();
  const list = useQuery({
    queryKey: contentKeys.faqs(),
    queryFn: ({ signal }) => contentApi.faqs(signal),
    enabled: canCall(endpoints.content.faqs),
    ...cachePolicy.reference,
  });
  return (list.data ?? []).map((f) => ({ value: f.id, label: f.question }));
}

export function useTestimonialChoices(): Choice[] {
  const { canCall } = usePermissions();
  const list = useQuery({
    queryKey: contentKeys.testimonials(),
    queryFn: ({ signal }) => contentApi.testimonials(signal),
    enabled: canCall(endpoints.content.testimonials),
    ...cachePolicy.reference,
  });
  return (list.data ?? []).map((t) => ({
    value: t.id,
    label: `${t.authorName}: ${t.quote.slice(0, 60)}`,
  }));
}

export function useStoreChoices(): Choice[] {
  const { canCall } = usePermissions();
  const list = useQuery({
    queryKey: contentKeys.stores(),
    queryFn: ({ signal }) => contentApi.stores(signal),
    enabled: canCall(endpoints.content.stores),
    ...cachePolicy.reference,
  });
  return (list.data ?? []).map((s) => ({ value: s.id, label: `${s.name}, ${s.city}` }));
}
