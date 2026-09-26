import type {
  AdminCartDetailDto,
  AdminCartRowDto,
  AdminCartStatsDto,
  AdminWishlistStatsDto,
  CartCleanupReportDto,
} from '@shared/types/cart';

import { apiPage, apiRequest, type Page } from '@/lib/api/client';
import { cartsRoutes } from '@/lib/api/routes/carts';

export interface CartListQuery {
  page: number;
  limit: number;
  sort?: string;
  order: 'asc' | 'desc';
  q?: string;
  status?: string;
  hasCustomer?: string;
  abandoned?: string;
  valueMin?: number;
}

export interface CleanupInput {
  abandonAfterHours?: number;
  expireGuestAfterDays?: number;
  expireCustomerAfterDays?: number;
}

export const cartKeys = {
  all: ['carts'] as const,
  list: (query: CartListQuery) => [...cartKeys.all, 'list', query] as const,
  stats: () => [...cartKeys.all, 'stats'] as const,
  detail: (id: string) => [...cartKeys.all, 'detail', id] as const,
  customer: (id: string) => [...cartKeys.all, 'customer', id] as const,
  wishlists: () => [...cartKeys.all, 'wishlists'] as const,
};

export const cartsApi = {
  list(query: CartListQuery, signal?: AbortSignal): Promise<Page<AdminCartRowDto>> {
    return apiPage<AdminCartRowDto>(cartsRoutes.list, { query: { ...query }, signal });
  },
  async stats(signal?: AbortSignal) {
    return (await apiRequest(cartsRoutes.stats, { signal })).data as AdminCartStatsDto;
  },
  async get(id: string, signal?: AbortSignal) {
    return (await apiRequest(cartsRoutes.get, { params: { id }, signal }))
      .data as AdminCartDetailDto;
  },
  async customerCart(customerId: string, signal?: AbortSignal) {
    return (await apiRequest(cartsRoutes.customerCart, { params: { id: customerId }, signal }))
      .data as AdminCartDetailDto | null;
  },
  async cleanup(body: CleanupInput) {
    return (await apiRequest(cartsRoutes.cleanup, { body })).data as CartCleanupReportDto;
  },
  async wishlistStats(signal?: AbortSignal) {
    return (await apiRequest(cartsRoutes.wishlistStats, { signal })).data as AdminWishlistStatsDto;
  },
};
