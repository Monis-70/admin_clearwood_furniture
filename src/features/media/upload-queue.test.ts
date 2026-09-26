import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MediaAssetDto, MediaUploadResultDto } from '@shared/types/media';

import type { UploadProgress } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';

import {
  createUploadQueue,
  describeTypes,
  fileProblem,
  productImageProblem,
  summarize,
  type UploadQueue,
} from './upload-queue';

interface Pending {
  file: File;
  signal: AbortSignal;
  progress(loaded: number): void;
  resolve(deduplicated?: boolean): void;
  reject(error: unknown): void;
}

/** An uploader whose requests the test finishes one by one. */
function controllableUploader() {
  const pending: Pending[] = [];
  const started: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const upload = (
    file: File,
    options: { signal: AbortSignal; onProgress(progress: UploadProgress): void },
  ) =>
    new Promise<MediaUploadResultDto>((resolve, reject) => {
      started.push(file.name);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const settle = () => {
        inFlight -= 1;
        pending.splice(pending.indexOf(entry), 1);
      };
      const entry: Pending = {
        file,
        signal: options.signal,
        progress: (loaded) => options.onProgress({ loaded, total: file.size }),
        resolve: (deduplicated = false) => {
          settle();
          resolve({ media: { id: `med_${file.name}` } as MediaAssetDto, deduplicated });
        },
        reject: (error) => {
          settle();
          reject(error);
        },
      };
      options.signal.addEventListener('abort', () =>
        entry.reject(new DOMException('cancelled', 'AbortError')),
      );
      pending.push(entry);
    });
  return {
    upload,
    pending,
    started,
    get maxInFlight() {
      return maxInFlight;
    },
    find: (name: string) => pending.find((entry) => entry.file.name === name)!,
  };
}

const png = (name: string, size = 1000) =>
  new File([new Uint8Array(size)], name, { type: 'image/png', lastModified: 1 });

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const statusOf = (queue: UploadQueue, name: string) =>
  queue.getState().items.find((item) => item.file.name === name)?.status;

const apiError = (status: number, code: string, retryAfterSeconds: number | null = null) =>
  new ApiError({
    status,
    code,
    message: `${code} from the API`,
    requestId: 'req_1',
    method: 'POST',
    path: '/admin/media/upload',
    retryAfterSeconds,
  });

afterEach(() => vi.useRealTimers());

