import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { SystemStatusScreen } from '@/features/system/system-status-screen';

export const metadata: Metadata = { title: 'Status & integrations' };

export default function SystemStatusPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <SystemStatusScreen />
    </Suspense>
  );
}
