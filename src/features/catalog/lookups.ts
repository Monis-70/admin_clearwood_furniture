'use client';

import { useQuery } from '@tanstack/react-query';

import type { AdminCategoryDto } from '@shared/types/catalogAdmin';

import { attributesRoutes } from '@/lib/api/routes/attributes';
import { brandsRoutes } from '@/lib/api/routes/brands';
import { catalogRoutes } from '@/lib/api/routes/catalog';
import { taxClassesRoutes } from '@/lib/api/routes/taxClasses';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { catalogApi, catalogKeys } from './api';
import { attributesApi, brandsApi, taxClassesApi, taxonomyKeys } from './taxonomy/api';

/**
 * Reference data shared by the catalog screens: fetched once, cached for minutes, and only when the
 * admin may read it (a picker without permission shows the id instead of failing the page).
 */
export function useCategoryOptions(wanted = true) {
  const { canCall } = usePermissions();
  return useQuery({
    queryKey: catalogKeys.categoryTree(),
    queryFn: ({ signal }) => catalogApi.categoryTree(signal),
    enabled: wanted && canCall(catalogRoutes.categoryTree),
    ...cachePolicy.reference,
  });
}

export function useBrandOptions(wanted = true) {
  const { canCall } = usePermissions();
  return useQuery({
    queryKey: [...taxonomyKeys.brands, 'all'],
    queryFn: ({ signal }) => brandsApi.all(signal),
    enabled: wanted && canCall(brandsRoutes.list),
    ...cachePolicy.reference,
  });
}

export function useTaxClassOptions(wanted = true) {
  const { canCall } = usePermissions();
  return useQuery({
    queryKey: taxonomyKeys.taxClasses,
    queryFn: ({ signal }) => taxClassesApi.all(signal),
    enabled: wanted && canCall(taxClassesRoutes.list),
    ...cachePolicy.reference,
  });
}

export function useAttributeOptions() {
  const { canCall } = usePermissions();
  return useQuery({
    queryKey: taxonomyKeys.allAttributes(),
    queryFn: ({ signal }) => attributesApi.all(signal),
    enabled: canCall(attributesRoutes.list),
    ...cachePolicy.reference,
  });
}

export function useAttributeGroups() {
  const { canCall } = usePermissions();
  return useQuery({
    queryKey: taxonomyKeys.groups(),
    queryFn: ({ signal }) => attributesApi.groups(signal),
    enabled: canCall(attributesRoutes.groups),
    ...cachePolicy.reference,
  });
}

/** "Sofas › 3-Seater Sofas" from the flat tree, for pickers and breadcrumbs. */
export function categoryTrail(
  categories: readonly AdminCategoryDto[] | undefined,
  id: string | null | undefined,
): string {
  if (!id) return '';
  const byId = new Map((categories ?? []).map((category) => [category.id, category]));
  const names: string[] = [];
  let current = byId.get(id);
  let guard = 0;
  while (current && guard < 12) {
    names.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
    guard += 1;
  }
  return names.join(' › ') || id;
}

/** Categories in tree order (parent before children), with depth for indentation. */
export function flattenTree(categories: readonly AdminCategoryDto[]): AdminCategoryDto[] {
  const children = new Map<string | null, AdminCategoryDto[]>();
  for (const category of categories) {
    const list = children.get(category.parentId) ?? [];
    list.push(category);
    children.set(category.parentId, list);
  }
  for (const list of children.values())
    list.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  const out: AdminCategoryDto[] = [];
  const walk = (parentId: string | null) => {
    for (const category of children.get(parentId) ?? []) {
      out.push(category);
      walk(category.id);
    }
  };
  walk(null);
  return out;
}
