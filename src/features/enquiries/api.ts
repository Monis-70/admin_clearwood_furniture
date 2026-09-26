import type { EnquiryStatus } from '@shared/enums';
import type { AdminEnquiryDto, AdminEnquirySummaryDto } from '@shared/types/enquiry';

import { apiPage, apiRequest, type Page } from '@/lib/api/client';
import { enquiriesRoutes } from '@/lib/api/routes/enquiries';

export interface EnquiryListQuery {
  page: number;
  limit: number;
  sort?: string;
  order: 'asc' | 'desc';
  q?: string;
  status?: EnquiryStatus;
  formKey?: string;
}

export const enquiryKeys = {
  all: ['enquiries'] as const,
  list: (query: EnquiryListQuery) => [...enquiryKeys.all, 'list', query] as const,
  detail: (id: string) => [...enquiryKeys.all, 'detail', id] as const,
};

export const enquiriesApi = {
  list(query: EnquiryListQuery, signal?: AbortSignal): Promise<Page<AdminEnquirySummaryDto>> {
    return apiPage<AdminEnquirySummaryDto>(enquiriesRoutes.list, {
      query: { ...query },
      signal,
    });
  },
  async get(id: string, signal?: AbortSignal): Promise<AdminEnquiryDto> {
    const { data } = await apiRequest(enquiriesRoutes.get, { params: { id }, signal });
    return data as AdminEnquiryDto;
  },
};
