import type { AdminMeDto } from '@shared/types/auth';

import { ApiError, isApiError } from './errors';
import { emitSessionEvent, type SessionEndReason } from './session-events';

/**
 * Silent session renewal.
 *
 * The refresh token rotates on every use and presenting a used one revokes the whole family
 * (401 TOKEN_REUSE). So renewals must never overlap: requests inside one tab share one in-flight
 * renewal, and tabs take turns through a Web Lock. Cookies are shared by all tabs, so a tab that
 * waited for the lock either sees another tab's broadcast and skips, or refreshes with the
 * already-rotated cookie, which is a normal rotation rather than a reuse.
 */

const LOCK_NAME = 'cw-adm-session-renewal';

type Refresher = () => Promise<AdminMeDto>;

let refresher: Refresher | null = null;
let inflight: Promise<void> | null = null;
let lastRenewedAt = 0;

export function registerRefresher(fn: Refresher): void {
  refresher = fn;
}

/** Another tab renewed the session at `at` (from the cross-tab channel). */
export function noteRenewedElsewhere(at: number): void {
  lastRenewedAt = Math.max(lastRenewedAt, at);
}

function endReason(code: string): SessionEndReason {
  if (code === 'TOKEN_REUSE') return 'reuse';
  if (code === 'ACCOUNT_DISABLED') return 'disabled';
  if (code === 'ACCOUNT_LOCKED') return 'locked';
  return 'expired';
}

async function exclusive(task: (waited: boolean) => Promise<void>): Promise<void> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks) return task(false);
  const done = await locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
    if (!lock) return false;
    await task(false);
    return true;
  });
  if (!done) await locks.request(LOCK_NAME, () => task(true));
}

export function renewSession(): Promise<void> {
  if (inflight) return inflight;
  const requestedAt = Date.now();

  inflight = exclusive(async (waited) => {
    if (waited && lastRenewedAt >= requestedAt) return;
    if (!refresher) throw new Error('Session renewal used before the API client registered it');
    try {
      const me = await refresher();
      lastRenewedAt = Date.now();
      emitSessionEvent({ type: 'renewed', me, at: lastRenewedAt });
    } catch (error) {
      // Only an authoritative "no" from the API ends the session; a network blip or 429 does not.
      if (isApiError(error) && (error.status === 401 || error.status === 403)) {
        const reason = endReason(error.code);
        emitSessionEvent({ type: 'ended', reason });
        throw new ApiError({
          status: 401,
          code: 'SESSION_ENDED',
          message: 'Your session has ended. Please sign in again.',
          details: { reason, cause: error.code },
          traceId: error.traceId,
          requestId: error.requestId,
          method: error.method,
          path: error.path,
        });
      }
      throw error;
    }
  }).finally(() => {
    inflight = null;
  });

  return inflight;
}

/** Test seam: forget in-flight state between tests. */
export function resetSessionRenewalForTests(): void {
  inflight = null;
  lastRenewedAt = 0;
}
