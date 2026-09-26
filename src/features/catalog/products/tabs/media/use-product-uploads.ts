'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { describeError } from '@/lib/api/error-messages';
import { isApiError } from '@/lib/api/errors';

import { mediaApi } from '@/features/media/api';
import type { UploadItem } from '@/features/media/upload-queue';
import { useUploadQueue } from '@/features/media/use-upload-queue';

export type AttachState =
  | { kind: 'attaching' }
  | { kind: 'attached' }
  | { kind: 'already' }
  | { kind: 'failed'; message: string };

/**
 * Uploads for one product: every finished file is attached to the product in the order the files
 * were chosen (a file still uploading holds back the ones after it; a failed or cancelled file is
 * skipped). Attaching is one request per image, in sequence, so the API assigns positions in that
 * order and a refusal affects only its own image. The first image becomes Primary when the
 * product has none. A file the library already had is not attached until the admin says so.
 */
export function useProductUploads({
  productId,
  hasPrimary,
  validate,
  onAttached,
}: {
  productId: string;
  hasPrimary: boolean;
  validate: (file: File) => string | null;
  onAttached(): void;
}) {
  const { queue, state } = useUploadQueue({ validate });
  const [attach, setAttach] = useState<Readonly<Record<string, AttachState>>>({});
  const claimed = useRef(new Set<string>());
  const chain = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const primarySent = useRef(false);
  const latest = useRef({ hasPrimary, onAttached });
  useEffect(() => {
    latest.current = { hasPrimary, onAttached };
    // Once the API shows a primary, later images are gallery images; if the admin removes the
    // primary afterwards, the next upload may become primary again.
    if (hasPrimary) primarySent.current = false;
  });

  const attachOne = useCallback(
    (uploadId: string, mediaId: string) => {
      claimed.current.add(uploadId);
      pending.current += 1;
      setAttach((current) => ({ ...current, [uploadId]: { kind: 'attaching' } }));
      chain.current = chain.current.then(async () => {
        const primary = !latest.current.hasPrimary && !primarySent.current;
        if (primary) primarySent.current = true;
        let result: AttachState;
        try {
          await mediaApi.attach(productId, [{ mediaId, role: primary ? 'PRIMARY' : 'GALLERY' }]);
          result = { kind: 'attached' };
        } catch (error) {
          if (primary) primarySent.current = false;
          result =
            isApiError(error) && error.status === 409
              ? { kind: 'already' }
              : { kind: 'failed', message: describeError(error).message };
        }
        pending.current -= 1;
        setAttach((current) => ({ ...current, [uploadId]: result }));
        if (pending.current === 0) latest.current.onAttached();
      });
    },
    [productId],
  );

  useEffect(() => {
    const advance = () => {
      for (const item of queue.getState().items) {
        if (claimed.current.has(item.id)) continue;
        if (item.status === 'done') {
          if (!item.deduplicated && item.asset) attachOne(item.id, item.asset.id);
          continue;
        }
        if (item.status === 'failed' || item.status === 'cancelled') continue;
        break;
      }
    };
    return queue.subscribe(advance);
  }, [queue, attachOne]);

  const attachExisting = (item: UploadItem) => {
    if (item.asset) attachOne(item.id, item.asset.id);
  };

  const retryAttach = (item: UploadItem) => {
    claimed.current.delete(item.id);
    if (item.asset) attachOne(item.id, item.asset.id);
  };

  const attaching = Object.values(attach).some((entry) => entry.kind === 'attaching');
  const uploading = state.items.some(
    (item) =>
      item.status === 'queued' || item.status === 'uploading' || item.status === 'processing',
  );

  return { queue, state, attach, attachExisting, retryAttach, busy: uploading || attaching };
}
