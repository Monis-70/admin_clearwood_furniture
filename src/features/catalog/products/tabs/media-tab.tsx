'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, ImagePlus, Images, TriangleAlert } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState, type DragEvent } from 'react';

import type { AdminProductDetailDto } from '@shared/types/catalogAdmin';
import type { MediaAssetDto, ProductMediaItemDto } from '@shared/types/media';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { useUnsavedChangesGuard } from '@/components/patterns/form/use-unsaved-changes-guard';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { EmptyState, ErrorState } from '@/components/patterns/states';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/surface';
import { endpoints } from '@/lib/api/endpoints';
import { isApiError } from '@/lib/api/errors';
import { formatCount } from '@/lib/format/datetime';
import { notifyError, notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { mediaApi, mediaKeys, renditionUrl } from '@/features/media/api';
import { UploadDropzone, UploadPanel } from '@/features/media/upload-panel';
import {
  describeTypes,
  fileProblem,
  productImageProblem,
  type UploadItem,
} from '@/features/media/upload-queue';

import { catalogKeys } from '../../api';
import { useAttributeOptions } from '../../lookups';
import { productKeys } from '../api';

import { CustomerView } from './media/customer-view';
import { GALLERY_DRAG_TYPE, GalleryCard } from './media/gallery-card';
import {
  ROLE_LABELS,
  changeCount,
  moveItem,
  patchItem,
  planSave,
  reconcile,
  scopeLabel,
  scopeOptions,
  type Draft,
  type DraftItem,
} from './media/gallery-model';
import { useProductUploads, type AttachState } from './media/use-product-uploads';

const MediaPicker = dynamic(
  () => import('@/features/media/media-picker').then((m) => m.MediaPicker),
  { ssr: false },
);
const ImagePreviewDialog = dynamic(
  () => import('./media/image-preview-dialog').then((m) => m.ImagePreviewDialog),
  { ssr: false },
);
const ImageDetailsSheet = dynamic(
  () => import('./media/image-details-sheet').then((m) => m.ImageDetailsSheet),
  { ssr: false },
);
const DeleteFileDialog = dynamic(
  () => import('./media/delete-file-dialog').then((m) => m.DeleteFileDialog),
  { ssr: false },
);

/** Media & Gallery: the images customers see, their order, the primary image and per-variant use. */
export function MediaTab({ product }: { product: AdminProductDetailDto }) {
  const { canCall } = usePermissions();
  const canManage = canCall(endpoints.media.productMedia) && !product.deletedAt;
  if (!canManage) return <ReadOnlyGallery product={product} />;
  return <ManagedGallery product={product} />;
}

function Intro() {
  return (
    <div>
      <h2 id="gallery-heading" className="text-base font-semibold">
        Media &amp; Gallery
      </h2>
      <p className="text-sm text-muted-foreground">
        These are the images customers will see. The primary image appears on product cards and in
        search; images can be limited to one variant or option value.
      </p>
    </div>
  );
}

function ReadOnlyGallery({ product }: { product: AdminProductDetailDto }) {
  const items = [...product.media].sort((a, b) => a.position - b.position);
  return (
    <section aria-labelledby="gallery-heading" className="flex flex-col gap-4">
      <Intro />
      {items.length === 0 ? (
        <EmptyState
          icon={ImagePlus}
          title="No images yet"
          description="Your role can view the gallery but not change it."
        />
      ) : (
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          aria-label="Product images"
        >
          {items.map((item) => (
            <li key={item.id} className="overflow-hidden rounded-md border">
              {/* eslint-disable-next-line @next/next/no-img-element -- static export: no image optimiser */}
              <img
                src={item.url}
                alt=""
                className="aspect-square w-full bg-muted object-cover"
                loading="lazy"
              />
              <p className="px-2 py-1 text-xs">
                {ROLE_LABELS[item.role as keyof typeof ROLE_LABELS] ?? item.role}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Dialog =
  | { kind: 'picker' }
  | { kind: 'preview'; index: number }
  | { kind: 'details'; id: string }
  | { kind: 'remove'; id: string }
  | { kind: 'delete-file'; id: string }
  | null;

function ManagedGallery({ product }: { product: AdminProductDetailDto }) {
  const queryClient = useQueryClient();
  const { canCall } = usePermissions();
  const canUpload = canCall(endpoints.media.upload);
  const canBrowse = canCall(endpoints.media.list);
  const canEditFile = canCall(endpoints.media.update);
  const canDeleteFile = canCall(endpoints.media.remove);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const gallery = useQuery({
    queryKey: mediaKeys.product(product.id),
    queryFn: ({ signal }) => mediaApi.productMedia(product.id, signal),
    ...cachePolicy.detail,
  });
  const config = useQuery({
    queryKey: mediaKeys.config(),
    queryFn: ({ signal }) => mediaApi.config(signal),
    enabled: canCall(endpoints.media.config),
    ...cachePolicy.config,
  });
  const attributes = useAttributeOptions();

  const server = gallery.data ?? [];
  const view = reconcile(draft, server);
  const byId = new Map(server.map((item) => [item.id, item]));
  const plan = planSave(server, view);
  const changes = changeCount(plan);
  const dirty = changes > 0;
  const scopes = scopeOptions(product.variants, attributes.data ?? []);
  const hasPrimary = server.some((item) => item.role === 'PRIMARY');

  /** Everything that shows this product's images reloads from the API; nothing is patched by hand. */
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: mediaKeys.all }),
      queryClient.invalidateQueries({ queryKey: productKeys.detail(product.id) }),
      queryClient.invalidateQueries({ queryKey: catalogKeys.all }),
    ]);

  const limits = config.data;
  const allowedMime = limits?.allowedImageMime ?? [];
  const minSide = limits?.minProductImageDimension ?? 0;
  const uploads = useProductUploads({
    productId: product.id,
    hasPrimary,
    validate: (file) =>
      limits ? fileProblem(file, { allowedMime, maxUploadSizeMb: limits.maxUploadSizeMb }) : null,
    inspect: (file) => productImageProblem(file, minSide),
    onAttached: () => void refresh(),
  });

  useUnsavedChangesGuard(
    dirty || uploads.busy,
    dirty
      ? 'The gallery has unsaved changes. Leave this page and lose them?'
      : 'Images are still uploading. Leave this page and stop them?',
  );

  const addFiles = (files: File[]) => {
    const max = limits?.maxUploadFiles ?? files.length;
    const taken = files.slice(0, max);
    const { duplicates } = uploads.queue.add(taken);
    const messages = [
      files.length > max
        ? `Only the first ${max} files were added: up to ${max} can be chosen at a time.`
        : null,
      duplicates.length > 0
        ? `${formatCount(duplicates.length, 'file was', 'files were')} already in the upload list.`
        : null,
    ].filter(Boolean);
    setNotice(messages.length > 0 ? messages.join(' ') : null);
  };

  const edit = (id: string, change: Partial<Omit<DraftItem, 'id'>>) =>
    setDraft(patchItem(view, id, change));
  const move = (from: number, to: number) => setDraft(moveItem(view, from, to));

  const save = useMutation({
    mutationFn: async () => {
      for (const asset of plan.assets) await mediaApi.update(asset.mediaId, asset.patch);
      for (const item of plan.items) await mediaApi.updateItem(product.id, item.id, item.patch);
      if (plan.reorder) await mediaApi.reorder(product.id, plan.reorder);
    },
    onSuccess: async () => {
      await refresh();
      setDraft(null);
      notifySuccess('Gallery saved');
    },
    // What was applied before a refusal is saved; the rest stays as unsaved changes.
    onError: () => void refresh(),
  });

  const pick = useMutation({
    mutationFn: async (assets: MediaAssetDto[]) => {
      let added = 0;
      let already = 0;
      let primaryGiven = hasPrimary;
      let failure: unknown = null;
      for (const asset of assets) {
        const role = primaryGiven ? 'GALLERY' : 'PRIMARY';
        try {
          await mediaApi.attach(product.id, [{ mediaId: asset.id, role }]);
          added += 1;
          primaryGiven = true;
        } catch (error) {
          if (isApiError(error) && error.status === 409) already += 1;
          else failure ??= error;
        }
      }
      return { added, already, failure };
    },
    onSuccess: async ({ added, already, failure }) => {
      await refresh();
      setDialog(null);
      if (added > 0 || already > 0) {
        notifySuccess(
          `${formatCount(added, 'image')} added`,
          already > 0
            ? `${formatCount(already, 'image was', 'images were')} already in this gallery.`
            : undefined,
        );
      }
      if (failure) notifyError(failure, 'Some images could not be added');
    },
  });

  const detach = useMutation({
    mutationFn: (item: ProductMediaItemDto) => mediaApi.detach(product.id, item.id),
    onSuccess: async () => {
      await refresh();
      notifySuccess('Image removed from this product', 'It stays in the media library.');
    },
  });

  const restoreFile = useMutation({
    mutationFn: (item: ProductMediaItemDto) => mediaApi.restore(item.mediaId),
    onSuccess: async () => {
      await refresh();
      notifySuccess('File restored', 'Customers see it again.');
    },
    onError: (error) => notifyError(error, 'Could not restore the file'),
  });

  const onDragStart = (index: number) => (event: DragEvent) => {
    event.dataTransfer.setData(GALLERY_DRAG_TYPE, String(index));
    event.dataTransfer.effectAllowed = 'move';
    const card = (event.currentTarget as HTMLElement).closest('li');
    if (card) event.dataTransfer.setDragImage(card, 24, 24);
    setDragFrom(index);
  };
  const onDragOver = (index: number) => (event: DragEvent) => {
    if (!event.dataTransfer.types.includes(GALLERY_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dropAt !== index) setDropAt(index);
  };
  const onDrop = (index: number) => (event: DragEvent) => {
    if (!event.dataTransfer.types.includes(GALLERY_DRAG_TYPE)) return;
    event.preventDefault();
    const from = Number(event.dataTransfer.getData(GALLERY_DRAG_TYPE));
    if (Number.isInteger(from)) move(from, index);
    setDragFrom(null);
    setDropAt(null);
  };
  const onDragEnd = () => {
    setDragFrom(null);
    setDropAt(null);
  };

  const uploadExtra = (item: UploadItem) =>
    item.status === 'done' ? (
      <AttachStatus
        item={item}
        state={uploads.attach[item.id]}
        onUseExisting={() => uploads.attachExisting(item)}
        onRetry={() => uploads.retryAttach(item)}
      />
    ) : null;

  const entries = view.flatMap((draftItem) => {
    const item = byId.get(draftItem.id);
    return item ? [{ item, draft: draftItem, scope: scopeLabel(draftItem.scope, scopes) }] : [];
  });
  const dialogItem =
    dialog && 'id' in dialog ? entries.find((entry) => entry.item.id === dialog.id) : undefined;
  const changedIds = new Set([
    ...plan.items.map((entry) => entry.id),
    ...plan.assets.flatMap((asset) =>
      server.filter((item) => item.mediaId === asset.mediaId).map((item) => item.id),
    ),
  ]);
  const primaryMissing = !view.some((item) => item.role === 'PRIMARY');

  return (
    <section aria-labelledby="gallery-heading" className="flex flex-col gap-4">
      <Intro />

      <GallerySummary
        count={view.length}
        primaryMissing={primaryMissing}
        scoped={view.filter((item) => item.scope !== '').length}
        notReady={
          server.filter((item) => item.media.deletedAt || item.media.status !== 'READY').length
        }
      />

      <div
        role="group"
        aria-label="Add images"
        className="flex flex-col gap-3 sm:flex-row sm:items-stretch"
      >
        {canUpload ? (
          <UploadDropzone
            className="flex-1"
            accept={allowedMime.length > 0 ? allowedMime.join(',') : 'image/*'}
            onFiles={addFiles}
            hint={
              limits
                ? [
                    describeTypes(allowedMime),
                    `up to ${limits.maxUploadSizeMb} MB each`,
                    `${limits.maxUploadFiles} at a time`,
                    minSide > 0 ? `at least ${minSide} px on the shortest side` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : undefined
            }
          />
        ) : null}
        {canBrowse ? (
          <div className="flex items-center justify-center rounded-lg border p-4 sm:w-56">
            <Button type="button" variant="outline" onClick={() => setDialog({ kind: 'picker' })}>
              <Images aria-hidden />
              Select from media library
            </Button>
          </div>
        ) : null}
      </div>
      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}

      <UploadPanel state={uploads.state} queue={uploads.queue} extra={uploadExtra} />

      {gallery.isPending ? (
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          role="status"
          aria-label="Loading gallery"
        >
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : gallery.error ? (
        <ErrorState error={gallery.error} onRetry={() => void gallery.refetch()} />
      ) : view.length === 0 ? (
        uploads.state.items.length === 0 ? (
          <EmptyState
            icon={ImagePlus}
            title="No images yet"
            description="A product needs a primary image before it can be published. The first image you add becomes the primary image."
          />
        ) : null
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            <span className="hidden sm:inline">
              Drag an image by its handle to reorder, or use the arrows.{' '}
            </span>
            <span className="sm:hidden">Use the arrows to reorder. </span>
            Changes stay unsaved until you choose Save gallery.
          </p>
          <ol
            className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3"
            aria-label="Product images in display order"
          >
            {entries.map(({ item, draft: draftItem, scope }, index) => (
              <GalleryCard
                key={item.id}
                item={item}
                draft={draftItem}
                index={index}
                total={entries.length}
                scope={scope}
                changed={changedIds.has(item.id)}
                dragging={dragFrom === index}
                dropTarget={dropAt === index && dragFrom !== null && dragFrom !== index}
                canDeleteFile={canDeleteFile}
                onChange={(change) => edit(item.id, change)}
                onMove={(to) => move(index, to)}
                onPreview={() => setDialog({ kind: 'preview', index })}
                onDetails={() => setDialog({ kind: 'details', id: item.id })}
                onRemove={() => setDialog({ kind: 'remove', id: item.id })}
                onDeleteFile={() => setDialog({ kind: 'delete-file', id: item.id })}
                onRestoreFile={() => restoreFile.mutate(item)}
                onDragStart={onDragStart(index)}
                onDragEnd={onDragEnd}
                onDragOver={onDragOver(index)}
                onDrop={onDrop(index)}
              />
            ))}
          </ol>
        </>
      )}

      {dirty || save.isPending || save.error ? (
        <div className="sticky bottom-0 z-10 -mx-1 flex flex-col gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur">
          <FormAlert error={save.error} />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span role="status" className="mr-auto text-sm text-muted-foreground">
              {dirty
                ? `${formatCount(changes, 'unsaved gallery change')}`
                : 'All gallery changes saved'}
            </span>
            <Button
              type="button"
              variant="ghost"
              disabled={!dirty || save.isPending}
              onClick={() => {
                setDraft(null);
                save.reset();
              }}
            >
              Discard
            </Button>
            <Button
              type="button"
              loading={save.isPending}
              disabled={!dirty}
              onClick={() => save.mutate()}
            >
              Save gallery
            </Button>
          </div>
        </div>
      ) : null}

      <CustomerView product={product} scopes={scopes} unsaved={dirty} />

      {dialog?.kind === 'picker' ? (
        <MediaPicker
          title={`Select images for ${product.name}`}
          attachedIds={new Set(server.map((item) => item.mediaId))}
          minSide={minSide}
          onClose={() => setDialog(null)}
          busy={pick.isPending}
          onChoose={(assets) => pick.mutate(assets)}
        />
      ) : null}
      {dialog?.kind === 'preview' ? (
        <ImagePreviewDialog
          entries={entries}
          index={Math.min(dialog.index, entries.length - 1)}
          onIndexChange={(index) => setDialog({ kind: 'preview', index })}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'details' && dialogItem ? (
        <ImageDetailsSheet
          item={dialogItem.item}
          draft={dialogItem.draft}
          index={entries.indexOf(dialogItem)}
          scopes={scopes}
          canEditFile={canEditFile}
          onChange={(change) => edit(dialogItem.item.id, change)}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'remove' && dialogItem ? (
        <LazyConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setDialog(null))}
          title="Remove this image from the product?"
          description={`${dialogItem.item.media.originalName} leaves this gallery only. The file stays in the media library and anything else using it keeps it.`}
          confirmLabel="Remove from product"
          level="standard"
          onConfirm={async () => {
            await detach.mutateAsync(dialogItem.item);
            setDialog(null);
          }}
        />
      ) : null}
      {dialog?.kind === 'delete-file' && dialogItem ? (
        <DeleteFileDialog
          item={dialogItem.item}
          productId={product.id}
          variantIds={new Set(product.variants.map((variant) => variant.id))}
          onDone={() => void refresh()}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </section>
  );
}

function GallerySummary({
  count,
  primaryMissing,
  scoped,
  notReady,
}: {
  count: number;
  primaryMissing: boolean;
  scoped: number;
  notReady: number;
}) {
  return (
    <ul aria-label="Gallery status" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <li className="flex items-center gap-1.5">
        {primaryMissing ? (
          <TriangleAlert aria-hidden className="size-4 text-warning" />
        ) : (
          <CircleCheck aria-hidden className="size-4 text-success" />
        )}
        {primaryMissing ? 'No primary image' : 'Primary image set'}
      </li>
      <li className="flex items-center gap-1.5">
        {count >= 3 ? (
          <CircleCheck aria-hidden className="size-4 text-success" />
        ) : (
          <TriangleAlert aria-hidden className="size-4 text-warning" />
        )}
        {formatCount(count, 'image')}
        {count < 3 ? ' (3 or more recommended)' : ''}
      </li>
      {scoped > 0 ? <li>{formatCount(scoped, 'image')} for one variant or option</li> : null}
      {notReady > 0 ? (
        <li className="flex items-center gap-1.5 text-warning">
          <TriangleAlert aria-hidden className="size-4" />
          {formatCount(notReady, 'image')} processing or in the trash
        </li>
      ) : null}
    </ul>
  );
}

function AttachStatus({
  item,
  state,
  onUseExisting,
  onRetry,
}: {
  item: UploadItem;
  state: AttachState | undefined;
  onUseExisting(): void;
  onRetry(): void;
}) {
  if (!state) {
    if (!item.deduplicated || !item.asset) return null;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- static export: no image optimiser */}
        <img
          src={renditionUrl(item.asset, 120)}
          alt=""
          className="size-8 rounded bg-muted object-cover"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={`Use existing image for ${item.file.name}`}
          onClick={onUseExisting}
        >
          Use existing image
        </Button>
      </div>
    );
  }
  switch (state.kind) {
    case 'attaching':
      return <p className="text-xs text-muted-foreground">Adding to the gallery…</p>;
    case 'attached':
      return (
        <p className="flex items-center gap-1 text-xs text-success">
          <CircleCheck aria-hidden className="size-3.5" />
          Added to the gallery
        </p>
      );
    case 'already':
      return <p className="text-xs text-muted-foreground">Already in this gallery.</p>;
    case 'failed':
      return (
        <div className="flex flex-wrap items-center gap-2 text-xs text-destructive">
          <span>In the media library, but not added to this product: {state.message}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`Try adding again: ${item.file.name}`}
            onClick={onRetry}
          >
            Try adding again
          </Button>
        </div>
      );
  }
}
