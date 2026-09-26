'use client';

import { WifiOff } from 'lucide-react';

import { useOnlineStatus } from '@/hooks/use-browser';

/** Shown while the browser is offline; queries pause and forms keep their values. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-warning-bg px-4 py-2 text-sm text-warning"
    >
      <WifiOff aria-hidden className="size-4" />
      <span>You are offline. Changes cannot be saved until the connection is back.</span>
    </div>
  );
}
