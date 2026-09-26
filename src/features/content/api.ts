import { apiPage, apiRequest, type Page } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';

/** Fields of `GET /admin/cms/pages` rows the list shows (the API also returns every block). */
export interface CmsPageRow {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  isSystem: boolean;
  noIndex: boolean;
  publishedAt: string | null;
  scheduledAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
}

/** Fields of `GET /admin/cms/banners` rows the list shows. */
export interface BannerRow {
  id: string;
  name: string;
  placement: string;
  headline: string | null;
  isActive: boolean;
  deviceVisibility: string;
  position: number;
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string;
}

export interface PageListQuery {
  page: number;
  limit: number;
  sort?: string;
  order: 'asc' | 'desc';
  q?: string;
  status?: string;
  type?: string;
}

export interface BannerListQuery {
  page: number;
  limit: number;
  sort?: string;
  order: 'asc' | 'desc';
  placement?: string;
  isActive?: string;
}

export const contentKeys = {
  all: ['content'] as const,
  pages: (query: PageListQuery) => [...contentKeys.all, 'pages', query] as const,
  banners: (query: BannerListQuery) => [...contentKeys.all, 'banners', query] as const,
  seoPreview: (type: string, id: string) => [...contentKeys.all, 'seo', type, id] as const,
};

export const contentApi = {
  async seoPreview(type: string, id: string, signal?: AbortSignal) {
    return (await apiRequest(endpoints.content.seoPreview, { params: { type, id }, signal }))
      .data as Record<string, unknown>;
  },
  async rebuildSitemap() {
    return (await apiRequest(endpoints.content.rebuildSitemap)).data as {
      sections?: Record<string, number>;
    };
  },
  pages(query: PageListQuery, signal?: AbortSignal): Promise<Page<CmsPageRow>> {
    return apiPage<CmsPageRow>(endpoints.content.pages, { query: { ...query }, signal });
  },
  banners(query: BannerListQuery, signal?: AbortSignal): Promise<Page<BannerRow>> {
    return apiPage<BannerRow>(endpoints.content.banners, { query: { ...query }, signal });
  },
};
