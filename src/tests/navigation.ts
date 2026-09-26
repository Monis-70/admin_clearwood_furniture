import { useSyncExternalStore } from 'react';
import { vi } from 'vitest';

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const notify = () => {
  for (const listener of [...listeners]) listener();
};

/**
 * A controllable stand-in for next/navigation (the App Router context does not exist in jsdom).
 * `replace`/`push` update the URL and re-render subscribers, as the real router does.
 */
export const navigation = {
  pathname: '/',
  search: '',
  replace: vi.fn<(href: string, options?: unknown) => void>(),
  push: vi.fn<(href: string, options?: unknown) => void>(),
  go(href: string) {
    const url = new URL(href, 'http://admin.test');
    this.pathname = url.pathname;
    this.search = url.search.replace(/^\?/, '');
    notify();
  },
  reset(pathname = '/', search = '') {
    this.pathname = pathname;
    this.search = search;
    window.history.replaceState(null, '', `${pathname}${search ? `?${search}` : ''}`);
    this.replace.mockReset();
    this.push.mockReset();
    this.replace.mockImplementation((href: string) => this.go(href));
    this.push.mockImplementation((href: string) => this.go(href));
  },
};

export const nextNavigationMock = {
  useRouter: () => ({
    replace: navigation.replace,
    push: navigation.push,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () =>
    useSyncExternalStore(
      subscribe,
      () => navigation.pathname,
      () => navigation.pathname,
    ),
  useSearchParams: () => {
    const search = useSyncExternalStore(
      subscribe,
      () => navigation.search,
      () => navigation.search,
    );
    return new URLSearchParams(search);
  },
};
