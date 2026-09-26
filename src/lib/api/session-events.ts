import type { AdminMeDto } from '@shared/types/auth';

/** Why a session ended; drives the sign-in page message. */
export type SessionEndReason =
  'expired' | 'reuse' | 'disabled' | 'locked' | 'signed-out' | 'signed-out-elsewhere';

export type SessionEvent =
  | { type: 'renewed'; me: AdminMeDto; at: number }
  | { type: 'ended'; reason: SessionEndReason }
  | { type: 'password-change-required' }
  | { type: 'forbidden' };

type Listener = (event: SessionEvent) => void;

const listeners = new Set<Listener>();

/** Framework-free bridge from the API layer to the session provider. */
export function onSessionEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitSessionEvent(event: SessionEvent): void {
  for (const listener of [...listeners]) listener(event);
}
