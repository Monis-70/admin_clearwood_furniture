import type {
  AdminCategoryDto,
  AdminProductSummaryDto,
  LowStockItemDto,
} from '@shared/types/catalogAdmin';

import { apiPage, apiRequest, type Page } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';

export interface ProductListQuery {
  page: number;
  limit: number;
  sort?: string;
  order: 'asc' | 'desc';
  q?: string;
  status?: string;
  publication?: string;
  stock?: string;
  hasMedia?: string;
  completenessMax?: number;
  categoryId?: string;
  collectionId?: string;
  brandId?: string;
  visibility?: string;
  madeToOrder?: string;
  customizable?: string;
  includeDeleted?: string;
}

/**
 * The admin collection row. Not in @clearwood/shared: mirrors what `GET /admin/catalog/collections`
 * returns (fields the list shows only).
 */
export interface AdminCollectionRow {
  id: string;
  slug: string;
  name: string;
  type: 'MANUAL' | 'AUTOMATIC';
  description: string | null;
  isActive: boolean;
  position: number;
  startsAt: string | null;
  endsAt: string | null;
  lastEvaluatedAt: string | null;
  evaluatedCount: number | null;
  updatedAt: string;
}

export interface SimpleListQuery {
  page: number;
  limit: number;
  sort?: string;
  order: 'asc' | 'desc';
}

export const catalogKeys = {
  all: ['catalog'] as const,
  products: (query: ProductListQuery) => [...catalogKeys.all, 'products', query] as const,
  categoryTree: () => [...catalogKeys.all, 'category-tree'] as const,
  collections: (query: SimpleListQuery) => [...catalogKeys.all, 'collections', query] as const,
  lowStock: (query: SimpleListQuery) => [...catalogKeys.all, 'low-stock', query] as const,
};

export const catalogApi = {
  products(query: ProductListQuery, signal?: AbortSignal): Promise<Page<AdminProductSummaryDto>> {
    return apiPage<AdminProductSummaryDto>(endpoints.catalog.products, {
      query: { ...query },
      signal,
    });
  },
  /** The whole admin tree as a flat list (parentId links it); one request serves every picker. */
  async categoryTree(signal?: AbortSignal): Promise<AdminCategoryDto[]> {
    return (await apiRequest<AdminCategoryDto[]>(endpoints.catalog.categoryTree, { signal })).data;
  },
  collections(query: SimpleListQuery, signal?: AbortSignal): Promise<Page<AdminCollectionRow>> {
    return apiPage<AdminCollectionRow>(endpoints.catalog.collections, {
      query: { ...query },
      signal,
    });
  },
  lowStock(query: SimpleListQuery, signal?: AbortSignal): Promise<Page<LowStockItemDto>> {
    return apiPage<LowStockItemDto>(endpoints.catalog.lowStock, {
      query: { ...query },
      signal,
    });
  },
};