describe('upload queue', () => {
  it.each([3, 4, 10, 20])(
    'uploads %i files one per request, never more than two at a time, in the chosen order',
    async (count) => {
      const api = controllableUploader();
      const queue = createUploadQueue({ upload: api.upload });
      const files = Array.from({ length: count }, (_, i) => png(`photo-${i + 1}.png`));
      queue.add(files);
      while (api.pending.length > 0) {
        expect(api.pending.length).toBeLessThanOrEqual(2);
        api.pending[0]!.resolve();
        await flush();
      }
      expect(api.maxInFlight).toBe(Math.min(2, count));
      expect(api.started).toEqual(files.map((file) => file.name));
      expect(summarize(queue.getState())).toMatchObject({ done: count, failed: 0, percent: 100 });
    },
  );

  it('reports the real bytes sent, then processing while the API makes the sizes', async () => {
    const api = controllableUploader();
    const queue = createUploadQueue({ upload: api.upload });
    queue.add([png('a.png', 1000)]);
    const request = api.find('a.png');
    request.progress(250);
    expect(queue.getState().items[0]).toMatchObject({ status: 'uploading', loaded: 250 });
    expect(summarize(queue.getState()).percent).toBe(25);
    request.progress(1000);
    expect(queue.getState().items[0]!.status).toBe('processing');
    request.resolve();
    await flush();
    expect(queue.getState().items[0]).toMatchObject({
      status: 'done',
      asset: { id: 'med_a.png' },
      deduplicated: false,
    });
  });

  it('isolates a failure: the others finish, the refusal keeps the API reason', async () => {
    const api = controllableUploader();
    const queue = createUploadQueue({ upload: api.upload });
    queue.add(['1.png', '2.png', '3.png', '4.png'].map((name) => png(name)));
    api.find('1.png').resolve();
    api.find('2.png').reject(apiError(415, 'UNSUPPORTED_FILE_TYPE'));
    await flush();
    api.find('3.png').resolve();
    await flush();
    api.find('4.png').resolve();
    await flush();
    const failed = queue.getState().items.find((item) => item.file.name === '2.png')!;
    expect(failed).toMatchObject({ status: 'failed', retryable: false });
    expect(failed.error?.title).toBe('Unsupported file');
    expect(summarize(queue.getState())).toMatchObject({ done: 3, failed: 1, pending: 0 });
  });

  it('retries a network failure and removes a finished row on request', async () => {
    const api = controllableUploader();
    const queue = createUploadQueue({ upload: api.upload });
    queue.add([png('a.png')]);
    api.find('a.png').reject(apiError(0, 'NETWORK_ERROR'));
    await flush();
    const [item] = queue.getState().items;
    expect(item).toMatchObject({ status: 'failed', retryable: true });
    queue.retry(item!.id);
    expect(statusOf(queue, 'a.png')).toBe('uploading');
    api.find('a.png').resolve();
    await flush();
    expect(queue.getState().items[0]).toMatchObject({ status: 'done', attempts: 2 });
    queue.remove(item!.id);
    expect(queue.getState().items).toHaveLength(0);
  });

  it('cancels a queued file without sending it and aborts one that is sending', async () => {
    const api = controllableUploader();
    const queue = createUploadQueue({ upload: api.upload });
    queue.add(['a.png', 'b.png', 'c.png'].map((name) => png(name)));
    const [a, , c] = queue.getState().items;
    queue.cancel(c!.id);
    expect(statusOf(queue, 'c.png')).toBe('cancelled');
    const signal = api.find('a.png').signal;
    queue.cancel(a!.id);
    expect(signal.aborted).toBe(true);
    await flush();
    expect(statusOf(queue, 'a.png')).toBe('cancelled');
    expect(api.started).toEqual(['a.png', 'b.png']);
  });

  it('pauses on 429 for the Retry-After the API sent, then resumes without re-choosing', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const api = controllableUploader();
    const queue = createUploadQueue({ upload: api.upload });
    queue.add(['a.png', 'b.png', 'c.png'].map((name) => png(name)));
    api.find('a.png').reject(apiError(429, 'RATE_LIMITED', 5));
    await vi.advanceTimersByTimeAsync(0);
    expect(statusOf(queue, 'a.png')).toBe('queued');
    expect(queue.getState().pausedUntil).toBe(Date.now() + 5000);
    api.find('b.png').resolve();
    await vi.advanceTimersByTimeAsync(0);
    // Paused: c.png waits although a slot is free.
    expect(api.pending).toHaveLength(0);
    expect(api.started).toEqual(['a.png', 'b.png']);

    await vi.advanceTimersByTimeAsync(5000);
    expect(queue.getState().pausedUntil).toBeNull();
    expect(api.pending.map((entry) => entry.file.name)).toEqual(['a.png', 'c.png']);
    api.find('a.png').resolve();
    api.find('c.png').resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(summarize(queue.getState())).toMatchObject({ done: 3, failed: 0 });
  });

  it('skips a file already in the list and refuses what the API limits reject, sending nothing', () => {
    const api = controllableUploader();
    const queue = createUploadQueue({
      upload: api.upload,
      validate: (file) =>
        fileProblem(file, { allowedMime: ['image/png', 'image/jpeg'], maxUploadSizeMb: 1 }),
    });
    const same = png('same.png');
    const first = queue.add([same, png('huge.png', 2 * 1_048_576)]);
    const text = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    const second = queue.add([same, text]);
    expect(first.duplicates).toHaveLength(0);
    expect(second.duplicates).toEqual([same]);
    expect(api.started).toEqual(['same.png']);
    const huge = queue.getState().items.find((item) => item.file.name === 'huge.png')!;
    expect(huge).toMatchObject({ status: 'failed', retryable: false });
    expect(huge.error?.message).toBe('2.0 MB is over the 1 MB limit.');
    const notes = queue.getState().items.find((item) => item.file.name === 'notes.txt')!;
    expect(notes.error?.message).toBe('Not an accepted type (text/plain). Use PNG, JPEG.');
  });

  it('marks a file the library already had as de-duplicated', async () => {
    const api = controllableUploader();
    const queue = createUploadQueue({ upload: api.upload });
    queue.add([png('again.png')]);
    api.find('again.png').resolve(true);
    await flush();
    expect(queue.getState().items[0]).toMatchObject({ status: 'done', deduplicated: true });
    expect(summarize(queue.getState()).deduplicated).toBe(1);
  });

  it('stops sending when disposed and picks up again when re-activated', async () => {
    const api = controllableUploader();
    const queue = createUploadQueue({ upload: api.upload });
    queue.add(['a.png', 'b.png', 'c.png'].map((name) => png(name)));
    queue.dispose();
    await flush();
    expect(statusOf(queue, 'a.png')).toBe('cancelled');
    expect(statusOf(queue, 'c.png')).toBe('queued');
    expect(api.pending).toHaveLength(0);
    queue.activate();
    expect(api.pending.map((entry) => entry.file.name)).toEqual(['c.png']);
  });

  it('refuses a file its inspection rejects without sending it, and sends the others', async () => {
    const api = controllableUploader();
    const queue = createUploadQueue({
      upload: api.upload,
      inspect: async (file) => (file.name.startsWith('small') ? 'Too small.' : null),
    });
    queue.add([png('small.png'), png('large.png')]);
    await flush();
    expect(api.started).toEqual(['large.png']);
    expect(queue.getState().items[0]).toMatchObject({
      status: 'failed',
      retryable: false,
      error: { title: 'Not uploaded', message: 'Too small.' },
    });
    api.find('large.png').resolve();
    await flush();
    expect(summarize(queue.getState())).toMatchObject({ done: 1, failed: 1 });
  });
});

describe('productImageProblem', () => {
  afterEach(() => vi.unstubAllGlobals());

  const bitmap = (width: number, height: number) =>
    vi.fn(async () => ({ width, height, close: vi.fn() }));

  it('names the measured size when the shortest side is below the API minimum', async () => {
    vi.stubGlobal('createImageBitmap', bitmap(1600, 900));
    expect(await productImageProblem(png('wide.png'), 1024)).toBe(
      '1600 × 900 px is too small for a product image: it needs at least 1024 px on the shortest side.',
    );
    vi.stubGlobal('createImageBitmap', bitmap(1024, 1300));
    expect(await productImageProblem(png('ok.png'), 1024)).toBeNull();
  });

  it('leaves the decision to the API when off, unmeasured or undecodable', async () => {
    const decode = bitmap(10, 10);
    vi.stubGlobal('createImageBitmap', decode);
    expect(await productImageProblem(png('a.png'), 0)).toBeNull();
    expect(
      await productImageProblem(new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }), 1024),
    ).toBeNull();
    expect(decode).not.toHaveBeenCalled();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('undecodable');
      }),
    );
    expect(await productImageProblem(png('broken.png'), 1024)).toBeNull();
  });
});

describe('describeTypes', () => {
  it('names the API allow-list the way people know the formats', () => {
    expect(describeTypes(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])).toBe(
      'JPEG, PNG, WebP, SVG',
    );
  });
});
