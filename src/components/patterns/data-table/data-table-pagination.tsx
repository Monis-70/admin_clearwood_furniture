'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { PaginationMeta } from '@shared/types/api';

import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { formatNumber } from '@/lib/format/datetime';

import { PAGE_SIZES } from './use-list-params';

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange(page: number): void;
  onLimitChange(limit: number): void;
  /** Background refetch in progress: keep the controls but avoid double clicks. */
  busy?: boolean;
}

/** Built from the API's `meta` only; the client never counts or slices rows itself. */
export function DataTablePagination({ meta, onPageChange, onLimitChange, busy }: PaginationProps) {
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  const pages = Math.max(meta.totalPages, 1);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col gap-3 border-t px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-muted-foreground" aria-live="polite">
        {meta.total === 0
          ? 'No results'
          : `Showing ${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(meta.total)}`}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span id="rows-per-page" className="text-muted-foreground">
            Rows per page
          </span>
          <NativeSelect
            size="sm"
            className="w-20"
            aria-labelledby="rows-per-page"
            value={String(meta.limit)}
            onChange={(event) => onLimitChange(Number(event.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={String(size)}>
                {size}
              </option>
            ))}
          </NativeSelect>
        </div>
        <span className="text-muted-foreground">
          Page {formatNumber(meta.page)} of {formatNumber(pages)}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            disabled={meta.page <= 1 || busy}
            onClick={() => onPageChange(meta.page - 1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            disabled={!meta.hasNext || busy}
            onClick={() => onPageChange(meta.page + 1)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>
    </nav>
  );
}
