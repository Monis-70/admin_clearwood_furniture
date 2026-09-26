'use client';

import { ArrowLeft, ArrowRight, GripVertical, MoreHorizontal, Pencil, Star } from 'lucide-react';
import type { DragEvent } from 'react';

import type { ProductMediaItemDto } from '@shared/types/media';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { renditionUrl } from '@/features/media/api';

import { DEVICE_LABELS, ROLE_LABELS, type DraftItem } from './gallery-model';

/** The drag payload type, so files dragged from the desktop never reorder the gallery. */
export const GALLERY_DRAG_TYPE = 'application/x-clearwood-gallery-item';

export interface GalleryCardProps {
  item: ProductMediaItemDto;
  draft: DraftItem;
  index: number;
  total: number;
  scope: string;
  changed: boolean;
  dragging: boolean;
  dropTarget: boolean;
  canDeleteFile: boolean;
  onChange(change: Partial<Omit<DraftItem, 'id'>>): void;
  onMove(to: number): void;
  onPreview(): void;
  onDetails(): void;
  onRemove(): void;
  onDeleteFile(): void;
  onRestoreFile(): void;
  onDragStart(event: DragEvent): void;
  onDragEnd(): void;
  onDragOver(event: DragEvent): void;
  onDrop(event: DragEvent): void;
}

export function GalleryCard({
  item,
  draft,
  index,
  total,
  scope,
  changed,
  dragging,
  dropTarget,
  canDeleteFile,
  onChange,
  onMove,
  onPreview,
  onDetails,
  onRemove,
  onDeleteFile,
  onRestoreFile,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: GalleryCardProps) {
  const n = index + 1;
  const trashed = item.media.deletedAt !== null;
  const primary = draft.role === 'PRIMARY';
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a drop target for pointer drags; the move buttons do the same by keyboard and touch
    <li
      aria-label={`Image ${n}: ${item.media.originalName}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border bg-card transition-shadow',
        primary && 'ring-2 ring-primary/60',
        dragging && 'opacity-50',
        dropTarget && 'ring-2 ring-primary',
      )}
    >
      <div className="relative">
        <button
          type="button"
          onClick={onPreview}
          className="block w-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static export: no image optimiser */}
          <img
            src={renditionUrl(item.media, 480)}
            alt=""
            className={cn('aspect-[4/3] w-full bg-muted object-cover', trashed && 'grayscale')}
            loading="lazy"
            decoding="async"
          />
          <span className="sr-only">Preview image {n}</span>
        </button>
        <span className="pointer-events-none absolute top-2 left-2 flex flex-wrap gap-1">
          <Badge tone="outline" className="tabular">
            {n}
          </Badge>
          <Badge tone={primary ? 'brand' : 'neutral'}>
            {ROLE_LABELS[draft.role] ?? draft.role}
          </Badge>
          {trashed ? (
            <Badge tone="danger">In trash</Badge>
          ) : item.media.status !== 'READY' ? (
            <Badge tone="warning">Processing</Badge>
          ) : null}
          {changed ? <Badge tone="info">Unsaved</Badge> : null}
        </span>
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- a pointer-only drag handle; the move buttons are the keyboard and touch equivalent */}
        <span
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          title="Drag to reorder"
          data-testid={`drag-handle-${n}`}
          className="absolute top-2 right-2 hidden cursor-grab rounded-md bg-card/90 p-1 text-muted-foreground shadow-sm active:cursor-grabbing sm:block"
        >
          <GripVertical aria-hidden className="size-4" />
        </span>
      </div>
      <div className="flex flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={item.media.originalName}>
            {item.media.originalName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {scope}
            {draft.deviceTarget !== 'ALL' ? ` · ${DEVICE_LABELS[draft.deviceTarget]}` : ''}
          </p>
        </div>
        {trashed ? (
          <p className="text-xs text-destructive">
            This file is in the media library&apos;s trash: customers do not see it and publishing
            is blocked until it is restored or removed from this product.
          </p>
        ) : null}
        <label className="flex flex-col gap-1 text-xs font-medium">
          Alt text
          <Input
            aria-label={`Alt text for image ${n}`}
            placeholder={item.media.altText ?? 'Describe the image for screen readers'}
            maxLength={300}
            value={draft.altText}
            onChange={(event) => onChange({ altText: event.target.value })}
            className="h-8 text-sm font-normal"
          />
        </label>
        <div className="flex flex-wrap items-center gap-1">
          {primary ? null : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label={`Make primary (image ${n})`}
              onClick={() => onChange({ role: 'PRIMARY' })}
            >
              <Star aria-hidden />
              Make primary
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`Details for image ${n}`}
            onClick={onDetails}
          >
            <Pencil aria-hidden />
            Details
          </Button>
          <span className="ml-auto flex gap-0.5">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Move image ${n} earlier`}
              disabled={index === 0}
              onClick={() => onMove(index - 1)}
            >
              <ArrowLeft aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Move image ${n} later`}
              disabled={index === total - 1}
              onClick={() => onMove(index + 1)}
            >
              <ArrowRight aria-hidden />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`More actions for image ${n}`}
                >
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onPreview}>Preview</DropdownMenuItem>
                <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(0)}>
                  Move to first
                </DropdownMenuItem>
                <DropdownMenuItem disabled={index === total - 1} onSelect={() => onMove(total - 1)}>
                  Move to last
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onRemove}>Remove from this product…</DropdownMenuItem>
                {canDeleteFile ? (
                  trashed ? (
                    <DropdownMenuItem onSelect={onRestoreFile}>Restore file</DropdownMenuItem>
                  ) : null
                ) : null}
                {canDeleteFile ? (
                  <DropdownMenuItem className="text-destructive" onSelect={onDeleteFile}>
                    Delete media file…
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </div>
      </div>
    </li>
  );
}
