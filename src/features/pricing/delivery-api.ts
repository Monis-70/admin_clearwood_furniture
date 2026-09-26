import type {
  ShippingPincodeCreateInput,
  ShippingPincodeRangeCreateInput,
  ShippingRateCreateInput,
  ShippingRateUpdateInput,
  ShippingZoneCreateInput,
  ShippingZoneUpdateInput,
} from '@shared/schemas/pricing';

import { apiRequest } from '@/lib/api/client';
import { pricingRoutes } from '@/lib/api/routes/pricing';

/** Rows as the admin shipping API returns them (Prisma rows; not in @clearwood/shared). */
export interface ZoneRow {
  id: string;
  code: string;
  name: string;
  priority: number;
  isActive: boolean;
  version: number;
  updatedAt: string;
}

export interface RateRow {
  id: string;
  zoneId: string;
  method: string;
  name: string;
  conditionType: string;
  minValue: number | null;
  maxValue: number | null;
  basePaise: number;
  perUnitPaise: number | null;
  freeAbovePaise: number | null;
  etaMinDays: number | null;
  etaMaxDays: number | null;
  isActive: boolean;
  priority: number;
  version: number;
  updatedAt: string;
}

export interface PincodeRow {
  id: string;
  zoneId: string;
  pincode: string;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  isServiceable: boolean;
  codAvailable: boolean;
  etaMinDays: number | null;
  etaMaxDays: number | null;
}

export const deliveryKeys = {
  all: ['delivery'] as const,
  zones: () => [...deliveryKeys.all, 'zones'] as const,
  rates: () => [...deliveryKeys.all, 'rates'] as const,
  pincodes: (zoneId: string) => [...deliveryKeys.all, 'pincodes', zoneId] as const,
};

export const deliveryApi = {
  async zones(signal?: AbortSignal) {
    return (await apiRequest<ZoneRow[]>(pricingRoutes.zones, { signal })).data;
  },
  async createZone(input: ShippingZoneCreateInput) {
    return (await apiRequest<ZoneRow>(pricingRoutes.createZone, { body: input })).data;
  },
  async updateZone(id: string, input: ShippingZoneUpdateInput) {
    return (await apiRequest(pricingRoutes.updateZone, { params: { id }, body: input }))
      .data as ZoneRow;
  },
  async removeZone(id: string) {
    await apiRequest(pricingRoutes.removeZone, { params: { id } });
  },
  async rates(signal?: AbortSignal) {
    return (await apiRequest<RateRow[]>(pricingRoutes.rates, { signal })).data;
  },
  async createRate(input: ShippingRateCreateInput) {
    return (await apiRequest<RateRow>(pricingRoutes.createRate, { body: input })).data;
  },
  async updateRate(id: string, input: ShippingRateUpdateInput) {
    return (await apiRequest(pricingRoutes.updateRate, { params: { id }, body: input }))
      .data as RateRow;
  },
  async removeRate(id: string) {
    await apiRequest(pricingRoutes.removeRate, { params: { id } });
  },
  async pincodes(zoneId: string, signal?: AbortSignal) {
    return (await apiRequest<PincodeRow[]>(pricingRoutes.pincodes, { query: { zoneId }, signal }))
      .data;
  },
  async createPincode(input: ShippingPincodeCreateInput) {
    return (await apiRequest<PincodeRow>(pricingRoutes.createPincode, { body: input })).data;
  },
  async removePincode(id: string) {
    await apiRequest(pricingRoutes.removePincode, { params: { id } });
  },
  async createRange(input: ShippingPincodeRangeCreateInput) {
    return (await apiRequest(pricingRoutes.createPincodeRange, { body: input })).data;
  },
  async importPincodes(zoneId: string, file: File) {
    const form = new FormData();
    form.append('files', file);
    return (
      await apiRequest(pricingRoutes.importPincodes, {
        params: { id: zoneId },
        form,
      })
    ).data as { imported: number; skipped: number };
  },
};
