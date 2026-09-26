import type { z } from 'zod';

import type {
  BulkActionInput,
  InventoryAdjustInput,
  InventoryBulkAdjustInput,
  ProductAttributeValuesInput,
  ProductCategoriesInput,
  ProductDuplicateInput,
  ProductUpdateInput,
  VariantCreateInput,
  VariantMatrixInput,
  VariantUpdateInput,
  productCreateSchema,
} from '@shared/schemas/catalogAdmin';
import type {
  AdminProductDetailDto,
  AdminVariantDto,
  BulkActionResultDto,
  InventoryLedgerEntryDto,
  InventorySnapshotDto,
  PublishBlockerDto,
  SlugRedirectDto,
  VariantMatrixPreviewDto,
} from '@shared/types/catalogAdmin';

import { apiPage, apiRequest, type Page } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';

/** JSON bodies carry dates as ISO strings; the shared input types describe the parsed form. */
type Wire<T> = {
  [K in keyof T]: T[K] extends Date | null | undefined ? string | null | undefined : T[K];
};

export const productKeys = {
  all: ['product'] as const,
  detail: (id: string) => [...productKeys.all, id] as const,
  variants: (id: string) => [...productKeys.all, id, 'variants'] as const,
  redirects: (id: string) => [...productKeys.all, id, 'redirects'] as const,
  stock: (variantId: string) => ['inventory', variantId] as const,
  ledger: (variantId: string, page: number) => ['inventory', variantId, 'ledger', page] as const,
};

export interface BulkInput extends Omit<Wire<BulkActionInput>, 'merchandising'> {
  merchandising?: BulkActionInput['merchandising'];
}

export const productsApi = {
  async get(id: string, signal?: AbortSignal) {
    return (await apiRequest(endpoints.products.get, { params: { id }, signal }))
      .data as AdminProductDetailDto;
  },
  async create(input: Wire<z.input<typeof productCreateSchema>>, idempotencyKey: string) {
    return (await apiRequest(endpoints.products.create, { body: input, idempotencyKey }))
      .data as AdminProductDetailDto;
  },
  async update(id: string, input: Wire<ProductUpdateInput>) {
    return (await apiRequest(endpoints.products.update, { params: { id }, body: input }))
      .data as AdminProductDetailDto;
  },
  async remove(id: string) {
    await apiRequest(endpoints.products.remove, { params: { id } });
  },
  async restore(id: string) {
    return (await apiRequest(endpoints.products.restore, { params: { id } }))
      .data as AdminProductDetailDto;
  },
  async duplicate(id: string, input: ProductDuplicateInput, idempotencyKey: string) {
    return (
      await apiRequest(endpoints.products.duplicate, {
        params: { id },
        body: input,
        idempotencyKey,
      })
    ).data as AdminProductDetailDto;
  },
  async publish(id: string, publishAt?: string) {
    return (
      await apiRequest(endpoints.products.publish, {
        params: { id },
        body: publishAt ? { publishAt } : {},
      })
    ).data as AdminProductDetailDto;
  },
  async unpublish(id: string) {
    return (await apiRequest(endpoints.products.unpublish, { params: { id } }))
      .data as AdminProductDetailDto;
  },
  async blockers(id: string, signal?: AbortSignal) {
    return (await apiRequest(endpoints.products.blockers, { params: { id }, signal }))
      .data as PublishBlockerDto[];
  },
  async redirects(id: string, signal?: AbortSignal) {
    return (await apiRequest(endpoints.products.redirects, { params: { id }, signal }))
      .data as SlugRedirectDto[];
  },
  async setCategories(id: string, input: ProductCategoriesInput) {
    return (await apiRequest(endpoints.products.setCategories, { params: { id }, body: input }))
      .data as AdminProductDetailDto;
  },
  async setAttributeValues(id: string, input: ProductAttributeValuesInput) {
    return (
      await apiRequest(endpoints.products.setAttributeValues, { params: { id }, body: input })
    ).data as AdminProductDetailDto;
  },
  async bulk(input: BulkInput, idempotencyKey: string) {
    return (await apiRequest(endpoints.products.bulk, { body: input, idempotencyKey }))
      .data as BulkActionResultDto;
  },
};

export const variantsApi = {
  async list(id: string, signal?: AbortSignal) {
    return (
      await apiRequest(endpoints.variants.list, {
        params: { id },
        query: { limit: 100, includeInactive: true },
        signal,
      })
    ).data as AdminVariantDto[];
  },
  async create(id: string, input: VariantCreateInput) {
    return (await apiRequest(endpoints.variants.create, { params: { id }, body: input }))
      .data as AdminVariantDto;
  },
  async update(id: string, variantId: string, input: VariantUpdateInput) {
    return (await apiRequest(endpoints.variants.update, { params: { id, variantId }, body: input }))
      .data as AdminVariantDto;
  },
  async remove(id: string, variantId: string) {
    await apiRequest(endpoints.variants.remove, { params: { id, variantId } });
  },
  async setDefault(id: string, variantId: string) {
    return (await apiRequest(endpoints.variants.setDefault, { params: { id, variantId } }))
      .data as AdminVariantDto;
  },
  async reorder(id: string, items: { id: string; position: number }[]) {
    await apiRequest(endpoints.variants.reorder, { params: { id }, body: { items } });
  },
  async preview(id: string, input: VariantMatrixInput) {
    return (await apiRequest(endpoints.variants.matrixPreview, { params: { id }, body: input }))
      .data as VariantMatrixPreviewDto;
  },
  async generate(id: string, input: VariantMatrixInput, idempotencyKey: string) {
    return (
      await apiRequest(endpoints.variants.matrixGenerate, {
        params: { id },
        body: input,
        idempotencyKey,
      })
    ).data as { preview: VariantMatrixPreviewDto; created: number };
  },
};

export const inventoryApi = {
  async snapshot(variantId: string, signal?: AbortSignal) {
    return (await apiRequest(endpoints.inventory.snapshot, { params: { id: variantId }, signal }))
      .data as InventorySnapshotDto;
  },
  history(
    variantId: string,
    page: number,
    signal?: AbortSignal,
  ): Promise<Page<InventoryLedgerEntryDto>> {
    return apiPage(endpoints.inventory.history, {
      params: { id: variantId },
      query: { page, limit: 20, order: 'desc' },
      signal,
    }) as Promise<Page<InventoryLedgerEntryDto>>;
  },
  async adjust(variantId: string, input: InventoryAdjustInput, idempotencyKey: string) {
    return (
      await apiRequest(endpoints.inventory.adjust, {
        params: { id: variantId },
        body: input,
        idempotencyKey,
      })
    ).data as { snapshot: InventorySnapshotDto; entry: InventoryLedgerEntryDto };
  },
  async bulkAdjust(input: InventoryBulkAdjustInput, idempotencyKey: string) {
    return (await apiRequest(endpoints.inventory.bulkAdjust, { body: input, idempotencyKey }))
      .data as {
      results: {
        variantId: string;
        ok: boolean;
        code: string | null;
        balanceAfter: number | null;
      }[];
    };
  },
};
