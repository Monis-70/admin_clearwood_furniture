'use client';

import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { accountApi, accountKeys } from '@/features/account/api';
import { renewSession } from '@/lib/api/session-renewal';
import { onSessionEvent } from '@/lib/api/session-events';
import { formatDateTime } from '@/lib/format/datetime';
import { notifyError } from '@/lib/notify';
import { cachePolicy } from '@/lib/query/policies';

const WARN_BEFORE_MS = 5 * 60_000;
/** Learn the session lifetime once the page has settled, never during start-up. */
const LEARN_AFTER_MS = 20_000;

/**
 * Warns shortly before the sign-in session ends. Every renewal extends it by the lifetime the API
 * reports for the current session, so this needs one small request per page load, made after the
 * page has settled, and one re-check just before warning (another tab may have renewed it).
 */
export function SessionExpiryNotice() {
  const [ready, setReady] = useState(false);
  const [renewedAt, setRenewedAt] = useState<number | null>(null);
  const [warn, setWarn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), LEARN_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(
    () =>
      onSessionEvent((event) => {
        if (event.type === 'renewed') {
          setRenewedAt(event.at);
          setWarn(false);
        }
      }),
    [],
  );

  const sessions = useQuery({
    queryKey: accountKeys.sessions(),
    queryFn: ({ signal }) => accountApi.sessions(signal),
    enabled: ready,
    ...cachePolicy.config,
  });
  const current = sessions.data?.find((session) => session.isCurrent);
  const lifetime = current ? Date.parse(current.expiresAt) - Date.parse(current.createdAt) : null;
  const expiresAt =
    current && lifetime
      ? Math.max(Date.parse(current.expiresAt), renewedAt ? renewedAt + lifetime : 0)
      : null;

  const refetch = sessions.refetch;
  useEffect(() => {
    if (!expiresAt) return;
    const delay = expiresAt - WARN_BEFORE_MS - Date.now();
    // Timers longer than ~24 days overflow; a session that far away needs no timer yet.
    if (delay > 2 ** 31 - 1) return;
    const timer = setTimeout(
      () => {
        void refetch().then((result) => {
          const fresh = result.data?.find((session) => session.isCurrent);
          if (fresh && Date.parse(fresh.expiresAt) - Date.now() <= WARN_BEFORE_MS) setWarn(true);
        });
      },
      Math.max(delay, 0),
    );
    return () => clearTimeout(timer);
  }, [expiresAt, refetch]);

  if (!warn || !expiresAt) return null;

  const stay = async () => {
    setBusy(true);
    try {
      await renewSession();
    } catch (error) {
      notifyError(error, 'Could not keep you signed in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-3 border-b border-warning/30 bg-warning-bg px-4 py-2 text-sm text-warning sm:px-6 lg:px-8"
    >
      <Clock aria-hidden className="size-4 shrink-0" />
      <span className="flex-1">
        Your session ends at {formatDateTime(expiresAt)}. Stay signed in to keep working without
        losing unsaved changes.
      </span>
      <Button size="sm" variant="outline" onClick={() => void stay()} loading={busy}>
        Stay signed in
      </Button>
    </div>
  );
}
