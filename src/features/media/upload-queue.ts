import type { MediaAssetDto, MediaUploadResultDto } from '@shared/types/media';

import type { UploadProgress } from '@/lib/api/client';
import { describeError } from '@/lib/api/error-messages';
import { isApiError } from '@/lib/api/errors';

import { formatBytes } from './model';

/**
 * A bounded upload queue: one file per request, at most `concurrency` requests at a time, in the
 * order the files were chosen. Every state it reports comes from the request itself (bytes the
 * browser has sent, the API's answer); nothing is simulated.
 *
 * - `uploading`: bytes are being sent (progress is real);
 * - `processing`: every byte is sent and the API is validating the file and making its sizes;
 * - `done` / `failed` / `cancelled`: the request is over.
 *
 * A `429` from the API's upload limiter puts the file back in line and pauses the queue for the
 * `Retry-After` the API sent, then resumes on its own.
 */

export type UploadStatus = 'queued' | 'uploading' | 'processing' | 'done' | 'failed' | 'cancelled';

export interface UploadItem {
  readonly id: string;
  readonly file: File;
  readonly status: UploadStatus;
  /** Bytes the browser has sent. */
  readonly loaded: number;
  readonly total: number;
  readonly asset: MediaAssetDto | null;
  /** The API found the same file in the library and returned that asset instead of a copy. */
  readonly deduplicated: boolean;
  readonly error: { title: string; message: string } | null;
  /** False for refusals that would only happen again (type, size, empty file). */
  readonly retryable: boolean;
  readonly attempts: number;
}

export interface UploadQueueState {
  readonly items: readonly UploadItem[];
  /** Epoch ms until which the API asked to wait (429 Retry-After); null when running. */
  readonly pausedUntil: number | null;
}

export type Uploader = (
  file: File,
  options: { signal: AbortSignal; onProgress(progress: UploadProgress): void },
) => Promise<MediaUploadResultDto>;

export interface UploadQueueOptions {
  upload?: Uploader;
  /** Requests in flight at once. */
  concurrency?: number;
  /** A reason to refuse a file before sending it (UX only: the API validates again). */
  validate?: (file: File) => string | null;
  /** Like `validate`, for checks that must read the file (image dimensions); runs just before sending. */
  inspect?: (file: File) => Promise<string | null>;
  /** Used when a 429 carries no Retry-After. */
  defaultRetryAfterSeconds?: number;
  now?: () => number;
}

export interface AddResult {
  added: readonly UploadItem[];
  /** Already in this list (same name, size and modification time). */
  duplicates: readonly File[];
}

export interface UploadQueue {
  getState(): UploadQueueState;
  subscribe(listener: () => void): () => void;
  /** Replaces the uploader and/or validator (a component passes its latest props). */
  configure(options: Pick<UploadQueueOptions, 'upload' | 'validate' | 'inspect'>): void;
  add(files: readonly File[]): AddResult;
  /** Queued or still sending; a file the API is already processing cannot be recalled. */
  cancel(id: string): void;
  retry(id: string): void;
  retryFailed(): void;
  /** Only finished rows (done, failed, cancelled) can leave the list. */
  remove(id: string): void;
  clearFinished(): void;
  /** Pairs with `dispose` (a remounted component re-activates its queue). */
  activate(): void;
  /** Stops the queue: aborts what is sending and starts nothing new. */
  dispose(): void;
}

/**
 * Two at a time: the API makes every rendition inside the upload request (CPU-bound) and limits
 * uploads per network per minute, so more parallel requests would not finish sooner.
 */
export const UPLOAD_CONCURRENCY = 2;

const ACTIVE: ReadonlySet<UploadStatus> = new Set(['uploading', 'processing']);
const FINISHED: ReadonlySet<UploadStatus> = new Set(['done', 'failed', 'cancelled']);

export const isActive = (item: UploadItem) => ACTIVE.has(item.status);
export const isFinished = (item: UploadItem) => FINISHED.has(item.status);
export const canCancel = (item: UploadItem) =>
  item.status === 'queued' || item.status === 'uploading';

const fileKey = (file: File) => `${file.name}\u0000${file.size}\u0000${file.lastModified}`;

/** Failures a second attempt can fix: the network, a timeout, or the server itself. */
function retryableFailure(error: unknown): boolean {
  if (!isApiError(error)) return true;
  return error.status === 0 || error.status === 408 || error.status >= 500;
}

