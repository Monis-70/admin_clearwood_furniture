'use client';

import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { useState } from 'react';

import type { ProductMediaItemDto } from '@shared/types/media';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { renditionUrl } from '@/features/media/api';
import { formatBytes } from '@/features/media/model';

import { DEVICE_LABELS, ROLE_LABELS, type DraftItem } from './gallery-model';

export interface PreviewEntry {
  item: ProductMediaItemDto;
  draft: DraftItem;
  scope: string;
}

/**
 * A large look at the gallery in its current (possibly unsaved) order. It loads the biggest
 * rendition the server made, never the original upload.
 */
export function ImagePreviewDialog({
  entries,
  index,
  onIndexChange,
  onClose,
}: {
  entries: readonly PreviewEntry[];
  index: number;
  onIndexChange(index: number): void;
  onClose(): void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const entry = entries[index];
  if (!entry) return null;
  const { item, draft, scope } = entry;
  const media = item.media;
  const alt = draft.altText.trim() || media.altText || '';
  const go = (to: number) => {
    setZoomed(false);
    onIndexChange((to + entries.length) % entries.length);
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent
        className="flex max-h-[96dvh] flex-col gap-3 sm:max-w-5xl"
        onKeyDown={(event) => {
          if (entries.length < 2) return;
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            go(index + 1);
          } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            go(index - 1);
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            Image {index + 1} of {entries.length}
          </DialogTitle>
          <DialogDescription className="truncate">{media.originalName}</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_16rem]">
          <div
            className={cn(
              'relative min-h-0 rounded-md bg-muted',
              zoomed ? 'max-h-[70dvh] overflow-auto' : 'flex items-center justify-center',
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static export: no image optimiser */}
            <img
              key={item.id}
              src={renditionUrl(media, 1600)}
              alt={alt}
              decoding="async"
              className={cn(
                zoomed ? 'max-w-none' : 'max-h-[60dvh] w-auto max-w-full object-contain',
              )}
              style={zoomed && media.width ? { width: `${Math.min(media.width, 3200)}px` } : {}}
            />
          </div>
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex flex-wrap gap-1">
              <Badge tone={draft.role === 'PRIMARY' ? 'brand' : 'neutral'}>
                {ROLE_LABELS[draft.role]}
              </Badge>
              <Badge tone="outline">{scope}</Badge>
              {draft.deviceTarget !== 'ALL' ? (
                <Badge tone="outline">{DEVICE_LABELS[draft.deviceTarget]}</Badge>
              ) : null}
              {media.deletedAt ? <Badge tone="danger">In trash</Badge> : null}
            </div>
            <div>
              <p className="font-medium">Alt text</p>
              <p className={alt ? undefined : 'text-muted-foreground'}>
                {alt || 'None yet: screen readers get no description.'}
              </p>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Position</dt>
              <dd>
                {index + 1} of {entries.length}
              </dd>
              <dt className="text-muted-foreground">Size</dt>
              <dd>
                {media.width && media.height ? `${media.width} × ${media.height} px · ` : ''}
                {formatBytes(media.sizeBytes)}
              </dd>
              <dt className="text-muted-foreground">Type</dt>
              <dd>{media.mimeType}</dd>
              {draft.title ? (
                <>
                  <dt className="text-muted-foreground">Title</dt>
                  <dd className="break-words">{draft.title}</dd>
                </>
              ) : null}
            </dl>
            <div className="mt-auto flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-pressed={zoomed}
                onClick={() => setZoomed((value) => !value)}
              >
                {zoomed ? <ZoomOut aria-hidden /> : <ZoomIn aria-hidden />}
                {zoomed ? 'Fit to screen' : 'Zoom to full size'}
              </Button>
            </div>
          </div>
        </div>
        {entries.length > 1 ? (
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => go(index - 1)}>
              <ChevronLeft aria-hidden />
              Previous image
            </Button>
            <Button type="button" variant="outline" onClick={() => go(index + 1)}>
              Next image
              <ChevronRight aria-hidden />
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
