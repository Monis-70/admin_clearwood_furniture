import type {
  ShippingPincodeCreateInput,
  ShippingPincodeRangeCreateInput,
  ShippingRateCreateInput,
  ShippingRateUpdateInput,
  ShippingZoneCreateInput,
  ShippingZoneUpdateInput,
} from '@shared/schemas/pricing';

import { apiRequest } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';

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
    return (await apiRequest<ZoneRow[]>(endpoints.pricing.zones, { signal })).data;
  },
  async createZone(input: ShippingZoneCreateInput) {
    return (await apiRequest<ZoneRow>(endpoints.pricing.createZone, { body: input })).data;
  },
  async updateZone(id: string, input: ShippingZoneUpdateInput) {
    return (await apiRequest(endpoints.pricing.updateZone, { params: { id }, body: input }))
      .data as ZoneRow;
  },
  async removeZone(id: string) {
    await apiRequest(endpoints.pricing.removeZone, { params: { id } });
  },
  async rates(signal?: AbortSignal) {
    return (await apiRequest<RateRow[]>(endpoints.pricing.rates, { signal })).data;
  },
  async createRate(input: ShippingRateCreateInput) {
    return (await apiRequest<RateRow>(endpoints.pricing.createRate, { body: input })).data;
  },
  async updateRate(id: string, input: ShippingRateUpdateInput) {
    return (await apiRequest(endpoints.pricing.updateRate, { params: { id }, body: input }))
      .data as RateRow;
  },
  async removeRate(id: string) {
    await apiRequest(endpoints.pricing.removeRate, { params: { id } });
  },
  async pincodes(zoneId: string, signal?: AbortSignal) {
    return (
      await apiRequest<PincodeRow[]>(endpoints.pricing.pincodes, { query: { zoneId }, signal })
    ).data;
  },
  async createPincode(input: ShippingPincodeCreateInput) {
    return (await apiRequest<PincodeRow>(endpoints.pricing.createPincode, { body: input })).data;
  },
  async removePincode(id: string) {
    await apiRequest(endpoints.pricing.removePincode, { params: { id } });
  },
  async createRange(input: ShippingPincodeRangeCreateInput) {
    return (await apiRequest(endpoints.pricing.createPincodeRange, { body: input })).data;
  },
  async importPincodes(zoneId: string, file: File) {
    const form = new FormData();
    form.append('files', file);
    return (
      await apiRequest(endpoints.pricing.importPincodes, {
        params: { id: zoneId },
        form,
      })
    ).data as { imported: number; skipped: number };
  },
};
