import type {
  CouponBulkGenerateInput,
  CouponCreateInput,
  CouponUpdateInput,
  CustomerGroupCreateInput,
  CustomerGroupUpdateInput,
} from '@shared/schemas/pricing';
import type { CouponAppliesTo } from '@shared/types/pricing';

import { apiPage, apiRequest, type Page } from '@/lib/api/client';
import type { Dated } from '@/lib/api/dated';
import { pricingRoutes } from '@/lib/api/routes/pricing';

/** Rows as the admin pricing API returns them (Prisma rows; not in @clearwood/shared). */
export interface CouponRow {
  id: string;
  code: string;
  name: string;
  type: string;
  valueBp: number | null;
  valuePaise: number | null;
  minSubtotalPaise: number | null;
  maxDiscountPaise: number | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  isStackable: boolean;
  isAutoApply: boolean;
  firstOrderOnly: boolean;
  /** JSON as stored: CouponAppliesTo or null. */
  appliesToJson: string | null;
  description: string | null;
  termsText: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** `GET /coupons/{id}` adds the redemption counts per status. */
export interface CouponDetail extends CouponRow {
  redemptions: Record<string, number>;
}

export interface CouponRedemptionRow {
  id: string;
  couponId: string;
  customerId: string | null;
  orderId: string | null;
  amountPaise: number;
  status: string;
  reservedAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
}

export interface CustomerGroupRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  priority: number;
  discountBp: number | null;
  isActive: boolean;
  version: number;
  updatedAt: string;
}

export interface GroupMemberRow {
  id: string;
  customerId: string;
  groupId: string;
  assignedAt: string;
}

export const parseAppliesTo = (row: Pick<CouponRow, 'appliesToJson'>): CouponAppliesTo | null =>
  row.appliesToJson ? (JSON.parse(row.appliesToJson) as CouponAppliesTo | null) : null;

export const promotionsKeys = {
  coupons: ['coupons'] as const,
  couponList: (query: object) => [...promotionsKeys.coupons, 'list', query] as const,
  coupon: (id: string) => [...promotionsKeys.coupons, id] as const,
  redemptions: (id: string) => [...promotionsKeys.coupons, id, 'redemptions'] as const,
  groups: ['customer-groups'] as const,
  groupList: (query: object) => [...promotionsKeys.groups, 'list', query] as const,
  members: (id: string) => [...promotionsKeys.groups, id, 'members'] as const,
};

export interface CouponListQuery {
  page: number;
  limit: number;
  q?: string;
  type?: string;
  isActive?: string;
  activeOnly?: string;
}

export const couponsApi = {
  list(query: CouponListQuery, signal?: AbortSignal): Promise<Page<CouponRow>> {
    return apiPage<CouponRow>(pricingRoutes.coupons, { query: { ...query }, signal });
  },
  async get(id: string, signal?: AbortSignal) {
    return (await apiRequest(pricingRoutes.coupon, { params: { id }, signal }))
      .data as CouponDetail;
  },
  async redemptions(id: string, signal?: AbortSignal) {
    return (
      await apiRequest(pricingRoutes.couponRedemptions, {
        params: { id },
        signal,
      })
    ).data as CouponRedemptionRow[];
  },
  async create(input: Dated<CouponCreateInput>, idempotencyKey: string) {
    return (
      await apiRequest<CouponRow>(pricingRoutes.createCoupon, { body: input, idempotencyKey })
    ).data;
  },
  async generate(
    input: Omit<CouponBulkGenerateInput, 'template'> & {
      template: Dated<CouponBulkGenerateInput['template']>;
    },
    idempotencyKey: string,
  ) {
    return (
      await apiRequest<{ codes: string[] }>(pricingRoutes.generateCoupons, {
        body: input,
        idempotencyKey,
      })
    ).data;
  },
  async update(id: string, input: Dated<CouponUpdateInput>) {
    return (await apiRequest(pricingRoutes.updateCoupon, { params: { id }, body: input }))
      .data as CouponRow;
  },
  async remove(id: string) {
    await apiRequest(pricingRoutes.removeCoupon, { params: { id } });
  },
};

export const customerGroupsApi = {
  list(
    query: { page: number; limit: number },
    signal?: AbortSignal,
  ): Promise<Page<CustomerGroupRow>> {
    return apiPage<CustomerGroupRow>(pricingRoutes.customerGroups, {
      query: { ...query },
      signal,
    });
  },
  async all(signal?: AbortSignal) {
    return (await customerGroupsApi.list({ page: 1, limit: 100 }, signal)).items;
  },
  async create(input: CustomerGroupCreateInput, idempotencyKey: string) {
    return (
      await apiRequest<CustomerGroupRow>(pricingRoutes.createCustomerGroup, {
        body: input,
        idempotencyKey,
      })
    ).data;
  },
  async update(id: string, input: CustomerGroupUpdateInput) {
    return (
      await apiRequest(pricingRoutes.updateCustomerGroup, {
        params: { id },
        body: input,
      })
    ).data as CustomerGroupRow;
  },
  async remove(id: string) {
    await apiRequest(pricingRoutes.removeCustomerGroup, { params: { id } });
  },
  async members(id: string, signal?: AbortSignal) {
    return (await apiRequest(pricingRoutes.groupMembers, { params: { id }, signal }))
      .data as GroupMemberRow[];
  },
  async addMembers(id: string, customerIds: string[]) {
    return (
      await apiRequest(pricingRoutes.addGroupMembers, {
        params: { id },
        body: { customerIds },
      })
    ).data as { added: number };
  },
  async removeMembers(id: string, customerIds: string[]) {
    return (
      await apiRequest(pricingRoutes.removeGroupMembers, {
        params: { id },
        body: { customerIds },
      })
    ).data as { removed: number };
  },
};
