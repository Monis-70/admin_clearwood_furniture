'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import type { Permission } from '@shared/enums';
import type { AdminLoginInput, ChangePasswordInput } from '@shared/schemas/auth';
import type { AdminMeDto } from '@shared/types/auth';

import { isApiError, type ApiError } from '@/lib/api/errors';
import { onSessionEvent, type SessionEndReason } from '@/lib/api/session-events';
import { noteRenewedElsewhere } from '@/lib/api/session-renewal';
import { hasSessionHint } from '@/lib/api/transport';
import { notifyInfo } from '@/lib/notify';
import { NO_PERMISSIONS, type PermissionSet } from '@/lib/permissions/requirements';

import { authApi } from './auth-api';
import { openSessionChannel, type SessionChannel } from './session-channel';

export type SessionState =
  | { status: 'loading' }
  /** The API could not be reached to find out; not the same as signed out. */
  | { status: 'unavailable'; error: ApiError | Error }
  | { status: 'anonymous'; reason: SessionEndReason | null }
  | { status: 'authenticated'; me: AdminMeDto; permissions: PermissionSet };

export interface SessionContextValue {
  state: SessionState;
  permissions: PermissionSet;
  signIn(input: AdminLoginInput): Promise<AdminMeDto>;
  /** Throws when the API could not be told, so the operator is never falsely told they left. */
  signOut(): Promise<void>;
  changePassword(input: ChangePasswordInput): Promise<AdminMeDto>;
  /** Re-reads `/auth/me` (after an unexpected 403, or on demand). */
  revalidate(): Promise<void>;
  retryBootstrap(): void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const FORBIDDEN_REVALIDATE_MS = 60_000;
const LOADING: SessionState = { status: 'loading' };
const SIGNED_OUT: SessionState = { status: 'anonymous', reason: null };
const noSubscription = () => () => undefined;

function authenticated(me: AdminMeDto): SessionState {
  return { status: 'authenticated', me, permissions: new Set<Permission>(me.permissions) };
}

function samePermissions(before: readonly string[], after: readonly string[]): boolean {
  if (before.length !== after.length) return false;
  const set = new Set(before);
  return after.every((code) => set.has(code));
}

function reasonOf(error: unknown): SessionEndReason | null {
  if (!isApiError(error)) return null;
  if (error.code === 'SESSION_ENDED') {
    const reason = (error.details as { reason?: SessionEndReason } | null)?.reason;
    // A missing session at start-up is simply "not signed in", not an expiry to explain.
    return reason && reason !== 'expired' ? reason : null;
  }
  return null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // Until the API has answered (or been skipped), the state is derived from the cookie hint.
  const [known, setState] = useState<SessionState | null>(null);
  const hint = useSyncExternalStore(noSubscription, hasSessionHint, () => null);
  const state: SessionState = known ?? (hint === false ? SIGNED_OUT : LOADING);
  const [attempt, setAttempt] = useState(0);
  const channel = useRef<SessionChannel | null>(null);
  const lastForbiddenCheck = useRef(0);
  const current = useRef<SessionState>(state);
  useEffect(() => {
    current.current = state;
  }, [state]);

  /** A renewal carrying different permissions means a Super Admin changed this admin's roles. */
  const applyRenewal = useCallback(
    (me: AdminMeDto) => {
      const before = current.current;
      if (
        before.status === 'authenticated' &&
        !samePermissions(before.me.permissions, me.permissions)
      ) {
        notifyInfo(
          'Your access changed',
          'An administrator updated your roles. Menus and actions now match your new access.',
          'access-changed',
        );
        void queryClient.invalidateQueries();
      }
      setState(authenticated(me));
    },
    [queryClient],
  );

  const end = useCallback(
    (reason: SessionEndReason, broadcast: boolean) => {
      queryClient.clear();
      setState({ status: 'anonymous', reason });
      if (broadcast) channel.current?.post({ type: 'signed-out', reason });
    },
    [queryClient],
  );

  // Bootstrap: no CSRF cookie means no session, so the API is not asked at all.
  const needsBootstrap = known === null && hint === true;
  useEffect(() => {
    if (!needsBootstrap) return;
    const controller = new AbortController();
    authApi
      .me(controller.signal)
      .then((me) => setState(authenticated(me)))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (isApiError(error) && (error.status === 401 || error.code === 'SESSION_ENDED')) {
          setState({ status: 'anonymous', reason: reasonOf(error) });
        } else {
          setState({
            status: 'unavailable',
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });
    return () => controller.abort();
  }, [needsBootstrap, attempt]);

  // Cross-tab: sign-in, renewal and sign-out in one tab apply to every tab.
  useEffect(() => {
    channel.current = openSessionChannel((message) => {
      if (message.type === 'signed-in') {
        setState(authenticated(message.me));
      } else if (message.type === 'renewed') {
        noteRenewedElsewhere(message.at);
        if (current.current.status === 'authenticated') applyRenewal(message.me);
      } else if (message.type === 'signed-out') {
        end('signed-out-elsewhere', false);
      }
    });
    return () => channel.current?.close();
  }, [end, applyRenewal]);

  const revalidate = useCallback(async () => {
    try {
      const me = await authApi.me();
      applyRenewal(me);
    } catch {
      // A failed revalidation leaves the current state; renewal/ended events handle real expiry.
    }
  }, [applyRenewal]);

  // Events raised by the API client.
  useEffect(
    () =>
      onSessionEvent((event) => {
        if (event.type === 'renewed') {
          applyRenewal(event.me);
          channel.current?.post({ type: 'renewed', me: event.me, at: event.at });
        } else if (event.type === 'ended') {
          end(event.reason, true);
        } else if (event.type === 'password-change-required') {
          setState((current) =>
            current?.status === 'authenticated' && !current.me.mustChangePassword
              ? authenticated({ ...current.me, mustChangePassword: true })
              : current,
          );
        } else if (event.type === 'forbidden') {
          const now = Date.now();
          if (now - lastForbiddenCheck.current > FORBIDDEN_REVALIDATE_MS) {
            lastForbiddenCheck.current = now;
            void revalidate();
          }
        }
      }),
    [end, revalidate, applyRenewal],
  );

  const signIn = useCallback(
    async (input: AdminLoginInput) => {
      const me = await authApi.login(input);
      queryClient.clear();
      setState(authenticated(me));
      channel.current?.post({ type: 'signed-in', me });
      return me;
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // 401: the server session is already gone, which is the outcome we wanted.
      if (!(isApiError(error) && error.status === 401)) throw error;
    }
    end('signed-out', true);
  }, [end]);

  const changePassword = useCallback(async (input: ChangePasswordInput) => {
    await authApi.changePassword(input);
    const me = await authApi.me();
    setState(authenticated(me));
    channel.current?.post({ type: 'renewed', me, at: Date.now() });
    return me;
  }, []);

  const retryBootstrap = useCallback(() => {
    setState(null);
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      permissions: state.status === 'authenticated' ? state.permissions : NO_PERMISSIONS,
      signIn,
      signOut,
      changePassword,
      revalidate,
      retryBootstrap,
    }),
    [state, signIn, signOut, changePassword, revalidate, retryBootstrap],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

/** The signed-in admin; only call below an <AuthGate>. */
export function useCurrentAdmin(): AdminMeDto {
  const { state } = useSession();
  if (state.status !== 'authenticated') throw new Error('useCurrentAdmin used without a session');
  return state.me;
}
