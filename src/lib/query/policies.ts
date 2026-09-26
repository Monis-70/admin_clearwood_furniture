import { keepPreviousData } from '@tanstack/react-query';

/**
 * Cache policies, chosen per kind of data rather than globally (docs/ADMIN_STATE_AND_ERROR_MODEL.md
 * §2). Every figure trades freshness against the API's per-IP budget (120 requests/min, shared by
 * everyone behind one office connection) and database work.
 *
 * - `refetchOnWindowFocus` only refetches data that is already stale, so short-lived lists stay
 *   current when an operator comes back to the tab, while reference data rarely refetches.
 * - Heavy or diagnostic reads never refetch on their own; the operator asks for them.
 */
export const cachePolicy = {
  /** Build/driver info: changes only with a deploy. */
  config: { staleTime: 30 * 60_000, gcTime: 60 * 60_000, refetchOnWindowFocus: false },
  /** Pickers and trees shared by many screens (categories, attributes, brands, tax classes…). */
  reference: { staleTime: 5 * 60_000, gcTime: 30 * 60_000 },
  /** Paginated tables: keep the previous page visible while the next one loads. */
  list: { staleTime: 30_000, gcTime: 5 * 60_000, placeholderData: keepPreviousData },
  /** One record being viewed or edited; mutation responses overwrite it directly. */
  detail: { staleTime: 60_000, gcTime: 10 * 60_000 },
  /** Status probes shown on System status: always fetched when opened, refreshed by hand. */
  probe: { staleTime: 0, gcTime: 60_000, refetchOnWindowFocus: false, retry: false },
  /** Expensive reports and scans: fetched on request, never in the background. */
  diagnostic: { staleTime: 5 * 60_000, gcTime: 10 * 60_000, refetchOnWindowFocus: false },
} as const;
