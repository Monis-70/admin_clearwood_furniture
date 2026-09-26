'use client';

import { FileImage, RotateCcw, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { formatBytes } from './model';
import {
  canCancel,
  isFinished,
  summarize,
  type UploadItem,
  type UploadQueue,
  type UploadQueueState,
} from './upload-queue';

/**
 * A drop area with a native file input: drag files onto it, or choose them (on a phone this opens
 * the system photo/file picker). Keyboard users reach the visible button; the input stays hidden.
 */
export function UploadDropzone({
  accept,
  label = 'Upload new images',
  inputLabel = 'Upload images',
  dropText = 'Drag images here, or',
  hint,
  disabled,
  onFiles,
  className,
}: {
  accept: string;
  label?: string;
  inputLabel?: string;
  dropText?: string;
  hint?: ReactNode;
  disabled?: boolean;
  onFiles(files: File[]): void;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- a drop target only; the button inside opens the same file chooser for keyboard and touch
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors sm:p-6',
        over ? 'border-primary bg-primary/5' : 'border-input',
        disabled && 'opacity-60',
        className,
      )}
      onDragEnter={(event) => {
        if (disabled || !event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragOver={(event) => {
        if (disabled || !event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(event) => {
        if (disabled) return;
        event.preventDefault();
        setOver(false);
        const files = [...event.dataTransfer.files];
        if (files.length > 0) onFiles(files);
      }}
    >
      <input
        ref={input}
        type="file"
        multiple
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-label={inputLabel}
        disabled={disabled}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = '';
          if (files.length > 0) onFiles(files);
        }}
      />
      <Upload aria-hidden className="size-6 text-muted-foreground" />
      <p>
        <span className="hidden sm:inline">{dropText} </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          {label}
        </Button>
      </p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function LocalPreview({ file }: { file: File }) {
  const previewable = file.type.startsWith('image/') && typeof URL.createObjectURL === 'function';
  return previewable ? (
    // eslint-disable-next-line @next/next/no-img-element -- a local file preview (object URL)
    <img
      ref={(img) => {
        if (!img) return;
        let url: string;
        try {
          url = URL.createObjectURL(file);
        } catch {
          return;
        }
        img.src = url;
        return () => URL.revokeObjectURL(url);
      }}
      alt=""
      className="size-12 shrink-0 rounded bg-muted object-cover"
    />
  ) : (
    <span className="flex size-12 shrink-0 items-center justify-center rounded bg-muted">
      <FileImage aria-hidden className="size-5 text-muted-foreground" />
    </span>
  );
}

function useSecondsLeft(until: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until]);
  return until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
}

function statusText(item: UploadItem, paused: boolean): string {
  const percent = item.total > 0 ? Math.round((item.loaded / item.total) * 100) : 0;
  switch (item.status) {
    case 'queued':
      return paused ? 'Waiting for the upload limit' : 'Waiting';
    case 'uploading':
      return `Uploading ${percent}%`;
    case 'processing':
      return 'Processing on the server…';
    case 'done':
      return item.deduplicated ? 'This image is already in your media library.' : 'Uploaded';
    case 'failed':
      return item.error ? `${item.error.title}: ${item.error.message}` : 'Failed';
    case 'cancelled':
      return 'Cancelled';
  }
}

/**
 * Per-file and overall progress with cancel, retry and remove. Failures stay listed with the API's
 * reason until removed; successful files are never rolled back because a neighbour failed.
 */
export function UploadPanel({
  state,
  queue,
  extra,
  className,
}: {
  state: UploadQueueState;
  queue: UploadQueue;
  /** Per-row follow-up (for example "Added to the gallery" or "Use existing image"). */
  extra?: (item: UploadItem) => ReactNode;
  className?: string;
}) {
  const summary = summarize(state);
  const secondsLeft = useSecondsLeft(state.pausedUntil);
  if (state.items.length === 0) return null;
  const paused = state.pausedUntil !== null;
  const retryable = state.items.filter((item) => item.status === 'failed' && item.retryable);
  const clearable = state.items.some(
    (item) => item.status === 'done' || item.status === 'cancelled',
  );

  return (
    <section
      aria-label="Uploads"
      className={cn('flex flex-col gap-3 rounded-lg border bg-card p-3', className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p role="status" className="mr-auto text-sm font-medium">
          {summary.pending > 0
            ? `${summary.done} of ${summary.done + summary.pending} uploaded`
            : [
                `${summary.done} uploaded successfully`,
                summary.failed ? `${summary.failed} failed` : null,
                summary.cancelled ? `${summary.cancelled} cancelled` : null,
              ]
                .filter(Boolean)
                .join(' / ')}
        </p>
        {retryable.length > 1 ? (
          <Button type="button" size="sm" variant="outline" onClick={() => queue.retryFailed()}>
            <RotateCcw aria-hidden />
            Retry failed ({retryable.length})
          </Button>
        ) : null}
        {clearable ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => queue.clearFinished()}>
            Clear finished
          </Button>
        ) : null}
      </div>
      {summary.pending > 0 ? (
        <div
          role="progressbar"
          aria-label="Overall upload progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={summary.percent}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${summary.percent}%` }}
          />
        </div>
      ) : null}
      {paused ? (
        <p className="rounded-md bg-warning-bg px-3 py-2 text-sm text-warning">
          The server&apos;s upload limit was reached. Uploading resumes in {secondsLeft} s; nothing
          needs to be chosen again.
        </p>
      ) : null}
      <ul className="flex flex-col divide-y" aria-label="Files being uploaded">
        {state.items.map((item) => {
          const name = item.file.name;
          const percent = item.total > 0 ? Math.round((item.loaded / item.total) * 100) : 0;
          return (
            <li key={item.id} className="flex items-start gap-3 py-2">
              <LocalPreview file={item.file} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="truncate font-medium">{name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(item.file.size)}
                  </span>
                </p>
                {item.status === 'uploading' || item.status === 'processing' ? (
                  <div
                    role="progressbar"
                    aria-label={`Upload progress for ${name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={item.status === 'processing' ? 100 : percent}
                    aria-valuetext={statusText(item, paused)}
                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className={cn(
                        'h-full rounded-full bg-primary transition-[width]',
                        item.status === 'processing' && 'animate-pulse',
                      )}
                      style={{ width: `${item.status === 'processing' ? 100 : percent}%` }}
                    />
                  </div>
                ) : null}
                <p
                  className={cn(
                    'text-xs',
                    item.status === 'failed' ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {statusText(item, paused)}
                </p>
                {extra?.(item)}
              </div>
              <div className="flex shrink-0 gap-1">
                {canCancel(item) ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Cancel ${name}`}
                    onClick={() => queue.cancel(item.id)}
                  >
                    <X aria-hidden />
                  </Button>
                ) : null}
                {(item.status === 'failed' && item.retryable) || item.status === 'cancelled' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`Retry ${name}`}
                    onClick={() => queue.retry(item.id)}
                  >
                    Retry
                  </Button>
                ) : null}
                {isFinished(item) && item.status !== 'done' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${name} from the list`}
                    onClick={() => queue.remove(item.id)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
