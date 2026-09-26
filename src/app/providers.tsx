'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useState, type ReactNode } from 'react';

import { SessionProvider } from '@/lib/auth/session';
import { createQueryClient } from '@/lib/query/query-client';

/** Toasts only matter after an action, so their code loads after the page is interactive. */
const Toaster = dynamic(() => import('@/components/ui/sonner').then((module) => module.Toaster), {
  ssr: false,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        {children}
        <Toaster />
      </SessionProvider>
    </QueryClientProvider>
  );
}
