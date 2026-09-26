import { QueryClient } from '@tanstack/react-query';

import { isApiError } from '@/lib/api/errors';

const TRANSIENT_CODES = new Set([
  'NETWORK_ERROR',
  'TIMEOUT',
  'UPSTREAM_UNAVAILABLE',
  'GATEWAY_TIMEOUT',
  'SERVICE_UNAVAILABLE',
]);

/**
 * One retry, only for failures that a second attempt can fix. 4xx answers (validation,
 * permission, rate limit) are final: repeating them costs budget and changes nothing.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  if (!isApiError(error)) return false;
  return (
    TRANSIENT_CODES.has(error.code) ||
    error.status === 502 ||
    error.status === 503 ||
    error.status === 504
  );
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetryQuery,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
