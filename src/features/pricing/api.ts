import type {
  PriceAdjustmentCreateInput,
  PriceAdjustmentUpdateInput,
} from '@shared/schemas/catalogAdmin';
import type { PriceAdjustmentConflictDto } from '@shared/types/catalogAdmin';

import { apiPage, apiRequest, type Page } from '@/lib/api/client';
import type { Dated } from '@/lib/api/dated';
import { priceAdjustmentsRoutes } from '@/lib/api/routes/priceAdjustments';

export interface PriceAdjustmentRow {
  id: string;
  name: string;
  scope: string;
  adjustmentType: string;
  basis: string;
  priority: number;
  isActive: boolean;
  valuePaise: number | null;
  valueBp: number | null;
  categoryId: string | null;
  productId: string | null;
  variantId: string | null;
  attributeId: string | null;
  attributeValueId: string | null;
  minQty: number | null;
  maxQty: number | null;
  startsAt: string | null;
  endsAt: string | null;
  note: string | null;
  version: number;
  updatedAt: string;
}

export type PriceAdjustmentConflict = PriceAdjustmentConflictDto;

export const pricingKeys = {
  adjustments: ['price-adjustments'] as const,
  list: (query: object) => [...pricingKeys.adjustments, 'list', query] as const,
  conflicts: () => [...pricingKeys.adjustments, 'conflicts'] as const,
};

export const priceAdjustmentsApi = {
  list(
    query: {
      page: number;
      limit: number;
      scope?: string;
      productId?: string;
      categoryId?: string;
      sort?: string;
      order?: 'asc' | 'desc';
    },
    signal?: AbortSignal,
  ): Promise<Page<PriceAdjustmentRow>> {
    return apiPage(priceAdjustmentsRoutes.list, { query: { ...query }, signal }) as Promise<
      Page<PriceAdjustmentRow>
    >;
  },
  async conflicts(signal?: AbortSignal) {
    return (await apiRequest(priceAdjustmentsRoutes.conflicts, { signal }))
      .data as PriceAdjustmentConflict[];
  },
  async create(input: Dated<PriceAdjustmentCreateInput>) {
    return (await apiRequest(priceAdjustmentsRoutes.create, { body: input }))
      .data as PriceAdjustmentRow;
  },
  async update(id: string, input: Dated<PriceAdjustmentUpdateInput>) {
    return (await apiRequest(priceAdjustmentsRoutes.update, { params: { id }, body: input }))
      .data as PriceAdjustmentRow;
  },
  async remove(id: string) {
    await apiRequest(priceAdjustmentsRoutes.remove, { params: { id } });
  },
};
