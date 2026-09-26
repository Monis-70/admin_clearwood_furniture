import type { ImportEntity } from '@shared/enums';
import type { ImportJobDto } from '@shared/types/catalogAdmin';

import { apiDownload, apiPage, apiRequest, type Page } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';

export const importKeys = {
  all: ['import'] as const,
  jobs: (page: number) => [...importKeys.all, 'jobs', page] as const,
  job: (id: string) => [...importKeys.all, 'job', id] as const,
};

export const importApi = {
  async upload(entity: ImportEntity, file: File) {
    const form = new FormData();
    form.append('dryRun', 'true');
    form.append('files', file);
    return (await apiRequest(endpoints.importExport.upload, { params: { entity }, form }))
      .data as ImportJobDto;
  },
  async commit(id: string, file: File, idempotencyKey: string) {
    const form = new FormData();
    form.append('files', file);
    return (
      await apiRequest(endpoints.importExport.commit, { params: { id }, form, idempotencyKey })
    ).data as ImportJobDto;
  },
  jobs(page: number, signal?: AbortSignal): Promise<Page<ImportJobDto>> {
    return apiPage(endpoints.importExport.jobs, {
      query: { page, limit: 20, order: 'desc' },
      signal,
    }) as Promise<Page<ImportJobDto>>;
  },
  async job(id: string, signal?: AbortSignal) {
    return (await apiRequest(endpoints.importExport.job, { params: { id }, signal }))
      .data as ImportJobDto;
  },
  template(entity: ImportEntity) {
    return apiDownload(endpoints.importExport.template, { params: { entity } });
  },
  exportCsv(entity: ImportEntity, query: Record<string, string | undefined>) {
    return apiDownload(endpoints.importExport.exportCsv, { params: { entity }, query });
  },
};
