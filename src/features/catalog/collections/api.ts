import type {
  CollectionCreateInput,
  CollectionRules,
  CollectionUpdateInput,
} from '@shared/schemas/catalogAdmin';

import { apiPage, apiRequest, type Page } from '@/lib/api/client';
import type { Dated } from '@/lib/api/dated';
import { catalogRoutes } from '@/lib/api/routes/catalog';
import { collectionsRoutes } from '@/lib/api/routes/collections';

import type { AdminCollectionRow } from '../api';

export interface CollectionDetail extends AdminCollectionRow {
  rulesJson: string | null;
  imageMediaId: string | null;
  bannerMediaId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  version: number;
  deletedAt: string | null;
}

export interface RulePreview {
  matched: number;
  sample: { id: string; name: string; sku: string }[];
}

/** The stored rules, or null when a manual collection has none (or the JSON is unreadable). */
export function parseRules(json: string | null): CollectionRules | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as CollectionRules;
  } catch {
    return null;
  }
}

export const collectionKeys = {
  all: ['collection'] as const,
  detail: (id: string) => [...collectionKeys.all, id] as const,
  preview: (rules: unknown) => [...collectionKeys.all, 'preview', rules] as const,
};

export const collectionsApi = {
  list(
    query: {
      page: number;
      limit: number;
      includeDeleted?: boolean;
      sort?: string;
      order?: 'asc' | 'desc';
    },
    signal?: AbortSignal,
  ): Promise<Page<CollectionDetail>> {
    return apiPage(catalogRoutes.collections, { query: { ...query }, signal }) as Promise<
      Page<CollectionDetail>
    >;
  },
  async get(id: string, signal?: AbortSignal) {
    return (await apiRequest(collectionsRoutes.get, { params: { id }, signal }))
      .data as CollectionDetail;
  },
  async create(input: Dated<CollectionCreateInput>) {
    return (await apiRequest(collectionsRoutes.create, { body: input })).data as CollectionDetail;
  },
  async update(id: string, input: Dated<CollectionUpdateInput>) {
    return (await apiRequest(collectionsRoutes.update, { params: { id }, body: input }))
      .data as CollectionDetail;
  },
  async remove(id: string) {
    await apiRequest(collectionsRoutes.remove, { params: { id } });
  },
  async restore(id: string) {
    return (await apiRequest(collectionsRoutes.restore, { params: { id } }))
      .data as CollectionDetail;
  },
  async setProducts(id: string, productIds: string[]) {
    await apiRequest(collectionsRoutes.setProducts, { params: { id }, body: { productIds } });
  },
  async reorderProducts(id: string, items: { id: string; position: number }[]) {
    await apiRequest(collectionsRoutes.reorderProducts, { params: { id }, body: { items } });
  },
  async previewRules(rules: CollectionRules, signal?: AbortSignal) {
    return (
      await apiRequest(collectionsRoutes.previewRules, {
        body: { rules, sampleSize: 10 },
        signal,
      })
    ).data as RulePreview;
  },
  async evaluate(id: string) {
    return (await apiRequest(collectionsRoutes.evaluate, { params: { id } })).data as Record<
      string,
      unknown
    >;
  },
};
