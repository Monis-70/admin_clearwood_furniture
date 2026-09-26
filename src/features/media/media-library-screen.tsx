'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, FolderOpen, ImageOff, Upload } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import type { MediaAssetDto } from '@shared/types/media';

import { FilterSelect } from '@/components/patterns/data-table/filter-select';
import { SearchInput } from '@/components/patterns/data-table/search-input';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { useUnsavedChangesGuard } from '@/components/patterns/form/use-unsaved-changes-guard';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { PageHeader } from '@/components/patterns/page-header';
import { EmptyState, ErrorState, PermissionNotice } from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/surface';
import { endpoints } from '@/lib/api/endpoints';
import { formatCount } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';
import { cn } from '@/lib/utils';

import { mediaApi, mediaKeys, renditionUrl, type MediaListQuery } from './api';
import { flattenFolders, formatBytes } from './model';
import { UploadPanel } from './upload-panel';
import { fileProblem, summarize } from './upload-queue';
import { useUploadQueue } from './use-upload-queue';

const MediaDrawer = dynamic(() => import('./media-drawer').then((m) => m.MediaDrawer), {
  ssr: false,
});
const FoldersDialog = dynamic(() => import('./folders-dialog').then((m) => m.FoldersDialog), {
  ssr: false,
});

const FILTERS = ['id', 'folderId', 'kind', 'unusedOnly', 'includeDeleted'] as const;
type Filter = (typeof FILTERS)[number];
const KIND_OPTIONS = [
  { value: 'IMAGE', label: 'Images' },
  { value: 'VIDEO', label: 'Videos' },
  { value: 'DOCUMENT', label: 'Documents' },
];
const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'originalName:asc', label: 'Name A–Z' },
  { value: 'sizeBytes:desc', label: 'Largest first' },
  { value: 'usageCount:asc', label: 'Least used first' },
];

export function MediaLibraryScreen() {
  const { canCall } = usePermissions();
  if (!canCall(endpoints.media.list))
    return <PermissionNotice area="the media library" all={['media.asset.read']} />;
  return <MediaLibrary />;
}

