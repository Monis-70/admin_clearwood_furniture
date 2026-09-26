import type {
  CacheDriver,
  DatabaseProvider,
  MailDriver,
  OtpDriver,
  PaymentDriver,
  SearchDriverName,
  ShippingProviderDriver,
  StorageDriver,
} from '@shared/enums';

import { apiRequest } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { isApiError } from '@/lib/api/errors';

/**
 * Shapes of the system probes. They are not in @clearwood/shared: they mirror the OpenAPI
 * schemas registered in backend/src/routes/version.routes.ts and health.routes.ts.
 */
export interface VersionInfo {
  name: string;
  version: string;
  env: 'development' | 'test' | 'production';
  drivers: {
    db: DatabaseProvider;
    cache: CacheDriver;
    storage: StorageDriver;
    mail: MailDriver;
    payment: PaymentDriver;
    otp: OtpDriver;
    /** Present in the service response although the OpenAPI schema omits them. */
    shipping?: ShippingProviderDriver;
    search?: SearchDriverName;
  };
}

export interface HealthInfo {
  status: 'ok';
  uptime: number;
  timestamp: string;
}

export interface DependencyStatus {
  status: 'up' | 'down';
  driver: string;
  latencyMs: number;
  error?: string;
}

export interface ReadinessInfo {
  status: 'ready' | 'degraded' | 'unavailable';
  timestamp: string;
  dependencies: { database: DependencyStatus; cache: DependencyStatus };
}

function isReadiness(value: unknown): value is ReadinessInfo {
  return (
    typeof value === 'object' && value !== null && 'dependencies' in value && 'status' in value
  );
}

export const systemKeys = {
  all: ['system'] as const,
  version: () => [...systemKeys.all, 'version'] as const,
  health: () => [...systemKeys.all, 'health'] as const,
  readiness: () => [...systemKeys.all, 'readiness'] as const,
};

export const systemApi = {
  async version(signal?: AbortSignal): Promise<VersionInfo> {
    return (await apiRequest<VersionInfo>(endpoints.system.version, { signal })).data;
  },

  async health(signal?: AbortSignal): Promise<HealthInfo> {
    return (await apiRequest<HealthInfo>(endpoints.system.health, { signal })).data;
  },

  /** A 503 still carries the per-dependency report in `error.details`; that report is the answer. */
  async readiness(signal?: AbortSignal): Promise<ReadinessInfo> {
    try {
      return (await apiRequest<ReadinessInfo>(endpoints.system.ready, { signal })).data;
    } catch (error) {
      if (isApiError(error) && error.status === 503 && isReadiness(error.details))
        return error.details;
      throw error;
    }
  },
};
