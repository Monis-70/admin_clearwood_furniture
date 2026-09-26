'use client';

import type { ProductMediaItemDto } from '@shared/types/media';
import type { DeviceTarget, MediaRole } from '@shared/enums';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatDateTime } from '@/lib/format/datetime';

import { renditionUrl } from '@/features/media/api';
import { formatBytes } from '@/features/media/model';

import { DEVICE_LABELS, ROLE_LABELS, type DraftItem, type ScopeOption } from './gallery-model';

const BASIS = 10_000;

/**
 * Everything about one gallery image. Edits go into the gallery's unsaved changes (saved with
 * "Save gallery"); the title and focal point belong to the file and change it everywhere it is
 * used, which the sheet says next to those fields.
 */
export function ImageDetailsSheet({
  item,
  draft,
  index,
  scopes,
  canEditFile,
  onChange,
  onClose,
}: {
  item: ProductMediaItemDto;
  draft: DraftItem;
  index: number;
  scopes: { variants: ScopeOption[]; values: ScopeOption[] };
  canEditFile: boolean;
  onChange(change: Partial<Omit<DraftItem, 'id'>>): void;
  onClose(): void;
}) {
  const media = item.media;
  const focal = draft.focalPoint;
  const id = (name: string) => `image-${item.id}-${name}`;
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Image {index + 1} details</SheetTitle>
          <SheetDescription>
            Changes are kept with the gallery&apos;s other unsaved changes until you save.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-4 text-sm">
          <div className="flex flex-col gap-1.5">
            <span className="font-medium">Focal point</span>
            <div className="relative overflow-hidden rounded-md border bg-muted">
              <button
                type="button"
                disabled={!canEditFile}
                aria-label="Set the focal point where you click"
                className="block w-full cursor-crosshair disabled:cursor-default"
                onClick={(event) => {
                  const box = event.currentTarget.getBoundingClientRect();
                  if (box.width === 0 || box.height === 0) return;
                  onChange({
                    focalPoint: {
                      x: Math.round(((event.clientX - box.left) / box.width) * BASIS),
                      y: Math.round(((event.clientY - box.top) / box.height) * BASIS),
                    },
                  });
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- static export: no image optimiser */}
                <img
                  src={renditionUrl(media, 640)}
                  alt=""
                  className="w-full object-contain"
                  decoding="async"
                />
              </button>
              {focal ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary/70 shadow"
                  style={{ left: `${focal.x / 100}%`, top: `${focal.y / 100}%` }}
                />
              ) : null}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor={id('fx')}>Across (%)</Label>
                <Input
                  id={id('fx')}
                  type="number"
                  min={0}
                  max={100}
                  className="h-8 w-20"
                  disabled={!canEditFile}
                  value={focal ? Math.round(focal.x / 100) : ''}
                  onChange={(event) => {
                    const x = clampPercent(event.target.value);
                    onChange({ focalPoint: { x, y: focal?.y ?? BASIS / 2 } });
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={id('fy')}>Down (%)</Label>
                <Input
                  id={id('fy')}
                  type="number"
                  min={0}
                  max={100}
                  className="h-8 w-20"
                  disabled={!canEditFile}
                  value={focal ? Math.round(focal.y / 100) : ''}
                  onChange={(event) => {
                    const y = clampPercent(event.target.value);
                    onChange({ focalPoint: { x: focal?.x ?? BASIS / 2, y } });
                  }}
                />
              </div>
              {focal && canEditFile ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onChange({ focalPoint: null })}
                >
                  Clear focal point
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Crops keep this point in view. It belongs to the file, so every product using it
              follows.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor={id('alt')}>Alt text on this product</Label>
            <textarea
              id={id('alt')}
              maxLength={300}
              rows={3}
              value={draft.altText}
              placeholder={media.altText ?? 'Describe the image for screen readers'}
              onChange={(event) => onChange({ altText: event.target.value })}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
            <p className="text-xs text-muted-foreground">
              {media.altText
                ? `Left empty, customers get the library text: “${media.altText}”.`
                : 'Screen readers read this aloud; describe what the image shows.'}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor={id('title')}>Title in the media library</Label>
            <Input
              id={id('title')}
              maxLength={200}
              disabled={!canEditFile}
              value={draft.title}
              onChange={(event) => onChange({ title: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {canEditFile
                ? 'Belongs to the file: it changes wherever the file is used.'
                : 'Your role cannot change the file itself.'}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor={id('role')}>Role</Label>
            <NativeSelect
              id={id('role')}
              value={draft.role}
              onChange={(event) => onChange({ role: event.target.value as MediaRole })}
            >
              {(Object.keys(ROLE_LABELS) as MediaRole[]).map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              One image is Primary: choosing it here makes the current primary a gallery image.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor={id('scope')}>Shown for</Label>
            <NativeSelect
              id={id('scope')}
              value={draft.scope}
              onChange={(event) => onChange({ scope: event.target.value })}
            >
              <option value="">All variants</option>
              {scopes.variants.length > 0 ? (
                <optgroup label="One variant">
                  {scopes.variants.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {scopes.values.length > 0 ? (
                <optgroup label="One option value">
                  {scopes.values.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              Only this product&apos;s variants and the option values they use are offered.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor={id('device')}>Device</Label>
            <NativeSelect
              id={id('device')}
              value={draft.deviceTarget}
              onChange={(event) => onChange({ deviceTarget: event.target.value as DeviceTarget })}
            >
              {(Object.keys(DEVICE_LABELS) as DeviceTarget[]).map((device) => (
                <option key={device} value={device}>
                  {DEVICE_LABELS[device]}
                </option>
              ))}
            </NativeSelect>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border p-3 text-xs">
            <dt className="text-muted-foreground">File</dt>
            <dd className="min-w-0 break-words">{media.originalName}</dd>
            <dt className="text-muted-foreground">Type</dt>
            <dd>{media.mimeType}</dd>
            <dt className="text-muted-foreground">Size</dt>
            <dd>
              {media.width && media.height ? `${media.width} × ${media.height} px · ` : ''}
              {formatBytes(media.sizeBytes)}
            </dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd>{media.deletedAt ? 'In trash' : media.status}</dd>
            <dt className="text-muted-foreground">Used in</dt>
            <dd>
              {media.usageCount} place{media.usageCount === 1 ? '' : 's'}
            </dd>
            <dt className="text-muted-foreground">Uploaded</dt>
            <dd>{formatDateTime(media.createdAt)}</dd>
          </dl>
        </div>
        <SheetFooter>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function clampPercent(raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return BASIS / 2;
  return Math.round(Math.min(100, Math.max(0, value)) * 100);
}
