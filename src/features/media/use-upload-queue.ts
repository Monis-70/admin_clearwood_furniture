'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import { mediaApi } from './api';
import { createUploadQueue, type UploadQueue, type UploadQueueState } from './upload-queue';

interface Options {
  folderId?: string;
  validate?: (file: File) => string | null;
  inspect?: (file: File) => Promise<string | null>;
}

/** One upload queue for the lifetime of the component; leaving the screen stops it. */
export function useUploadQueue(options: Options = {}): {
  queue: UploadQueue;
  state: UploadQueueState;
} {
  const [queue] = useState(() => createUploadQueue());
  const { folderId, validate, inspect } = options;
  useEffect(() => {
    queue.configure({
      upload: (file, { signal, onProgress }) =>
        mediaApi.uploadOne(file, { folderId, signal, onProgress }),
      validate,
      inspect,
    });
  });
  useEffect(() => {
    queue.activate();
    return () => queue.dispose();
  }, [queue]);
  const state = useSyncExternalStore(queue.subscribe, queue.getState, queue.getState);
  return { queue, state };
}