export function createUploadQueue(options: UploadQueueOptions = {}): UploadQueue {
  const concurrency = Math.max(1, options.concurrency ?? UPLOAD_CONCURRENCY);
  const now = options.now ?? Date.now;
  let upload: Uploader =
    options.upload ?? (() => Promise.reject(new Error('The upload queue is not configured.')));
  let validate = options.validate;
  let inspect = options.inspect;
  const listeners = new Set<() => void>();
  const controllers = new Map<string, AbortController>();
  let state: UploadQueueState = { items: [], pausedUntil: null };
  let sequence = 0;
  let resumeTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const setState = (next: UploadQueueState) => {
    state = next;
    emit();
  };

  const patch = (id: string, change: Partial<UploadItem>) => {
    if (!state.items.some((item) => item.id === id)) return;
    setState({
      ...state,
      items: state.items.map((item) => (item.id === id ? { ...item, ...change } : item)),
    });
  };

  const armResume = () => {
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(
      () => {
        resumeTimer = null;
        pump();
      },
      Math.max(0, (state.pausedUntil ?? 0) - now()),
    );
  };

  const pause = (seconds: number | null) => {
    const until = now() + Math.max(1, seconds ?? options.defaultRetryAfterSeconds ?? 30) * 1000;
    setState({ ...state, pausedUntil: Math.max(state.pausedUntil ?? 0, until) });
    armResume();
  };

  const start = (item: UploadItem) => {
    const controller = new AbortController();
    controllers.set(item.id, controller);
    patch(item.id, {
      status: 'uploading',
      loaded: 0,
      total: item.file.size,
      error: null,
      attempts: item.attempts + 1,
    });
    const send = () =>
      upload(item.file, {
        signal: controller.signal,
        onProgress: ({ loaded, total }) => {
          const size = total || item.file.size;
          patch(item.id, {
            loaded: Math.min(loaded, size),
            total: size,
            status: size > 0 && loaded >= size ? 'processing' : 'uploading',
          });
        },
      }).then((result) => {
        patch(item.id, {
          status: 'done',
          loaded: item.file.size,
          asset: result.media,
          deduplicated: result.deduplicated,
        });
      });
    const work = inspect
      ? inspect(item.file)
          .catch(() => null)
          .then((reason) => {
            if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
            if (!reason) return send();
            patch(item.id, {
              status: 'failed',
              error: { title: 'Not uploaded', message: reason },
              retryable: false,
            });
          })
      : send();
    work
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          patch(item.id, { status: 'cancelled', loaded: 0 });
        } else if (isApiError(error) && error.status === 429) {
          patch(item.id, { status: 'queued', loaded: 0 });
          pause(error.retryAfterSeconds);
        } else {
          const presentation = describeError(error);
          patch(item.id, {
            status: 'failed',
            error: { title: presentation.title, message: presentation.message },
            retryable: retryableFailure(error),
          });
        }
      })
      .finally(() => {
        controllers.delete(item.id);
        pump();
      });
  };

  function pump() {
    if (disposed) return;
    if (state.pausedUntil !== null) {
      if (now() < state.pausedUntil) {
        if (!resumeTimer) armResume();
        return;
      }
      setState({ ...state, pausedUntil: null });
    }
    let running = state.items.filter(isActive).length;
    for (const item of state.items) {
      if (running >= concurrency) break;
      if (item.status !== 'queued') continue;
      running += 1;
      start(item);
    }
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    configure(next) {
      if (next.upload) upload = next.upload;
      if ('validate' in next) validate = next.validate;
      if ('inspect' in next) inspect = next.inspect;
    },
    add(files) {
      const known = new Set(
        state.items
          .filter((item) => item.status !== 'failed' && item.status !== 'cancelled')
          .map((item) => fileKey(item.file)),
      );
      const added: UploadItem[] = [];
      const duplicates: File[] = [];
      for (const file of files) {
        const key = fileKey(file);
        if (known.has(key)) {
          duplicates.push(file);
          continue;
        }
        known.add(key);
        const reason = validate?.(file) ?? null;
        sequence += 1;
        added.push({
          id: `upload-${sequence}`,
          file,
          status: reason ? 'failed' : 'queued',
          loaded: 0,
          total: file.size,
          asset: null,
          deduplicated: false,
          error: reason ? { title: 'Not uploaded', message: reason } : null,
          retryable: !reason,
          attempts: 0,
        });
      }
      if (added.length > 0) {
        setState({ ...state, items: [...state.items, ...added] });
        pump();
      }
      return { added, duplicates };
    },
    cancel(id) {
      const item = state.items.find((entry) => entry.id === id);
      if (!item || !canCancel(item)) return;
      if (item.status === 'queued') patch(id, { status: 'cancelled' });
      else controllers.get(id)?.abort();
    },
    retry(id) {
      const item = state.items.find((entry) => entry.id === id);
      if (!item || !(item.status === 'cancelled' || (item.status === 'failed' && item.retryable)))
        return;
      patch(id, { status: 'queued', error: null, loaded: 0 });
      pump();
    },
    retryFailed() {
      setState({
        ...state,
        items: state.items.map((item) =>
          item.status === 'failed' && item.retryable
            ? { ...item, status: 'queued', error: null, loaded: 0 }
            : item,
        ),
      });
      pump();
    },
    remove(id) {
      const item = state.items.find((entry) => entry.id === id);
      if (!item || !isFinished(item)) return;
      setState({ ...state, items: state.items.filter((entry) => entry.id !== id) });
    },
    clearFinished() {
      setState({
        ...state,
        items: state.items.filter((item) => item.status !== 'done' && item.status !== 'cancelled'),
      });
    },
    activate() {
      if (!disposed) return;
      disposed = false;
      pump();
    },
    dispose() {
      disposed = true;
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = null;
      for (const controller of controllers.values()) controller.abort();
    },
  };
}

