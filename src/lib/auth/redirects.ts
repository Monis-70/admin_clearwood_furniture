const LOGIN = '/login';
const CHANGE_PASSWORD = '/change-password';
const AUTH_PAGES = new Set([LOGIN, CHANGE_PASSWORD]);
const PROBE_ORIGIN = 'https://admin.invalid';

/**
 * Accepts only a same-origin, relative path for post-sign-in redirects. Anything absolute,
 * protocol-relative, backslashed or pointing back at an auth page becomes `/`.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '/';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  if (/[\u0000-\u001f\u007f]/.test(raw)) return '/';
  let url: URL;
  try {
    url = new URL(raw, PROBE_ORIGIN);
  } catch {
    return '/';
  }
  if (url.origin !== PROBE_ORIGIN) return '/';
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (AUTH_PAGES.has(path)) return '/';
  return `${url.pathname}${url.search}`;
}

export function currentLocation(): string {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}`;
}

export function loginHref(options: { next?: string; reason?: string | null } = {}): string {
  const params = new URLSearchParams();
  const next = safeNextPath(options.next);
  if (next !== '/') params.set('next', next);
  if (options.reason) params.set('reason', options.reason);
  const query = params.toString();
  return query ? `${LOGIN}?${query}` : LOGIN;
}

export function changePasswordHref(next?: string): string {
  const safe = safeNextPath(next);
  return safe === '/' ? CHANGE_PASSWORD : `${CHANGE_PASSWORD}?next=${encodeURIComponent(safe)}`;
}
