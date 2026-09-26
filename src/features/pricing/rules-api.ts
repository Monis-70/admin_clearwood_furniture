import type {
  DiscountRuleCreateInput,
  DiscountRuleUpdateInput,
  PriceListCreateInput,
  PriceListItemsInput,
  PriceListUpdateInput,
  PricingSettingsUpdateInput,
  SimulateInput,
  TierPriceCreateInput,
  TierPriceUpdateInput,
} from '@shared/schemas/pricing';
import type {
  DiscountAction,
  PricingSettings,
  PricingSimulation,
  PricingTraceStep,
  RuleConditionGroup,
} from '@shared/types/pricing';

import { apiPage, apiRequest, type Page } from '@/lib/api/client';
import type { Dated } from '@/lib/api/dated';
import { pricingRoutes } from '@/lib/api/routes/pricing';

/** Rows as the admin pricing API returns them (Prisma rows; not in @clearwood/shared). */
export interface TierPriceRow {
  id: string;
  productId: string | null;
  variantId: string | null;
  customerGroupId: string | null;
  minQty: number;
  pricePaise: number | null;
  discountBp: number | null;
  isActive: boolean;
  updatedAt: string;
}

export interface PriceListRow {
  id: string;
  code: string;
  name: string;
  customerGroupId: string | null;
  channel: string;
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  version: number;
  updatedAt: string;
}

export interface PriceListItemRow {
  id: string;
  priceListId: string;
  productId: string | null;
  variantId: string | null;
  minQty: number;
  pricePaise: number;
}

export interface DiscountRuleRow {
  id: string;
  code: string;
  name: string;
  scope: string;
  priority: number;
  stopFurtherRules: boolean;
  /** JSON as stored: a RuleConditionGroup. */
  conditionsJson: string;
  /** JSON as stored: DiscountAction[]. */
  actionsJson: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  usageLimit: number | null;
  usedCount: number;
  version: number;
  updatedAt: string;
}

/** `GET /pricing/explain/{id}`: every rule that could touch a product (backend `explainProduct`). */
export interface ProductPricingExplanation {
  productId: string;
  sku: string;
  name: string;
  basePricePaise: number;
  taxClassCode: string | null;
  categoryIds: string[];
  adjustments: { id: string; name: string; scope: string; type: string; active: boolean }[];
  tiers: { id: string; minQty: number; pricePaise: number | null; discountBp: number | null }[];
  priceListItems: { id: string; priceListCode: string; pricePaise: number; minQty: number }[];
  coupons: { id: string; code: string; type: string; scopeNote: string }[];
  discountRules: { id: string; code: string; scope: string; priority: number }[];
}

export interface DiscountEvaluation {
  appliedRuleIds: string[];
  discountPaise: number;
  trace: PricingTraceStep[];
}

export const parseConditions = (row: Pick<DiscountRuleRow, 'conditionsJson'>) =>
  JSON.parse(row.conditionsJson) as RuleConditionGroup;
export const parseActions = (row: Pick<DiscountRuleRow, 'actionsJson'>) =>
  JSON.parse(row.actionsJson) as DiscountAction[];

export const rulesKeys = {
  all: ['pricing-rules'] as const,
  tiers: (query: object) => [...rulesKeys.all, 'tiers', query] as const,
  priceLists: (query: object) => [...rulesKeys.all, 'price-lists', query] as const,
  priceListItems: (id: string) => [...rulesKeys.all, 'price-list-items', id] as const,
  discountRules: (query: object) => [...rulesKeys.all, 'discount-rules', query] as const,
  explain: (id: string) => [...rulesKeys.all, 'explain', id] as const,
  settings: () => [...rulesKeys.all, 'settings'] as const,
};

interface PageQuery {
  page: number;
  limit: number;
}

type Wire<T> = Dated<T>;

export const rulesApi = {
  tiers(
    query: PageQuery & { productId?: string; variantId?: string; customerGroupId?: string },
    signal?: AbortSignal,
  ): Promise<Page<TierPriceRow>> {
    return apiPage<TierPriceRow>(pricingRoutes.tierPrices, { query: { ...query }, signal });
  },
  async createTier(input: TierPriceCreateInput) {
    return (await apiRequest<TierPriceRow>(pricingRoutes.createTierPrice, { body: input })).data;
  },
  async updateTier(id: string, input: TierPriceUpdateInput) {
    return (
      await apiRequest(pricingRoutes.updateTierPrice, {
        params: { id },
        body: input,
      })
    ).data as TierPriceRow;
  },
  async removeTier(id: string) {
    await apiRequest(pricingRoutes.removeTierPrice, { params: { id } });
  },

  priceLists(query: PageQuery, signal?: AbortSignal): Promise<Page<PriceListRow>> {
    return apiPage<PriceListRow>(pricingRoutes.priceLists, { query: { ...query }, signal });
  },
  async createPriceList(input: Wire<PriceListCreateInput>, idempotencyKey: string) {
    return (
      await apiRequest<PriceListRow>(pricingRoutes.createPriceList, {
        body: input,
        idempotencyKey,
      })
    ).data;
  },
  async updatePriceList(id: string, input: Wire<PriceListUpdateInput>) {
    return (
      await apiRequest(pricingRoutes.updatePriceList, {
        params: { id },
        body: input,
      })
    ).data as PriceListRow;
  },
  async removePriceList(id: string) {
    await apiRequest(pricingRoutes.removePriceList, { params: { id } });
  },
  async priceListItems(id: string, signal?: AbortSignal) {
    return (
      await apiRequest(pricingRoutes.priceListItems, {
        params: { id },
        signal,
      })
    ).data as PriceListItemRow[];
  },
  async setPriceListItems(id: string, input: PriceListItemsInput) {
    return (
      await apiRequest(pricingRoutes.setPriceListItems, {
        params: { id },
        body: input,
      })
    ).data as { items: number };
  },

  discountRules(query: PageQuery, signal?: AbortSignal): Promise<Page<DiscountRuleRow>> {
    return apiPage<DiscountRuleRow>(pricingRoutes.discountRules, {
      query: { ...query },
      signal,
    });
  },
  async createDiscountRule(input: Wire<DiscountRuleCreateInput>) {
    return (await apiRequest<DiscountRuleRow>(pricingRoutes.createDiscountRule, { body: input }))
      .data;
  },
  async updateDiscountRule(id: string, input: Wire<DiscountRuleUpdateInput>) {
    return (
      await apiRequest(pricingRoutes.updateDiscountRule, {
        params: { id },
        body: input,
      })
    ).data as DiscountRuleRow;
  },
  async removeDiscountRule(id: string) {
    await apiRequest(pricingRoutes.removeDiscountRule, { params: { id } });
  },
  async evaluateDiscountRules(input: Wire<SimulateInput>) {
    return (
      await apiRequest<DiscountEvaluation>(pricingRoutes.evaluateDiscountRules, {
        body: input,
      })
    ).data;
  },

  async simulate(input: Wire<SimulateInput>) {
    return (await apiRequest<PricingSimulation>(pricingRoutes.simulate, { body: input })).data;
  },
  async explain(id: string, signal?: AbortSignal) {
    return (
      await apiRequest(pricingRoutes.explain, {
        params: { id },
        signal,
      })
    ).data as ProductPricingExplanation;
  },
  async settings(signal?: AbortSignal) {
    return (await apiRequest<PricingSettings>(pricingRoutes.settings, { signal })).data;
  },
  async updateSettings(input: PricingSettingsUpdateInput) {
    return (await apiRequest<PricingSettings>(pricingRoutes.updateSettings, { body: input })).data;
  },
};
