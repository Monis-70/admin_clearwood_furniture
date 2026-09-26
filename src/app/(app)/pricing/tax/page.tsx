import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { TaxScreen } from '@/features/pricing/tax-screen';

export const metadata: Metadata = { title: 'Tax & GST' };

export default function TaxPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <TaxScreen />
    </Suspense>
  );
}
