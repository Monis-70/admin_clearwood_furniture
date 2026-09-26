import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { ReportsScreen } from '@/features/orders/reports-screen';

export const metadata: Metadata = { title: 'Reports' };

export default function ReportsPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <ReportsScreen />
    </Suspense>
  );
}
