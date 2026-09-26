'use client';

import { CircleAlert, CircleCheck, CircleX } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import type { AdminProductDetailDto } from '@shared/types/catalogAdmin';

import { ErrorState, SectionLoader } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { endpoints } from '@/lib/api/endpoints';
import { formatDateTime } from '@/lib/format/datetime';
import { usePermissions } from '@/lib/permissions/use-permissions';

import { PUBLICATION } from '../../model';
import { blockerTab, factorTab, isLive, productHref } from '../model';
import { useProductActions } from '../use-product-actions';
import { usePublishBlockers } from '../use-publish-blockers';

/** The action a media blocker leads to, in words; other blockers read "Fix issue". */
const FIX_LABELS: Readonly<Record<string, string>> = {
  NO_PRIMARY_MEDIA: 'Add image',
  MEDIA_NOT_READY: 'Review images',
};

/** The media part of the checklist: the API's completeness factors for images. */
function MediaChecklist({ product }: { product: AdminProductDetailDto }) {
  const factors = product.completeness.factors.filter((f) => factorTab(f.key) === 'media');
  if (factors.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <h3 className="text-sm font-medium">Media</h3>
      <ul className="flex flex-col gap-2" aria-label="Media checklist">
        {factors.map((factor) => (
          <li key={factor.key} className="flex items-start gap-2 text-sm">
            {factor.satisfied ? (
              <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
            ) : (
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            )}
            <span className="flex flex-1 flex-wrap items-center justify-between gap-2">
              <span>
                <span className="sr-only">{factor.satisfied ? 'Done: ' : 'To do: '}</span>
                {factor.key === 'primaryMedia' && !factor.satisfied
                  ? 'Primary image missing'
                  : factor.label}
                {factor.key === 'gallery' ? ` (${product.mediaCount} now)` : ''}
              </span>
              {factor.satisfied ? null : (
                <Button asChild size="sm" variant="outline">
                  <Link href={productHref(product.id, 'media')}>
                    Add image<span className="sr-only">: {factor.label}</span>
                  </Link>
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The publish checklist exactly as the API reports it (`GET …/publish-blockers`). Publishing
 * stays blocked until the list is empty; each item links to where it is fixed.
 */
export function PublishingTab({ product }: { product: AdminProductDetailDto }) {
  const { canCall } = usePermissions();
  const actions = useProductActions(product);
  const [publishAt, setPublishAt] = useState('');
  const blockers = usePublishBlockers(product);
  const canPublish = canCall(endpoints.products.publish) && !product.deletedAt;
  const live = isLive(product);
  const ready = blockers.data?.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-labelledby="state-heading"
        className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5"
      >
        <h2 id="state-heading" className="text-base font-semibold">
          Where it stands
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge status={product.publication} registry={PUBLICATION} />
          {product.publishedAt ? (
            <span className="text-muted-foreground">
              {product.publication === 'SCHEDULED' ? 'Goes live' : 'Published'}{' '}
              {formatDateTime(product.publishedAt)}
            </span>
          ) : null}
        </div>
      </section>

      <section
        aria-labelledby="checklist-heading"
        className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="checklist-heading" className="text-base font-semibold">
            Publishing checklist
          </h2>
          <Button
            size="sm"
            variant="ghost"
            loading={blockers.isFetching}
            onClick={() => void blockers.refetch()}
          >
            Check again
          </Button>
        </div>
        {blockers.isPending ? (
          <SectionLoader label="Checking…" />
        ) : blockers.error ? (
          <ErrorState error={blockers.error} onRetry={() => void blockers.refetch()} compact />
        ) : ready ? (
          <p className="flex items-center gap-2 text-sm">
            <CircleCheck aria-hidden className="size-5 text-success" />
            Ready: nothing blocks publishing.
          </p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Blocking issues">
            {blockers.data.map((blocker) => {
              const target = blockerTab(blocker);
              return (
                <li
                  key={`${blocker.code}:${blocker.field ?? ''}`}
                  className="flex items-start gap-2 text-sm"
                >
                  <CircleX aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <span className="flex flex-1 flex-wrap items-center justify-between gap-2">
                    <span>{blocker.message}</span>
                    {target ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={productHref(product.id, target)}>
                          {FIX_LABELS[blocker.code] ?? 'Fix issue'}
                          <span className="sr-only">: {blocker.message}</span>
                        </Link>
                      </Button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <MediaChecklist product={product} />
      </section>

      {canPublish ? (
        <section
          aria-labelledby="publish-heading"
          className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5"
        >
          <h2 id="publish-heading" className="text-base font-semibold">
            {live ? 'Take it off the storefront' : 'Publish'}
          </h2>
          {live ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex-1 text-sm text-muted-foreground">
                Unpublishing hides it from customers immediately. Nothing is deleted.
              </p>
              <Button
                variant="outline"
                loading={actions.unpublish.isPending}
                onClick={() => actions.unpublish.mutate()}
              >
                Unpublish
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {!ready ? (
                <Alert tone="warning" title="Blocked">
                  Fix the checklist items first; the API refuses to publish until they are resolved.
                </Alert>
              ) : null}
              <div className="flex flex-wrap items-end gap-3">
                <Button
                  disabled={!ready}
                  loading={actions.publish.isPending}
                  onClick={() => actions.publish.mutate(undefined)}
                >
                  Publish now
                </Button>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="publish-at">Or schedule for</Label>
                  <Input
                    id="publish-at"
                    type="datetime-local"
                    value={publishAt}
                    onChange={(event) => setPublishAt(event.target.value)}
                    className="w-auto"
                  />
                </div>
                <Button
                  variant="outline"
                  disabled={!ready || !publishAt}
                  loading={actions.publish.isPending}
                  onClick={() => actions.publish.mutate(new Date(publishAt).toISOString())}
                >
                  Schedule
                </Button>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
