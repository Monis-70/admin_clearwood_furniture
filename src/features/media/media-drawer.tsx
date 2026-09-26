'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { z } from 'zod';

import type { MediaDetailDto } from '@shared/types/media';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { ErrorState, SectionLoader } from '@/components/patterns/states';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { endpoints } from '@/lib/api/endpoints';
import { formatDateTime } from '@/lib/format/datetime';
import { notifyError, notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { EditorForm, SelectField, TextField, optionalText, textInput } from '../catalog/form-kit';

import { mediaApi, mediaKeys, renditionUrl } from './api';
import { USAGE_LABELS, formatBytes, type FlatFolder } from './model';

const TAG = /^[\w][\w .-]*$/;
const schema = z.object({
  altText: optionalText(300),
  title: optionalText(200),
  tags: z
    .string()
    .transform((v) =>
      v
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    )
    .refine((tags) => tags.length <= 25, 'At most 25 tags')
    .refine(
      (tags) => tags.every((t) => t.length <= 40 && TAG.test(t)),
      'Tags use letters, digits, spaces, dots and dashes',
    ),
  folderId: z.string().transform((v) => v || null),
});
type Values = z.input<typeof schema>;

export function MediaDrawer({
  id,
  folders,
  onClose,
}: {
  id: string;
  folders: FlatFolder[];
  onClose(): void;
}) {
  const asset = useQuery({
    queryKey: mediaKeys.asset(id),
    queryFn: ({ signal }) => mediaApi.get(id, signal),
    ...cachePolicy.detail,
  });
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {asset.isPending ? (
          <>
            <SheetTitle className="sr-only">Media</SheetTitle>
            <SheetDescription className="sr-only">Loading</SheetDescription>
            <SectionLoader label="Loading file…" />
          </>
        ) : asset.error ? (
          <>
            <SheetTitle>File</SheetTitle>
            <SheetDescription className="sr-only">Could not load</SheetDescription>
            <ErrorState error={asset.error} onRetry={() => void asset.refetch()} />
          </>
        ) : (
          <Detail asset={asset.data} folders={folders} onClose={onClose} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Detail({
  asset,
  folders,
  onClose,
}: {
  asset: MediaDetailDto;
  folders: FlatFolder[];
  onClose(): void;
}) {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const replaceInput = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<'trash' | 'permanent' | null>(null);
  const [focal, setFocal] = useState(asset.focalPoint);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: mediaKeys.all });
  const canEdit = canCall(endpoints.media.update) && !asset.deletedAt;
  const image = asset.kind === 'IMAGE';

  const action = useMutation({
    mutationFn: async (run: () => Promise<unknown>) => run(),
    onSuccess: refresh,
    onError: (error) => notifyError(error, 'Could not complete the action'),
  });
  const saveFocal = useMutation({
    mutationFn: (point: { x: number; y: number }) =>
      mediaApi.update(asset.id, { focalPoint: point }),
    onSuccess: () => {
      refresh();
      notifySuccess('Focal point saved', 'Crops keep this spot in view.');
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <SheetHeader className="p-0">
        <SheetTitle className="break-all">{asset.title ?? asset.originalName}</SheetTitle>
        <SheetDescription>
          {asset.mimeType} · {formatBytes(asset.sizeBytes)}
          {asset.width ? ` · ${asset.width}×${asset.height}px` : ''}
        </SheetDescription>
      </SheetHeader>
      {asset.deletedAt ? (
        <Alert tone="warning" title="In trash">
          Restore it to use it again.
        </Alert>
      ) : null}
      {asset.status !== 'READY' ? (
        <Alert
          tone={asset.status === 'FAILED' ? 'danger' : 'info'}
          title={`Status: ${asset.status.toLowerCase()}`}
        >
          {asset.processingError ?? 'The server is still preparing this file.'}
        </Alert>
      ) : null}
      {image && asset.status === 'READY' ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={!canEdit}
            className="relative block overflow-hidden rounded-md border bg-muted disabled:cursor-default"
            aria-label={canEdit ? 'Click the image to set the focal point' : 'Preview'}
            onClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              setFocal({
                x: Math.round(((event.clientX - box.left) / box.width) * 10_000),
                y: Math.round(((event.clientY - box.top) / box.height) * 10_000),
              });
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static export: renditions come from the API */}
            <img src={renditionUrl(asset, 640)} alt={asset.altText ?? ''} className="w-full" />
            {focal ? (
              <span
                aria-hidden
                className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary/70 shadow"
                style={{ left: `${focal.x / 100}%`, top: `${focal.y / 100}%` }}
              />
            ) : null}
          </button>
          {canEdit ? (
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {focal
                  ? `Focal point ${Math.round(focal.x / 100)}% × ${Math.round(focal.y / 100)}%`
                  : 'Click the image to choose what crops keep in view.'}
              </span>
              {focal && JSON.stringify(focal) !== JSON.stringify(asset.focalPoint) ? (
                <Button
                  size="sm"
                  variant="outline"
                  loading={saveFocal.isPending}
                  onClick={() => saveFocal.mutate(focal)}
                >
                  Save focal point
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <EditorForm
        key={asset.updatedAt}
        schema={schema}
        defaultValues={{
          altText: textInput(asset.altText),
          title: textInput(asset.title),
          tags: asset.tags.join(', '),
          folderId: textInput(asset.folderId),
        }}
        successMessage="File details saved"
        readOnly={canEdit ? undefined : <p className="text-sm text-muted-foreground">View only.</p>}
        onSubmit={async (values) => {
          await mediaApi.update(asset.id, values);
          refresh();
        }}
      >
        <TextField<Values>
          name="altText"
          label="Alt text"
          description="Describes the image for screen readers and search engines."
        />
        <TextField<Values> name="title" label="Title" />
        <TextField<Values> name="tags" label="Tags" description="Separate with commas." />
        <SelectField<Values>
          name="folderId"
          label="Folder"
          options={[
            { value: '', label: 'No folder' },
            ...folders.map((f) => ({
              value: f.id,
              label: `${'\u00a0\u00a0'.repeat(f.depth)}${f.name}`,
            })),
          ]}
        />
      </EditorForm>

      <section aria-labelledby="usage-heading" className="flex flex-col gap-2 text-sm">
        <h3 id="usage-heading" className="font-medium">
          Used in {asset.usage?.length ?? asset.usageCount} place
          {(asset.usage?.length ?? asset.usageCount) === 1 ? '' : 's'}
        </h3>
        {asset.usage?.length ? (
          <ul className="flex flex-col gap-1">
            {asset.usage.map((usage) => (
              <li key={usage.id} className="flex items-center gap-2">
                <Badge tone="outline">{USAGE_LABELS[usage.usageType] ?? usage.usageType}</Badge>
                {usage.usageType === 'PRODUCT' ? (
                  <Link
                    className="underline-offset-2 hover:underline"
                    href={`/catalog/products/edit?id=${encodeURIComponent(usage.entityId)}&tab=media`}
                  >
                    Open product
                  </Link>
                ) : (
                  <span className="font-mono text-xs text-muted-foreground">{usage.entityId}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Nothing uses this file.</p>
        )}
        <p className="text-xs text-muted-foreground">Uploaded {formatDateTime(asset.createdAt)}</p>
      </section>

      <FormAlert error={action.error} />
      <div className="flex flex-wrap gap-2 border-t pt-4">
        {canEdit ? (
          <>
            <input
              ref={replaceInput}
              type="file"
              accept={asset.mimeType}
              className="sr-only"
              tabIndex={-1}
              aria-label="Replacement file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file)
                  action.mutate(() =>
                    mediaApi
                      .replace(asset.id, file)
                      .then(() =>
                        notifySuccess(
                          'File replaced',
                          'Everything using it now shows the new file.',
                        ),
                      ),
                  );
              }}
            />
            <Button
              variant="outline"
              size="sm"
              loading={action.isPending}
              onClick={() => replaceInput.current?.click()}
            >
              Replace file…
            </Button>
            {canCall(endpoints.media.reprocess) ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  action.mutate(() =>
                    mediaApi.reprocess(asset.id).then(() => notifySuccess('Renditions queued')),
                  )
                }
              >
                Regenerate sizes
              </Button>
            ) : null}
          </>
        ) : null}
        {asset.deletedAt ? (
          canCall(endpoints.media.restore) ? (
            <Button
              size="sm"
              onClick={() =>
                action.mutate(() =>
                  mediaApi.restore(asset.id).then(() => notifySuccess('File restored')),
                )
              }
            >
              Restore
            </Button>
          ) : null
        ) : canCall(endpoints.media.remove) ? (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto text-destructive"
            onClick={() => setConfirm('trash')}
          >
            Move to trash…
          </Button>
        ) : null}
        {asset.deletedAt && canCall(endpoints.media.removePermanently) ? (
          <Button
            size="sm"
            variant="destructive"
            className="ml-auto"
            onClick={() => setConfirm('permanent')}
          >
            Delete permanently…
          </Button>
        ) : null}
      </div>
      {confirm ? (
        <LazyConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setConfirm(null))}
          title={confirm === 'trash' ? 'Move this file to trash?' : 'Delete this file permanently?'}
          description={
            confirm === 'trash'
              ? 'It can be restored from the Trash filter.'
              : 'The file and all its sizes are erased from storage. This cannot be undone. Refused while anything still uses it.'
          }
          confirmLabel={confirm === 'trash' ? 'Move to trash' : 'Delete permanently'}
          level={confirm === 'trash' ? 'destructive' : 'irreversible'}
          confirmText={confirm === 'permanent' ? 'DELETE' : undefined}
          onConfirm={async () => {
            if (confirm === 'trash') {
              await mediaApi.remove(asset.id);
              notifySuccess('Moved to trash');
              refresh();
            } else {
              await mediaApi.removePermanently(asset.id);
              notifySuccess('File deleted permanently');
              refresh();
              onClose();
            }
          }}
        />
      ) : null}
    </div>
  );
}
