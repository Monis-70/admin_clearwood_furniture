import type {
  AttributeCreateInput,
  AttributeGroupCreateInput,
  AttributeGroupUpdateInput,
  AttributeUpdateInput,
  AttributeValueCreateInput,
  AttributeValueUpdateInput,
  BrandCreateInput,
  BrandUpdateInput,
  CategoryAttributeUpsertInput,
  CategoryCreateInput,
  CategoryUpdateInput,
  TaxClassCreateInput,
  TaxClassUpdateInput,
} from '@shared/schemas/catalogAdmin';
import type { DeleteStrategy } from '@shared/enums';
import type {
  AdminCategoryDto,
  AdminCategoryProductDto,
  CategoryDeleteImpactDto,
  SlugRedirectDto,
} from '@shared/types/catalogAdmin';

import { apiPage, apiRequest, type Page } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';

/**
 * Rows as the admin API returns them. Not in @clearwood/shared (the API maps Prisma rows
 * directly); fields the screens use only.
 */
export interface AttributeGroupRow {
  id: string;
  name: string;
  code: string;
  position: number;
  isActive: boolean;
}

export interface AttributeValueRow {
  id: string;
  attributeId: string;
  code: string;
  label: string;
  description: string | null;
  position: number;
  colorHex: string | null;
  swatchMediaId: string | null;
  numericValue: number | null;
  isActive: boolean;
  version: number;
}

export interface AttributeRow {
  id: string;
  code: string;
  name: string;
  groupId: string | null;
  inputType: string;
  dataType: string;
  unit: string | null;
  isVariantDefining: boolean;
  isFilterable: boolean;
  isSearchable: boolean;
  isRequired: boolean;
  isComparable: boolean;
  showInSwatch: boolean;
  position: number;
  helpText: string | null;
  isActive: boolean;
  version: number;
  values: AttributeValueRow[];
}

export interface CategoryAttributeLink {
  attributeId: string;
  isRequired: boolean;
  isVariantDefining: boolean;
  isFilterable: boolean;
  position: number;
  attribute?: Pick<AttributeRow, 'id' | 'code' | 'name' | 'inputType'>;
  name?: string;
  code?: string;
}

export interface BrandRow {
  id: string;
  name: string;
  slug: string;
  logoMediaId: string | null;
  description: string | null;
  isActive: boolean;
  position: number;
  version: number;
  productCount?: number;
  updatedAt: string;
}

export interface TaxClassRow {
  id: string;
  code: string;
  name: string;
  rateBp: number;
  hsnCode: string | null;
  isDefault: boolean;
  isActive: boolean;
  updatedAt: string;
}

export interface SimpleQuery {
  page: number;
  limit: number;
  q?: string;
  order?: 'asc' | 'desc';
  sort?: string;
}

export const taxonomyKeys = {
  categories: ['categories'] as const,
  categoryList: (query: object) => [...taxonomyKeys.categories, 'list', query] as const,
  category: (id: string) => [...taxonomyKeys.categories, id] as const,
  categoryPart: (id: string, part: string, extra?: unknown) =>
    [...taxonomyKeys.categories, id, part, extra] as const,
  attributes: ['attributes'] as const,
  attributeList: (query: object) => [...taxonomyKeys.attributes, 'list', query] as const,
  allAttributes: () => [...taxonomyKeys.attributes, 'all'] as const,
  attribute: (id: string) => [...taxonomyKeys.attributes, id] as const,
  groups: () => [...taxonomyKeys.attributes, 'groups'] as const,
  brands: ['brands'] as const,
  brandList: (query: object) => [...taxonomyKeys.brands, 'list', query] as const,
  taxClasses: ['tax-classes'] as const,
};

export const categoriesApi = {
  list(
    query: SimpleQuery & { includeDeleted?: boolean; isActive?: boolean; parentId?: string },
    signal?: AbortSignal,
  ): Promise<Page<AdminCategoryDto>> {
    return apiPage(endpoints.categories.list, { query: { ...query }, signal }) as Promise<
      Page<AdminCategoryDto>
    >;
  },
  async get(id: string, signal?: AbortSignal) {
    return (await apiRequest(endpoints.categories.get, { params: { id }, signal }))
      .data as AdminCategoryDto;
  },
  async create(input: CategoryCreateInput, idempotencyKey: string) {
    return (await apiRequest(endpoints.categories.create, { body: input, idempotencyKey }))
      .data as AdminCategoryDto;
  },
  async update(id: string, input: CategoryUpdateInput) {
    return (await apiRequest(endpoints.categories.update, { params: { id }, body: input }))
      .data as AdminCategoryDto;
  },
  async deleteImpact(id: string, strategy: DeleteStrategy, signal?: AbortSignal) {
    return (
      await apiRequest(endpoints.categories.deleteImpact, {
        params: { id },
        query: { strategy },
        signal,
      })
    ).data as CategoryDeleteImpactDto;
  },
  async remove(id: string, strategy: DeleteStrategy) {
    await apiRequest(endpoints.categories.remove, { params: { id }, query: { strategy } });
  },
  async restore(id: string) {
    return (await apiRequest(endpoints.categories.restore, { params: { id } }))
      .data as AdminCategoryDto;
  },
  async move(id: string, input: { parentId: string | null; position?: number; version: number }) {
    return (await apiRequest(endpoints.categories.move, { params: { id }, body: input }))
      .data as AdminCategoryDto;
  },
  async reorder(items: { id: string; position: number }[]) {
    await apiRequest(endpoints.categories.reorder, { body: { items } });
  },
  async bulk(ids: string[], action: 'ACTIVATE' | 'DEACTIVATE') {
    return (await apiRequest(endpoints.categories.bulk, { body: { ids, action } })).data as {
      requested: number;
      updated: number;
    };
  },
  async redirects(id: string, signal?: AbortSignal) {
    return (await apiRequest(endpoints.categories.redirects, { params: { id }, signal }))
      .data as SlugRedirectDto[];
  },
  products(id: string, page: number, signal?: AbortSignal): Promise<Page<AdminCategoryProductDto>> {
    return apiPage(endpoints.categories.products, {
      params: { id },
      query: { page, limit: 50 },
      signal,
    }) as Promise<Page<AdminCategoryProductDto>>;
  },
  async reorderProducts(id: string, items: { id: string; position: number }[]) {
    await apiRequest(endpoints.categories.reorderProducts, { params: { id }, body: { items } });
  },
  async attributes(id: string, signal?: AbortSignal) {
    return (await apiRequest(endpoints.categories.attributes, { params: { id }, signal }))
      .data as CategoryAttributeLink[];
  },
  async linkAttribute(id: string, input: CategoryAttributeUpsertInput) {
    await apiRequest(endpoints.categories.linkAttribute, { params: { id }, body: input });
  },
  async unlinkAttribute(id: string, attributeId: string) {
    await apiRequest(endpoints.categories.unlinkAttribute, { params: { id, attributeId } });
  },
};

