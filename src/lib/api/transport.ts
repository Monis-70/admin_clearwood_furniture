/** Names fixed by the backend (`realm.config.ts`, `csrf.service.ts`, `app.ts`). */
export const CSRF_COOKIE = 'cw_adm_csrf';
export const CSRF_HEADER = 'X-CSRF-Token';
export const REQUEST_ID_HEADER = 'X-Request-Id';
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

export const DEFAULT_TIMEOUT_MS = 15_000;
/** Imports, commits, uploads and exports: just under the 180 s nginx proxy_read_timeout. */
export const LONG_TIMEOUT_MS = 170_000;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  for (const pair of document.cookie.split(';')) {
    const trimmed = pair.trim();
    if (trimmed.startsWith(`${name}=`)) {
      const value = trimmed.slice(name.length + 1);
      try {
        return decodeURIComponent(value) || null;
      } catch {
        return value || null;
      }
    }
  }
  return null;
}

/** The readable double-submit token; the access and refresh cookies stay httpOnly. */
export function readCsrfToken(): string | null {
  return readCookie(CSRF_COOKIE);
}

/**
 * The CSRF cookie is issued with every session and cleared on sign-out, so its absence means
 * there is no session to restore: the app skips `/auth/me` and the refresh round trip entirely.
 */
export function hasSessionHint(): boolean {
  return readCsrfToken() !== null;
}

/** Matches the backend's accepted `X-Request-Id` shape (`^[A-Za-z0-9_-]{8,64}$`). */
export function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function newIdempotencyKey(): string {
  return newRequestId();
}
