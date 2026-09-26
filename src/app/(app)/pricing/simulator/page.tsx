import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { SimulatorScreen } from '@/features/pricing/simulator-screen';

export const metadata: Metadata = { title: 'Price simulator' };

export default function SimulatorPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <SimulatorScreen />
    </Suspense>
  );
}
