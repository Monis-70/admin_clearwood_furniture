import type { z } from 'zod';

import type {
  BulkActionInput,
  InventoryAdjustInput,
  InventoryBulkAdjustInput,
  ProductAttributeValuesInput,
  ProductCategoriesInput,
  ProductDuplicateInput,
  ProductRelationsInput,
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
import { inventoryRoutes } from '@/lib/api/routes/inventory';
import { productsRoutes } from '@/lib/api/routes/products';
import { variantsRoutes } from '@/lib/api/routes/variants';

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
    return (await apiRequest(productsRoutes.get, { params: { id }, signal }))
      .data as AdminProductDetailDto;
  },
  async create(input: Wire<z.input<typeof productCreateSchema>>, idempotencyKey: string) {
    return (await apiRequest(productsRoutes.create, { body: input, idempotencyKey }))
      .data as AdminProductDetailDto;
  },
  async update(id: string, input: Wire<ProductUpdateInput>) {
    return (await apiRequest(productsRoutes.update, { params: { id }, body: input }))
      .data as AdminProductDetailDto;
  },
  async remove(id: string) {
    await apiRequest(productsRoutes.remove, { params: { id } });
  },
  async restore(id: string) {
    return (await apiRequest(productsRoutes.restore, { params: { id } }))
      .data as AdminProductDetailDto;
  },
  async duplicate(id: string, input: ProductDuplicateInput, idempotencyKey: string) {
    return (
      await apiRequest(productsRoutes.duplicate, {
        params: { id },
        body: input,
        idempotencyKey,
      })
    ).data as AdminProductDetailDto;
  },
  async publish(id: string, publishAt?: string) {
    return (
      await apiRequest(productsRoutes.publish, {
        params: { id },
        body: publishAt ? { publishAt } : {},
      })
    ).data as AdminProductDetailDto;
  },
  async unpublish(id: string) {
    return (await apiRequest(productsRoutes.unpublish, { params: { id } }))
      .data as AdminProductDetailDto;
  },
  async blockers(id: string, signal?: AbortSignal) {
    return (await apiRequest(productsRoutes.blockers, { params: { id }, signal }))
      .data as PublishBlockerDto[];
  },
  async redirects(id: string, signal?: AbortSignal) {
    return (await apiRequest(productsRoutes.redirects, { params: { id }, signal }))
      .data as SlugRedirectDto[];
  },
  async setCategories(id: string, input: ProductCategoriesInput) {
    return (await apiRequest(productsRoutes.setCategories, { params: { id }, body: input }))
      .data as AdminProductDetailDto;
  },
  async setAttributeValues(id: string, input: ProductAttributeValuesInput) {
    return (await apiRequest(productsRoutes.setAttributeValues, { params: { id }, body: input }))
      .data as AdminProductDetailDto;
  },
  async setRelations(id: string, input: ProductRelationsInput) {
    return (await apiRequest(productsRoutes.setRelations, { params: { id }, body: input }))
      .data as AdminProductDetailDto;
  },
  async bulk(input: BulkInput, idempotencyKey: string) {
    return (await apiRequest(productsRoutes.bulk, { body: input, idempotencyKey }))
      .data as BulkActionResultDto;
  },
};

export const variantsApi = {
  async list(id: string, signal?: AbortSignal) {
    return (
      await apiRequest(variantsRoutes.list, {
        params: { id },
        query: { limit: 100, includeInactive: true },
        signal,
      })
    ).data as AdminVariantDto[];
  },
  async create(id: string, input: VariantCreateInput) {
    return (await apiRequest(variantsRoutes.create, { params: { id }, body: input }))
      .data as AdminVariantDto;
  },
  async update(id: string, variantId: string, input: VariantUpdateInput) {
    return (await apiRequest(variantsRoutes.update, { params: { id, variantId }, body: input }))
      .data as AdminVariantDto;
  },
  async remove(id: string, variantId: string) {
    await apiRequest(variantsRoutes.remove, { params: { id, variantId } });
  },
  async setDefault(id: string, variantId: string) {
    return (await apiRequest(variantsRoutes.setDefault, { params: { id, variantId } }))
      .data as AdminVariantDto;
  },
  async reorder(id: string, items: { id: string; position: number }[]) {
    await apiRequest(variantsRoutes.reorder, { params: { id }, body: { items } });
  },
  async preview(id: string, input: VariantMatrixInput) {
    return (await apiRequest(variantsRoutes.matrixPreview, { params: { id }, body: input }))
      .data as VariantMatrixPreviewDto;
  },
  async generate(id: string, input: VariantMatrixInput, idempotencyKey: string) {
    return (
      await apiRequest(variantsRoutes.matrixGenerate, {
        params: { id },
        body: input,
        idempotencyKey,
      })
    ).data as { preview: VariantMatrixPreviewDto; created: number };
  },
};

export const inventoryApi = {
  async snapshot(variantId: string, signal?: AbortSignal) {
    return (await apiRequest(inventoryRoutes.snapshot, { params: { id: variantId }, signal }))
      .data as InventorySnapshotDto;
  },
  history(
    variantId: string,
    page: number,
    signal?: AbortSignal,
  ): Promise<Page<InventoryLedgerEntryDto>> {
    return apiPage(inventoryRoutes.history, {
      params: { id: variantId },
      query: { page, limit: 20, order: 'desc' },
      signal,
    }) as Promise<Page<InventoryLedgerEntryDto>>;
  },
  async adjust(variantId: string, input: InventoryAdjustInput, idempotencyKey: string) {
    return (
      await apiRequest(inventoryRoutes.adjust, {
        params: { id: variantId },
        body: input,
        idempotencyKey,
      })
    ).data as { snapshot: InventorySnapshotDto; entry: InventoryLedgerEntryDto };
  },
  async bulkAdjust(input: InventoryBulkAdjustInput, idempotencyKey: string) {
    return (await apiRequest(inventoryRoutes.bulkAdjust, { body: input, idempotencyKey })).data as {
      results: {
        variantId: string;
        ok: boolean;
        code: string | null;
        balanceAfter: number | null;
      }[];
    };
  },
};
