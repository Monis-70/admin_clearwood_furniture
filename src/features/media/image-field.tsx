'use client';

import { useQuery } from '@tanstack/react-query';
import { ImageOff, Images, Upload, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useId, useRef, useState } from 'react';
import { useController, type FieldPath, type FieldValues } from 'react-hook-form';

import { GuardedButton } from '@/components/patterns/guarded-button';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/surface';
import { describeError } from '@/lib/api/error-messages';
import { mediaRoutes } from '@/lib/api/routes/media';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';
import { cn } from '@/lib/utils';

import { mediaApi, mediaKeys, renditionUrl } from './api';
import { describeTypes, fileProblem } from './upload-queue';

const MediaPicker = dynamic(() => import('./media-picker').then((m) => m.MediaPicker), {
  ssr: false,
});

/** Until `/media/config` answers; the API checks the real limits either way. */
const FALLBACK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * One image of a record (a category banner, a collection image…), kept as its media id. Upload a
 * new file or choose one from the library: the file joins the library at once, and the record
 * uses it once the form is saved.
 */
export function ImageField<T extends FieldValues>({
  name,
  label,
  description,
  shape = 'wide',
}: {
  name: FieldPath<T>;
  label: string;
  description?: string;
  shape?: 'square' | 'wide';
}) {
  const { canCall } = usePermissions();
  const { field } = useController<T>({ name });
  const mediaId = (field.value as string | null | undefined) ?? '';
  const editable = !field.disabled;
  const base = useId();
  const input = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [problem, setProblem] = useState<{ title: string; message: string } | null>(null);

  const canSee = canCall(mediaRoutes.get);
  const asset = useQuery({
    queryKey: mediaKeys.asset(mediaId),
    queryFn: ({ signal }) => mediaApi.get(mediaId, signal),
    enabled: Boolean(mediaId) && canSee,
    ...cachePolicy.detail,
  });
  const config = useQuery({
    queryKey: mediaKeys.config(),
    queryFn: ({ signal }) => mediaApi.config(signal),
    enabled: editable && canCall(mediaRoutes.upload),
    ...cachePolicy.reference,
  });
  const types = config.data?.allowedImageMime ?? FALLBACK_TYPES;

  const upload = async (file: File) => {
    setProblem(null);
    const refusal = fileProblem(file, {
      allowedMime: types,
      maxUploadSizeMb: config.data?.maxUploadSizeMb ?? Number.POSITIVE_INFINITY,
    });
    if (refusal) {
      setProblem({ title: 'This file cannot be used', message: refusal });
      return;
    }
    setProgress(0);
    try {
      const result = await mediaApi.uploadOne(file, {
        onProgress: ({ loaded, total }) =>
          setProgress(total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 0),
      });
      field.onChange(result.media.id);
    } catch (error) {
      setProblem(describeError(error));
    } finally {
      setProgress(null);
    }
  };

  const busy = progress !== null;
  const descriptionId = description ? `${base}-description` : undefined;

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={descriptionId}>
      <legend className="text-sm font-medium">{label}</legend>
      {description ? (
        <p id={descriptionId} className="-mt-1 text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div
          className={cn(
            'flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40',
            shape === 'square' ? 'size-24' : 'aspect-[3/1] w-full sm:w-64',
            !mediaId && 'border-dashed',
          )}
        >
          {!mediaId ? (
            <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
              <ImageOff aria-hidden className="size-5" />
              No image
            </span>
          ) : !canSee ? (
            <span className="px-2 text-center text-xs text-muted-foreground">Image chosen</span>
          ) : asset.isPending ? (
            <Skeleton className="size-full" />
          ) : asset.error ? (
            <span className="px-2 text-center text-xs text-destructive">
              {describeError(asset.error).title}
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- static export: no image optimiser
            <img
              src={renditionUrl(asset.data, shape === 'square' ? 200 : 640)}
              alt={asset.data.altText ?? ''}
              className="size-full object-cover"
            />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          {asset.data ? (
            <p className="truncate text-xs text-muted-foreground" title={asset.data.originalName}>
              {asset.data.title ?? asset.data.originalName}
              {asset.data.width && asset.data.height
                ? ` · ${asset.data.width} × ${asset.data.height}`
                : ''}
            </p>
          ) : null}
          {editable ? (
            <div className="flex flex-wrap gap-2">
              <GuardedButton
                type="button"
                size="sm"
                variant="outline"
                endpoint={mediaRoutes.upload}
                loading={busy}
                onClick={() => input.current?.click()}
              >
                <Upload aria-hidden />
                {mediaId ? 'Upload a new image' : 'Upload image'}
              </GuardedButton>
              <GuardedButton
                type="button"
                size="sm"
                variant="outline"
                endpoint={mediaRoutes.list}
                disabled={busy}
                onClick={() => setPicking(true)}
              >
                <Images aria-hidden />
                Choose from library
              </GuardedButton>
              {mediaId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  aria-label={`Remove ${label.toLowerCase()}`}
                  onClick={() => {
                    setProblem(null);
                    field.onChange('');
                  }}
                >
                  <X aria-hidden />
                  Remove
                </Button>
              ) : null}
            </div>
          ) : null}
          {editable ? (
            <p className="text-xs text-muted-foreground">
              {describeTypes(types)}
              {config.data ? `, up to ${config.data.maxUploadSizeMb} MB` : ''}.
            </p>
          ) : null}
        </div>
      </div>
      {busy ? (
        <p role="status" className="text-xs text-muted-foreground">
          Uploading… {progress}%
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="text-xs text-destructive">
          <span className="font-medium">{problem.title}.</span> {problem.message}
        </p>
      ) : null}
      <input
        ref={input}
        type="file"
        accept={types.join(',')}
        aria-label={`Upload ${label.toLowerCase()}`}
        tabIndex={-1}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void upload(file);
        }}
      />
      {picking ? (
        <MediaPicker
          title={`Choose the ${label.toLowerCase()}`}
          multiple={false}
          onClose={() => setPicking(false)}
          onChoose={(assets) => {
            if (assets[0]) {
              setProblem(null);
              field.onChange(assets[0].id);
            }
            setPicking(false);
          }}
        />
      ) : null}
    </fieldset>
  );
}
