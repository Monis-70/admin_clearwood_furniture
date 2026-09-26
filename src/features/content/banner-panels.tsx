'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';

import { EmptyState, ErrorState, SectionLoader } from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatNumber } from '@/lib/format/datetime';
import { cachePolicy } from '@/lib/query/policies';

import { contentApi, contentKeys, type BannerListQuery } from './api';
import { ReorderList } from './kit';
import { PLACEMENT_LABELS, reorderBody } from './model';

const pct = (bp: number) => `${(bp / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
export function OrderDialog({
  placement,
  onClose,
  onSaved,
}: {
  placement: string;
  onClose(): void;
  onSaved(): void;
}) {
  const query: BannerListQuery = { page: 1, limit: 100, order: 'asc', placement };
  const rows = useQuery({
    queryKey: contentKeys.banners(query),
    queryFn: ({ signal }) => contentApi.banners(query, signal),
    ...cachePolicy.list,
  });
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Order: {PLACEMENT_LABELS[placement] ?? placement}</DialogTitle>
          <DialogDescription>The first banner shows first (or alone).</DialogDescription>
        </DialogHeader>
        {rows.isPending ? (
          <SectionLoader label="Loading banners…" />
        ) : rows.error ? (
          <ErrorState error={rows.error} onRetry={() => void rows.refetch()} compact />
        ) : (
          <ReorderList
            items={[...rows.data.items].sort((a, b) => a.position - b.position)}
            label="Banner order"
            canReorder
            render={(b) => (
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{b.name}</span>
                {b.isActive ? null : <Badge tone="neutral">Off</Badge>}
              </span>
            )}
            onSave={async (ids) => {
              await contentApi.reorderBanners(reorderBody(ids));
              onSaved();
              onClose();
            }}
            empty={
              <EmptyState
                title="No banners in this placement"
                description="Create a banner and choose this placement; the order is set here."
                compact
              />
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function StatsDialog({ id, onClose }: { id: string; onClose(): void }) {
  const stats = useQuery({
    queryKey: contentKeys.bannerStats(id),
    queryFn: ({ signal }) => contentApi.bannerStats(id, signal),
    ...cachePolicy.diagnostic,
  });
  const days = new Map<string, { views: number; clicks: number }>();
  for (const d of stats.data?.daily ?? []) {
    const day = days.get(d.dayKey) ?? { views: 0, clicks: 0 };
    if (d.entityType === 'BANNER_CLICK') day.clicks += d.viewCount;
    else day.views += d.viewCount;
    days.set(d.dayKey, day);
  }
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 aria-hidden className="size-4" />
            {stats.data ? stats.data.name : 'Banner statistics'}
          </DialogTitle>
          <DialogDescription>Counted by the storefront; up to the last 60 days.</DialogDescription>
        </DialogHeader>
        {stats.isPending ? (
          <SectionLoader label="Loading statistics…" />
        ) : stats.error ? (
          <ErrorState error={stats.error} onRetry={() => void stats.refetch()} compact />
        ) : (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-3 gap-3">
              {[
                ['Views', formatNumber(stats.data.impressionCount)],
                ['Clicks', formatNumber(stats.data.clickCount)],
                ['Click-through', pct(stats.data.clickThroughBp)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="tabular text-lg font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            {days.size === 0 ? (
              <p className="text-sm text-muted-foreground">No views recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <caption className="sr-only">Views and clicks per day</caption>
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 font-medium">Day</th>
                    <th className="py-1 text-right font-medium">Views</th>
                    <th className="py-1 text-right font-medium">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {[...days.entries()]
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([day, v]) => (
                      <tr key={day} className="border-t">
                        <td className="py-1">{day}</td>
                        <td className="tabular py-1 text-right">{formatNumber(v.views)}</td>
                        <td className="tabular py-1 text-right">{formatNumber(v.clicks)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
