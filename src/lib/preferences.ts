/* eslint-disable no-restricted-properties -- the one place UI preferences touch localStorage */
'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Device-local UI preferences (sidebar collapsed, table columns, density). Never auth data,
 * permissions or business records (docs/ADMIN_STATE_AND_ERROR_MODEL.md §1).
 */
const PREFIX = 'cw-admin:pref:';
const listeners = new Set<() => void>();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or disabled (private mode): the preference simply is not remembered.
  }
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith(PREFIX)) callback();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', onStorage);
  };
}

function parse<T>(raw: string | null, fallback: T, validate: (value: unknown) => value is T): T {
  if (raw === null) return fallback;
  try {
    const value: unknown = JSON.parse(raw);
    return validate(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

/**
 * A remembered preference. The static HTML renders the fallback; the stored value applies right
 * after hydration, so server and client markup never disagree.
 */
export function usePreference<T>(
  key: string,
  fallback: T,
  validate: (value: unknown) => value is T,
): [T, (value: T) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const value = parse(raw, fallback, validate);
  const set = useCallback((next: T) => writePreference(key, next), [key]);
  return [value, set];
}

export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
