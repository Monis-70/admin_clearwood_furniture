import type { AdminMeDto } from '@shared/types/auth';

import type { SessionEndReason } from '@/lib/api/session-events';

/** Messages broadcast between tabs of this origin. Never carries tokens. */
export type SessionMessage =
  | { type: 'signed-in'; me: AdminMeDto }
  | { type: 'renewed'; me: AdminMeDto; at: number }
  | { type: 'signed-out'; reason: SessionEndReason };

const CHANNEL = 'cw-admin-session';

export interface SessionChannel {
  post(message: SessionMessage): void;
  close(): void;
}

export function openSessionChannel(onMessage: (message: SessionMessage) => void): SessionChannel {
  if (typeof BroadcastChannel === 'undefined') {
    return { post: () => undefined, close: () => undefined };
  }
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<SessionMessage>) => {
    const data = event.data;
    if (data && typeof data === 'object' && typeof data.type === 'string') onMessage(data);
  };
  return {
    post: (message) => channel.postMessage(message),
    close: () => channel.close(),
  };
}
