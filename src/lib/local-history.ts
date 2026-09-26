'use client';

import { useCallback } from 'react';

import { useCurrentAdmin } from '@/lib/auth/session';
import { usePreference, writePreference } from '@/lib/preferences';

/**
 * Small, device-local, per-admin histories: recently viewed records and saved list filters.
 * They hold ids, labels and URLs only (no record data), are capped, and are keyed by the signed-in
 * admin's id so a shared computer never shows one admin another admin's trail.
 */

export interface RecentItem {
  /** Stable identity, e.g. `admin-user:cm123`. */
  key: string;
  kind: string;
  label: string;
  href: string;
  at: number;
}

export interface SavedFilter {
  id: string;
  name: string;
  /** URL query string without `page` (e.g. `status=NEW&q=sofa`). */
  query: string;
  at: number;
}

const RECENT_MAX = 12;
const SAVED_MAX = 10;

const isRecentList = (value: unknown): value is RecentItem[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as RecentItem).key === 'string' &&
      typeof (item as RecentItem).href === 'string' &&
      typeof (item as RecentItem).label === 'string',
  );

const isSavedList = (value: unknown): value is SavedFilter[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as SavedFilter).name === 'string' &&
      typeof (item as SavedFilter).query === 'string',
  );

const EMPTY_RECENT: RecentItem[] = [];
const EMPTY_SAVED: SavedFilter[] = [];

/** Only same-origin relative paths are ever stored or followed. */
export function isSafeHref(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//') && !href.includes('\\');
}

export function useRecentItems() {
  const { user } = useCurrentAdmin();
  const key = `recent:${user.id}`;
  const [items, setItems] = usePreference<RecentItem[]>(key, EMPTY_RECENT, isRecentList);

  const record = useCallback(
    (item: Omit<RecentItem, 'at'>) => {
      if (!isSafeHref(item.href)) return;
      const next = [{ ...item, at: Date.now() }, ...items.filter((i) => i.key !== item.key)];
      writePreference(key, next.slice(0, RECENT_MAX));
    },
    [items, key],
  );

  const clear = useCallback(() => setItems(EMPTY_RECENT), [setItems]);
  return { items: items.filter((item) => isSafeHref(item.href)), record, clear };
}

export function useSavedFilters(listId: string) {
  const { user } = useCurrentAdmin();
  const key = `saved-filters:${user.id}:${listId}`;
  const [filters] = usePreference<SavedFilter[]>(key, EMPTY_SAVED, isSavedList);

  const save = useCallback(
    (name: string, query: string) => {
      const trimmed = name.trim().slice(0, 60);
      if (!trimmed) return;
      const rest = filters.filter((filter) => filter.name.toLowerCase() !== trimmed.toLowerCase());
      const entry: SavedFilter = {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name: trimmed,
        query,
        at: Date.now(),
      };
      writePreference(key, [entry, ...rest].slice(0, SAVED_MAX));
    },
    [filters, key],
  );

  const remove = useCallback(
    (id: string) =>
      writePreference(
        key,
        filters.filter((filter) => filter.id !== id),
      ),
    [filters, key],
  );

  return { filters, save, remove, max: SAVED_MAX };
}
