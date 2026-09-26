'use client';

import { useQuery, type QueryKey } from '@tanstack/react-query';
import { ArrowRight, CircleCheck, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { ErrorState } from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@/components/ui/surface';
import { useInView } from '@/hooks/use-browser';
import type { Page } from '@/lib/api/client';
import { formatNumber } from '@/lib/format/datetime';
import { cachePolicy } from '@/lib/query/policies';

interface WorkQueueProps<T> {
  title: string;
  description: string;
  icon: LucideIcon;
  queryKey: QueryKey;
  load(signal: AbortSignal): Promise<Page<T>>;
  rowKey(row: T): string;
  renderRow(row: T): ReactNode;
  href: string;
  emptyText: string;
  /** Warning colour for the count when something is waiting. */
  tone?: 'warning' | 'info' | 'danger';
}

/**
 * One queue of real work from one API list (a handful of rows plus the total). It loads only when
 * scrolled into view and is cached like any list, so the dashboard costs a few small requests.
 */
export function WorkQueue<T>({
  title,
  description,
  icon: Icon,
  queryKey,
  load,
  rowKey,
  renderRow,
  href,
  emptyText,
  tone = 'warning',
}: WorkQueueProps<T>) {
  const [ref, inView] = useInView<HTMLElement>();
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => load(signal),
    enabled: inView,
    ...cachePolicy.list,
  });
  const total = query.data?.meta.total ?? 0;

  return (
    <Card ref={ref} className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
            <Icon aria-hidden className="size-4" />
          </span>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        {query.data ? (
          <Badge tone={total > 0 ? tone : 'success'}>
            {formatNumber(total)}
            <span className="sr-only"> waiting</span>
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {!query.data && !query.error ? (
          <div className="flex flex-col gap-2" role="status" aria-label={`Loading ${title}`}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} compact />
        ) : query.data.items.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleCheck aria-hidden className="size-4 text-success" />
            {emptyText}
          </p>
        ) : (
          <ul className="flex flex-col divide-y text-sm">
            {query.data.items.map((row) => (
              <li key={rowKey(row)} className="flex items-center justify-between gap-3 py-2">
                {renderRow(row)}
              </li>
            ))}
          </ul>
        )}
        {total > 0 ? (
          <Link
            href={href}
            className="mt-auto inline-flex items-center gap-1 self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {total > (query.data?.items.length ?? 0)
              ? `See all ${formatNumber(total)}`
              : 'Open the list'}
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
