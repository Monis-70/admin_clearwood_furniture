'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export const PAGE_SIZES = [25, 50, 100] as const;
/** `PAGINATION.MAX_LIMIT` of @shared/constants (a test holds them equal; importing it ships every constant). */
export const MAX_LIMIT = 100;
export type SortOrder = 'asc' | 'desc';

interface ListParamOptions<F extends string> {
  /** Backend default is 25 (`ADMIN_LIST_DEFAULT_LIMIT`); the maximum is 100. */
  defaultLimit?: (typeof PAGE_SIZES)[number];
  defaultSort?: string;
  defaultOrder?: SortOrder;
  /** Filter names read from and written to the URL. */
  filters?: readonly F[];
}

type Patch = Record<string, string | number | null | undefined>;

function toInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = raw === null ? NaN : Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

/**
 * List state lives in the URL: shareable, survives reload, and every change is a single query key
 * change. Changing a filter, the search or the page size returns to page 1.
 */
export function useListParams<F extends string = never>(options: ListParamOptions<F> = {}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const defaultLimit = options.defaultLimit ?? PAGE_SIZES[0];
  const filterNames = options.filters;

  const page = toInt(searchParams.get('page'), 1, 1, 1_000_000);
  const requestedLimit = toInt(searchParams.get('limit'), defaultLimit, 1, MAX_LIMIT);
  const limit = (PAGE_SIZES as readonly number[]).includes(requestedLimit)
    ? requestedLimit
    : defaultLimit;
  const sort = searchParams.get('sort') || options.defaultSort;
  const rawOrder = searchParams.get('order');
  const order: SortOrder =
    rawOrder === 'asc' || rawOrder === 'desc' ? rawOrder : (options.defaultOrder ?? 'desc');
  const q = searchParams.get('q') ?? '';

  const filterKey = searchParams.toString();
  const filters = useMemo(() => {
    const params = new URLSearchParams(filterKey);
    const out: Partial<Record<F, string>> = {};
    for (const name of filterNames ?? []) {
      const value = params.get(name);
      if (value) out[name] = value;
    }
    return out;
  }, [filterKey, filterNames]);

  const update = useCallback(
    (patch: Patch, resetPage = true) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      }
      if (resetPage && !('page' in patch)) next.delete('page');
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const activeFilterCount = Object.keys(filters).length + (q ? 1 : 0);

  return {
    page,
    limit,
    sort,
    order,
    q,
    filters,
    activeFilterCount,
    /** Ready to spread into an API query (empty values are dropped by the client). */
    query: { page, limit, sort, order, q: q || undefined, ...filters },
    setPage: (value: number) => update({ page: value <= 1 ? null : value }, false),
    setLimit: (value: number) => update({ limit: value === defaultLimit ? null : value }),
    setSort: (field: string | null, direction: SortOrder = 'asc') =>
      update({ sort: field, order: field ? direction : null }),
    setSearch: (value: string) => update({ q: value.trim() || null }),
    setFilter: (name: F, value: string | null) => update({ [name]: value }),
    clearAll: () =>
      update(Object.fromEntries([...(filterNames ?? []), 'q'].map((name) => [name, null]))),
  };
}

export type ListParams<F extends string = never> = ReturnType<typeof useListParams<F>>;