function MediaLibrary() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const params = useListParams<Filter>({
    filters: FILTERS,
    defaultSort: 'createdAt',
    defaultOrder: 'desc',
  });
  const f = params.filters;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const query: MediaListQuery = {
    page: params.page,
    limit: 48,
    sort: params.sort,
    order: params.order,
    ...(params.q ? { search: params.q } : {}),
    ...(f.folderId ? { folderId: f.folderId } : {}),
    ...(f.kind ? { kind: f.kind } : {}),
    ...(f.unusedOnly ? { unusedOnly: true } : {}),
    ...(f.includeDeleted ? { includeDeleted: true } : {}),
  };
  const library = useQuery({
    queryKey: mediaKeys.list(query),
    queryFn: ({ signal }) => mediaApi.list(query, signal),
    ...cachePolicy.list,
  });
  const config = useQuery({
    queryKey: mediaKeys.config(),
    queryFn: ({ signal }) => mediaApi.config(signal),
    ...cachePolicy.config,
  });
  const folders = useQuery({
    queryKey: mediaKeys.folders(),
    queryFn: ({ signal }) => mediaApi.folders(signal),
    enabled: canCall(endpoints.media.folders),
    ...cachePolicy.reference,
  });
  const upload = useUploadQueue({
    folderId: f.folderId || undefined,
    validate: (file) =>
      config.data
        ? fileProblem(file, {
            allowedMime: [
              ...config.data.allowedImageMime,
              ...config.data.allowedVideoMime,
              ...config.data.allowedDocMime,
            ],
            maxUploadSizeMb: config.data.maxUploadSizeMb,
          })
        : null,
  });
  const uploadSummary = summarize(upload.state);
  useUnsavedChangesGuard(
    uploadSummary.pending > 0,
    'Files are still uploading. Leave this page and stop them?',
  );
  // Each finished file refreshes the grid and counts from the API.
  const finished = uploadSummary.done;
  useEffect(() => {
    if (finished > 0) void queryClient.invalidateQueries({ queryKey: mediaKeys.all });
  }, [finished, queryClient]);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const accept = config.data
    ? [
        ...config.data.allowedImageMime,
        ...config.data.allowedVideoMime,
        ...config.data.allowedDocMime,
      ].join(',')
    : 'image/*';
  const flatFolders = flattenFolders(folders.data ?? []);
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < 100) next.add(id);
      return next;
    });
  const items = library.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Media library"
        description="Every uploaded image, video and document. The server makes the resized versions; delete only what nothing uses."
        actions={
          <>
            {canCall(endpoints.media.folders) ? (
              <Button variant="outline" onClick={() => setFoldersOpen(true)}>
                <FolderOpen aria-hidden />
                Folders
              </Button>
            ) : null}
            {canCall(endpoints.media.upload) ? (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  accept={accept}
                  className="sr-only"
                  aria-label="Upload files"
                  tabIndex={-1}
                  onChange={(event) => {
                    const files = [...(event.target.files ?? [])];
                    event.target.value = '';
                    if (files.length === 0) return;
                    const max = config.data?.maxUploadFiles ?? files.length;
                    const { duplicates } = upload.queue.add(files.slice(0, max));
                    setUploadNotice(
                      [
                        files.length > max
                          ? `Only the first ${max} files were added: up to ${max} can be chosen at a time.`
                          : null,
                        duplicates.length > 0
                          ? `${formatCount(duplicates.length, 'file was', 'files were')} already in the upload list.`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' ') || null,
                    );
                  }}
                />
                <Button onClick={() => fileInput.current?.click()}>
                  <Upload aria-hidden />
                  Upload
                </Button>
              </>
            ) : null}
          </>
        }
      />
      {uploadNotice ? (
        <p role="status" className="mb-3 text-sm text-muted-foreground">
          {uploadNotice}
        </p>
      ) : null}
      <UploadPanel state={upload.state} queue={upload.queue} className="mb-3" />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          value={params.q}
          onSearch={params.setSearch}
          label="Search name, title or alt text"
          minLength={1}
        />
        <FilterSelect
          label="Folder"
          value={f.folderId}
          options={flatFolders.map((folder) => ({
            value: folder.id,
            label: `${'\u00a0\u00a0'.repeat(folder.depth)}${folder.name}`,
          }))}
          onChange={(v) => params.setFilter('folderId', v)}
        />
        <FilterSelect
          label="Type"
          value={f.kind}
          options={KIND_OPTIONS}
          onChange={(v) => params.setFilter('kind', v)}
        />
        <FilterSelect
          label="Usage"
          value={f.unusedOnly}
          options={[{ value: 'true', label: 'Unused only' }]}
          onChange={(v) => params.setFilter('unusedOnly', v)}
        />
        <FilterSelect
          label="Trash"
          value={f.includeDeleted}
          options={[{ value: 'true', label: 'Include deleted' }]}
          onChange={(v) => params.setFilter('includeDeleted', v)}
        />
        <FilterSelect
          label="Sort"
          value={`${params.sort}:${params.order}`}
          options={SORT_OPTIONS}
          onChange={(v) => {
            const [field, order] = (v ?? 'createdAt:desc').split(':') as [string, 'asc' | 'desc'];
            params.setSort(field, order);
          }}
        />
      </div>
      {selected.size > 0 ? (
        <div
          role="region"
          aria-label="Selection"
          className="sticky top-16 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-background p-2 text-sm shadow-sm"
        >
          <span className="font-medium">{selected.size} selected</span>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
          {canCall(endpoints.media.bulkRemove) ? (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto text-destructive"
              onClick={() => setBulkDeleting(true)}
            >
              Move to trash…
            </Button>
          ) : null}
        </div>
      ) : null}
      {library.isPending ? (
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6"
          role="status"
          aria-label="Loading media"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : library.error ? (
        <ErrorState error={library.error} onRetry={() => void library.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ImageOff}
          title={params.activeFilterCount > 0 || params.q ? 'Nothing matches' : 'No media yet'}
          description={
            params.activeFilterCount > 0 || params.q
              ? undefined
              : 'Upload product photos, banners and documents.'
          }
          action={
            params.activeFilterCount > 0 || params.q ? (
              <Button variant="outline" onClick={params.clearAll}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6" aria-label="Media">
          {items.map((asset) => (
            <MediaTile
              key={asset.id}
              asset={asset}
              selected={selected.has(asset.id)}
              selectable={canCall(endpoints.media.bulkRemove) && !asset.deletedAt}
              onToggle={() => toggle(asset.id)}
              onOpen={() => params.setFilter('id', asset.id)}
            />
          ))}
        </ul>
      )}
      {library.data && library.data.meta.totalPages > 1 ? (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
          <Button
            variant="ghost"
            disabled={!library.data.meta.hasPrev}
            onClick={() => params.setPage(params.page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {params.page} of {library.data.meta.totalPages} ·{' '}
            {formatCount(library.data.meta.total, 'file')}
          </span>
          <Button
            variant="ghost"
            disabled={!library.data.meta.hasNext}
            onClick={() => params.setPage(params.page + 1)}
          >
            Next
          </Button>
        </nav>
      ) : null}
      {f.id ? (
        <MediaDrawer id={f.id} folders={flatFolders} onClose={() => params.setFilter('id', null)} />
      ) : null}
      {foldersOpen ? (
        <FoldersDialog folders={flatFolders} onClose={() => setFoldersOpen(false)} />
      ) : null}
      {bulkDeleting ? (
        <LazyConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setBulkDeleting(false))}
          title={`Move ${formatCount(selected.size, 'file')} to trash?`}
          description="They can be restored from the Trash filter. Products using them lose those images until restored."
          confirmLabel="Move to trash"
          level="destructive"
          onConfirm={async () => {
            await mediaApi.bulkRemove([...selected]);
            setSelected(new Set());
            void queryClient.invalidateQueries({ queryKey: mediaKeys.all });
            notifySuccess('Moved to trash');
          }}
        />
      ) : null}
    </>
  );
}

function MediaTile({
  asset,
  selected,
  selectable,
  onToggle,
  onOpen,
}: {
  asset: MediaAssetDto;
  selected: boolean;
  selectable: boolean;
  onToggle(): void;
  onOpen(): void;
}) {
  const image = asset.kind === 'IMAGE' && asset.status === 'READY';
  return (
    <li
      className={cn(
        'group relative overflow-hidden rounded-lg border bg-card',
        selected && 'ring-2 ring-primary',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="flex aspect-square items-center justify-center bg-muted">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- static export: renditions come from the API
            <img
              src={renditionUrl(asset, 240)}
              alt={asset.altText ?? ''}
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <span className="p-2 text-center text-xs text-muted-foreground">
              {asset.kind === 'IMAGE' ? asset.status : asset.mimeType}
            </span>
          )}
        </span>
        <span className="flex flex-col gap-0.5 p-2">
          <span className="truncate text-xs font-medium">{asset.title ?? asset.originalName}</span>
          <span className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
            {formatBytes(asset.sizeBytes)} ·{' '}
            {asset.usageCount ? `used ${asset.usageCount}×` : 'unused'}
            {asset.deletedAt ? <Badge tone="danger">In trash</Badge> : null}
            {!asset.altText && asset.kind === 'IMAGE' ? (
              <Badge tone="warning">No alt text</Badge>
            ) : null}
          </span>
        </span>
      </button>
      {selectable ? (
        <button
          type="button"
          aria-pressed={selected}
          aria-label={`${selected ? 'Deselect' : 'Select'} ${asset.originalName}`}
          onClick={onToggle}
          className={cn(
            'absolute top-2 left-2 flex size-6 items-center justify-center rounded border bg-background/90 shadow-sm',
            selected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'opacity-80 group-hover:opacity-100',
          )}
        >
          {selected ? <Check aria-hidden className="size-4" /> : null}
        </button>
      ) : null}
    </li>
  );
}
