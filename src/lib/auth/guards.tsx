'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { ApiUnavailable, FullPageLoader } from '@/components/patterns/states';

import { changePasswordHref, currentLocation, loginHref, safeNextPath } from './redirects';
import { useSession } from './session';

/** Everything inside the app shell: signed in, password settled. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { state, retryBootstrap } = useSession();
  const router = useRouter();
  const anonymousReason = state.status === 'anonymous' ? state.reason : undefined;
  const mustChange = state.status === 'authenticated' && state.me.mustChangePassword;

  useEffect(() => {
    if (anonymousReason !== undefined) {
      // After a deliberate sign-out the next person should land on the dashboard, not our page.
      const keepPlace =
        anonymousReason !== 'signed-out' && anonymousReason !== 'signed-out-elsewhere';
      router.replace(
        loginHref({ next: keepPlace ? currentLocation() : undefined, reason: anonymousReason }),
      );
    } else if (mustChange) {
      router.replace(changePasswordHref(currentLocation()));
    }
  }, [anonymousReason, mustChange, router]);

  if (state.status === 'unavailable')
    return <ApiUnavailable error={state.error} onRetry={retryBootstrap} />;
  if (state.status !== 'authenticated' || mustChange)
    return <FullPageLoader label="Checking your session…" />;
  return <>{children}</>;
}

/** The sign-in page: an admin who is already signed in goes straight on. */
export function GuestGate({ children }: { children: ReactNode }) {
  const { state } = useSession();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const signedIn = state.status === 'authenticated';
  const mustChange = signedIn && state.me.mustChangePassword;

  useEffect(() => {
    if (!signedIn) return;
    router.replace(mustChange ? changePasswordHref(next ?? undefined) : safeNextPath(next));
  }, [signedIn, mustChange, next, router]);

  if (state.status === 'loading') return <FullPageLoader label="Checking your session…" />;
  if (signedIn) return <FullPageLoader label="Opening the admin…" />;
  return <>{children}</>;
}

/** The forced password change: only reachable with a session that must change its password. */
export function PasswordChangeGate({ children }: { children: ReactNode }) {
  const { state, retryBootstrap } = useSession();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const anonymous = state.status === 'anonymous';
  const settled = state.status === 'authenticated' && !state.me.mustChangePassword;

  useEffect(() => {
    if (anonymous) router.replace(loginHref());
    else if (settled) router.replace(safeNextPath(next));
  }, [anonymous, settled, next, router]);

  if (state.status === 'unavailable')
    return <ApiUnavailable error={state.error} onRetry={retryBootstrap} />;
  if (state.status !== 'authenticated' || settled)
    return <FullPageLoader label="Checking your session…" />;
  return <>{children}</>;
}