export interface UploadSummary {
  total: number;
  done: number;
  failed: number;
  cancelled: number;
  /** Queued, sending or being processed. */
  pending: number;
  deduplicated: number;
  /** 0–100 over the files that are still meant to upload (failed and cancelled excluded). */
  percent: number;
}

export function summarize(state: UploadQueueState): UploadSummary {
  let sent = 0;
  let size = 0;
  const count = { done: 0, failed: 0, cancelled: 0, pending: 0, deduplicated: 0 };
  for (const item of state.items) {
    if (item.status === 'failed') count.failed += 1;
    else if (item.status === 'cancelled') count.cancelled += 1;
    else {
      if (item.status === 'done') {
        count.done += 1;
        if (item.deduplicated) count.deduplicated += 1;
      } else count.pending += 1;
      size += item.file.size;
      sent += item.status === 'done' ? item.file.size : item.loaded;
    }
  }
  return {
    total: state.items.length,
    ...count,
    percent: size > 0 ? Math.round((sent / size) * 100) : count.done > 0 ? 100 : 0,
  };
}

/** "JPEG, PNG, WebP" from the API's MIME allow-list. */
export function describeTypes(mimeTypes: readonly string[]): string {
  const names = mimeTypes.map((mime) => {
    const sub = (mime.split('/')[1] ?? mime).replace(/\+xml$/, '');
    return sub === 'webp' ? 'WebP' : sub.toUpperCase();
  });
  return [...new Set(names)].join(', ');
}

/**
 * The API's limits applied before sending, so an obvious refusal costs no request. The API still
 * checks the real contents (magic bytes) and size, so this is a convenience, never the guard.
 */
export function fileProblem(
  file: File,
  limits: { allowedMime: readonly string[]; maxUploadSizeMb: number },
): string | null {
  if (file.size === 0) return 'The file is empty.';
  if (limits.allowedMime.length > 0 && !limits.allowedMime.includes(file.type)) {
    return `Not an accepted type (${file.type || 'unknown'}). Use ${describeTypes(limits.allowedMime)}.`;
  }
  const maxBytes = limits.maxUploadSizeMb * 1_048_576;
  if (file.size > maxBytes) {
    return `${formatBytes(file.size)} is over the ${limits.maxUploadSizeMb} MB limit.`;
  }
  return null;
}

/** Raster types the API measures for product galleries (it skips SVG and GIF). */
export const MEASURED_IMAGE_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

/**
 * Refuses an image the API would not attach to a product (`minProductImageDimension` from
 * `/media/config`) before its bytes are sent. When the browser cannot decode the file, the API
 * decides.
 */
export async function productImageProblem(file: File, minSide: number): Promise<string | null> {
  if (
    minSide <= 0 ||
    !MEASURED_IMAGE_TYPES.has(file.type) ||
    typeof createImageBitmap !== 'function'
  ) {
    return null;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    bitmap.close();
    if (Math.min(width, height) >= minSide) return null;
    return `${width} × ${height} px is too small for a product image: it needs at least ${minSide} px on the shortest side.`;
  } catch {
    return null;
  }
}
