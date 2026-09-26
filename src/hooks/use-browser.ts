'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

/** A value that only settles after `delayMs` without changes (search boxes). */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function subscribeOnline(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', callback);
      return () => list.removeEventListener('change', callback);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * True once the element has been near the viewport. Dashboard widgets use it so their requests
 * are only made for what the operator actually scrolls to.
 */
export function useInView<T extends Element>(
  rootMargin = '200px',
): [(node: T | null) => void, boolean] {
  const [node, setNode] = useState<T | null>(null);
  const [seen, setSeen] = useState(false);
  const supported = typeof IntersectionObserver !== 'undefined';
  useEffect(() => {
    if (!node || seen || !supported) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setSeen(true);
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, seen, supported, rootMargin]);
  return [setNode, seen || !supported];
}