export const attributesApi = {
  async groups(signal?: AbortSignal) {
    return (await apiRequest(endpoints.attributes.groups, { signal })).data as AttributeGroupRow[];
  },
  async createGroup(input: AttributeGroupCreateInput) {
    return (await apiRequest(endpoints.attributes.createGroup, { body: input }))
      .data as AttributeGroupRow;
  },
  async updateGroup(id: string, input: AttributeGroupUpdateInput) {
    return (await apiRequest(endpoints.attributes.updateGroup, { params: { id }, body: input }))
      .data as AttributeGroupRow;
  },
  async removeGroup(id: string) {
    await apiRequest(endpoints.attributes.removeGroup, { params: { id } });
  },
  list(
    query: SimpleQuery & { groupId?: string; isVariantDefining?: boolean },
    signal?: AbortSignal,
  ): Promise<Page<AttributeRow>> {
    return apiPage(endpoints.attributes.list, { query: { ...query }, signal }) as Promise<
      Page<AttributeRow>
    >;
  },
  /** Every attribute with its values: small reference data shared by product editors. */
  async all(signal?: AbortSignal): Promise<AttributeRow[]> {
    const rows: AttributeRow[] = [];
    for (let page = 1; page <= 10; page += 1) {
      const result = await attributesApi.list(
        { page, limit: 100, sort: 'position', order: 'asc' },
        signal,
      );
      rows.push(...result.items);
      if (!result.meta.hasNext) break;
    }
    return rows;
  },
  async get(id: string, signal?: AbortSignal) {
    return (await apiRequest(endpoints.attributes.get, { params: { id }, signal }))
      .data as AttributeRow;
  },
  async create(input: AttributeCreateInput) {
    return (await apiRequest(endpoints.attributes.create, { body: input })).data as AttributeRow;
  },
  async update(id: string, input: AttributeUpdateInput) {
    return (await apiRequest(endpoints.attributes.update, { params: { id }, body: input }))
      .data as AttributeRow;
  },
  async remove(id: string) {
    await apiRequest(endpoints.attributes.remove, { params: { id } });
  },
  async reorder(items: { id: string; position: number }[]) {
    await apiRequest(endpoints.attributes.reorder, { body: { items } });
  },
  async createValue(id: string, input: AttributeValueCreateInput) {
    return (await apiRequest(endpoints.attributes.createValue, { params: { id }, body: input }))
      .data as AttributeValueRow;
  },
  async updateValue(valueId: string, input: AttributeValueUpdateInput) {
    return (
      await apiRequest(endpoints.attributes.updateValue, { params: { valueId }, body: input })
    ).data as AttributeValueRow;
  },
  async removeValue(valueId: string) {
    await apiRequest(endpoints.attributes.removeValue, { params: { valueId } });
  },
};

export const brandsApi = {
  list(query: SimpleQuery, signal?: AbortSignal): Promise<Page<BrandRow>> {
    return apiPage(endpoints.brands.list, { query: { ...query }, signal }) as Promise<
      Page<BrandRow>
    >;
  },
  async all(signal?: AbortSignal): Promise<BrandRow[]> {
    return (await brandsApi.list({ page: 1, limit: 100, sort: 'position', order: 'asc' }, signal))
      .items;
  },
  async create(input: BrandCreateInput) {
    return (await apiRequest(endpoints.brands.create, { body: input })).data as BrandRow;
  },
  async update(id: string, input: BrandUpdateInput) {
    return (await apiRequest(endpoints.brands.update, { params: { id }, body: input }))
      .data as BrandRow;
  },
  async remove(id: string) {
    await apiRequest(endpoints.brands.remove, { params: { id } });
  },
};

export const taxClassesApi = {
  async all(signal?: AbortSignal): Promise<TaxClassRow[]> {
    return (
      (await apiPage(endpoints.taxClasses.list, {
        query: { page: 1, limit: 100 },
        signal,
      })) as Page<TaxClassRow>
    ).items;
  },
  async create(input: TaxClassCreateInput) {
    return (await apiRequest(endpoints.taxClasses.create, { body: input })).data as TaxClassRow;
  },
  async update(id: string, input: TaxClassUpdateInput) {
    return (await apiRequest(endpoints.taxClasses.update, { params: { id }, body: input }))
      .data as TaxClassRow;
  },
  async remove(id: string) {
    await apiRequest(endpoints.taxClasses.remove, { params: { id } });
  },
};
