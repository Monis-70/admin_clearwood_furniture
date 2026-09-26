import type { SynonymCreateInput, SynonymUpdateInput } from '@shared/schemas/storefront';
import type {
  CollectionEvaluationDto,
  SearchAnalyticsDto,
  SearchIndexJobDto,
} from '@shared/types/storefront';
import type { MediaGarbageReportDto } from '@shared/types/media';

import { apiPage, apiRequest, type Page } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';

/** `GET /admin/search/synonyms` rows (backend SynonymDto; not in @clearwood/shared). */
export interface SynonymRow {
  term: string;
  synonyms: string[];
  isTwoWay: boolean;
  isActive: boolean;
  note: string | null;
  updatedAt: string;
}

export interface SearchDocumentView {
  stored: Record<string, unknown> | null;
  rebuilt: Record<string, unknown> | null;
}

export const searchKeys = {
  all: ['search-admin'] as const,
  analytics: (days: number) => [...searchKeys.all, 'analytics', days] as const,
  synonyms: (query: object) => [...searchKeys.all, 'synonyms', query] as const,
  jobs: () => [...searchKeys.all, 'jobs'] as const,
  document: (id: string) => [...searchKeys.all, 'document', id] as const,
};

export const searchApi = {
  async analytics(days: number, signal?: AbortSignal) {
    return (await apiRequest(endpoints.search.analytics, { query: { days, limit: 20 }, signal }))
      .data as SearchAnalyticsDto;
  },
  synonyms(
    query: { page: number; limit: number },
    signal?: AbortSignal,
  ): Promise<Page<SynonymRow>> {
    return apiPage<SynonymRow>(endpoints.search.synonyms, { query: { ...query }, signal });
  },
  async createSynonym(input: SynonymCreateInput) {
    return (await apiRequest(endpoints.search.createSynonym, { body: input })).data as SynonymRow;
  },
  async updateSynonym(term: string, input: SynonymUpdateInput) {
    return (await apiRequest(endpoints.search.updateSynonym, { params: { term }, body: input }))
      .data as SynonymRow;
  },
  async removeSynonym(term: string) {
    await apiRequest(endpoints.search.removeSynonym, { params: { term } });
  },
  async jobs(signal?: AbortSignal) {
    return (await apiRequest(endpoints.search.jobs, { signal })).data as SearchIndexJobDto[];
  },
  async job(id: string, signal?: AbortSignal) {
    return (await apiRequest(endpoints.search.job, { params: { id }, signal }))
      .data as SearchIndexJobDto;
  },
  async reindex(input: { entityType?: string; full: boolean }) {
    return (
      await apiRequest(endpoints.search.reindex, {
        query: { ...(input.entityType ? { entityType: input.entityType } : {}), full: input.full },
      })
    ).data as SearchIndexJobDto;
  },
  async recomputePopularity() {
    return (await apiRequest(endpoints.search.recomputePopularity)).data as { updated: number };
  },
  async productDocument(id: string, signal?: AbortSignal) {
    return (await apiRequest(endpoints.search.productDocument, { params: { id }, signal }))
      .data as SearchDocumentView;
  },
};

export const maintenanceApi = {
  async evaluateAllCollections() {
    return (await apiRequest(endpoints.maintenance.evaluateAllCollections))
      .data as CollectionEvaluationDto[];
  },
  async storageReport(signal?: AbortSignal) {
    return (await apiRequest(endpoints.maintenance.storageReport, { signal }))
      .data as MediaGarbageReportDto;
  },
};
