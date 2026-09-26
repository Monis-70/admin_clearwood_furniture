import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { AuditLogScreen } from '@/features/audit/audit-log-screen';

export const metadata: Metadata = { title: 'Audit log' };

export default function AuditLogPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <AuditLogScreen />
    </Suspense>
  );
}
