'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, ImageOff } from 'lucide-react';
import { useState } from 'react';

import type { MediaAssetDto } from '@shared/types/media';

import { EmptyState, ErrorState } from '@/components/patterns/states';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/surface';
import { useDebouncedValue } from '@/hooks/use-browser';
import { cachePolicy } from '@/lib/query/policies';
import { cn } from '@/lib/utils';

import { mediaApi, mediaKeys, renditionUrl } from './api';
import { MEASURED_IMAGE_TYPES as MEASURED } from './upload-queue';

/**
 * Choose images that are already in the media library (loaded only while the picker is open).
 * Choosing links the existing file; nothing is copied or uploaded again. Images already used by
 * the caller (`attachedIds`) or smaller than `minSide` on their shortest side are shown but cannot
 * be chosen.
 */
export function MediaPicker({
  title = 'Choose images',
  multiple = true,
  attachedIds,
  minSide = 0,
  onClose,
  onChoose,
  busy,
}: {
  title?: string;
  multiple?: boolean;
  attachedIds?: ReadonlySet<string>;
  /** The API's `minProductImageDimension` when choosing for a product gallery. */
  minSide?: number;
  onClose(): void;
  onChoose(assets: MediaAssetDto[]): void | Promise<void>;
  busy?: boolean;
}) {
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = useState(1);
  const [chosen, setChosen] = useState<MediaAssetDto[]>([]);
  const query = { page, limit: 24, kind: 'IMAGE', ...(term ? { search: term } : {}) };
  const library = useQuery({
    queryKey: mediaKeys.list(query),
    queryFn: ({ signal }) => mediaApi.list(query, signal),
    ...cachePolicy.list,
  });

  const toggle = (asset: MediaAssetDto) =>
    setChosen((current) =>
      current.some((a) => a.id === asset.id)
        ? current.filter((a) => a.id !== asset.id)
        : multiple
          ? [...current, asset]
          : [asset],
    );

  return (
    <Dialog open onOpenChange={(open) => (open || busy ? undefined : onClose())}>
      <DialogContent className="flex max-h-[92dvh] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {multiple ? 'Select one or more images from the media library.' : 'Select one image.'}{' '}
            The existing files are linked, not copied.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            aria-label="Search images by name, title or alt text"
            placeholder="Search images…"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            className="min-w-48 flex-1"
          />
        </div>
        {/* Focusable so the list scrolls from the keyboard even when every image is disabled. */}
        <div
          tabIndex={0}
          role="group"
          aria-label="Library images"
          className="min-h-0 flex-1 overflow-y-auto rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {library.isPending ? (
            <div
              className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6"
              role="status"
              aria-label="Loading images"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <Skeleton key={i} className="aspect-square" />
              ))}
            </div>
          ) : library.error ? (
            <ErrorState error={library.error} onRetry={() => void library.refetch()} compact />
          ) : library.data.items.length === 0 ? (
            <EmptyState
              icon={ImageOff}
              title={term ? 'No image matches' : 'The library is empty'}
              description={term ? 'Try another word.' : 'Upload images first.'}
              compact
            />
          ) : (
            <ul
              className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6"
              aria-label="Images"
            >
              {library.data.items.map((asset) => {
                const on = chosen.some((a) => a.id === asset.id);
                const attached = attachedIds?.has(asset.id) ?? false;
                const tooSmall =
                  minSide > 0 &&
                  MEASURED.has(asset.mimeType) &&
                  asset.width !== null &&
                  asset.height !== null &&
                  Math.min(asset.width, asset.height) < minSide;
                return (
                  <li key={asset.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={attached || tooSmall}
                      onClick={() => toggle(asset)}
                      className={cn(
                        'group relative block w-full overflow-hidden rounded-md border-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
                        on ? 'border-primary' : 'border-transparent hover:border-input',
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- static export: no image optimiser */}
                      <img
                        src={renditionUrl(asset, 200)}
                        alt=""
                        loading="lazy"
                        className="aspect-square w-full bg-muted object-cover"
                      />
                      <span className="block truncate px-1 py-0.5 text-left text-xs">
                        {attached
                          ? 'Already added · '
                          : tooSmall
                            ? `Too small (${asset.width} × ${asset.height}) · `
                            : ''}
                        {asset.title ?? asset.originalName}
                      </span>
                      {on ? (
                        <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check aria-hidden className="size-3.5" />
                        </span>
                      ) : null}
                      <span className="sr-only">{asset.altText ?? asset.originalName}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {library.data && library.data.meta.totalPages > 1 ? (
          <div className="flex items-center justify-between text-sm">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span>
              Page {page} of {library.data.meta.totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={!library.data.meta.hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
        <DialogFooter className="items-center">
          <span role="status" className="mr-auto text-sm text-muted-foreground">
            {chosen.length} selected
          </span>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={chosen.length === 0}
            loading={busy}
            onClick={() => void onChoose(chosen)}
          >
            {multiple
              ? `Use ${chosen.length || ''} image${chosen.length === 1 ? '' : 's'}`
              : 'Use image'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
