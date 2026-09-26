'use client';

import { useCallback, useRef } from 'react';

/**
 * One Idempotency-Key per logical attempt: retrying the same payload (a double click, a timeout)
 * reuses the key, so the API applies it once; a changed payload gets a fresh key, because the API
 * refuses a reused key with a different body (409 IDEMPOTENCY_KEY_REUSED).
 */
export function useIdempotencyKey(): (payload: unknown) => string {
  const last = useRef<{ signature: string; key: string } | null>(null);
  return useCallback((payload: unknown) => {
    const signature = JSON.stringify(payload ?? null);
    if (last.current?.signature !== signature) {
      last.current = { signature, key: crypto.randomUUID() };
    }
    return last.current.key;
  }, []);
}
