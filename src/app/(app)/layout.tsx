import type { ReactNode } from 'react';

import { AppShell } from '@/components/patterns/app-shell/app-shell';
import { AuthGate } from '@/lib/auth/guards';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
