'use client';

import dynamic from 'next/dynamic';

/** The confirmation dialog, loaded only when a screen first asks for it. */
export const LazyConfirmDialog = dynamic(
  () => import('./confirm-dialog').then((m) => m.ConfirmDialog),
  { ssr: false },
);
