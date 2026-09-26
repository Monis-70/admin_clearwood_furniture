import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { MerchandisingScreen } from '@/features/catalog/merchandising/merchandising-screen';

export const metadata: Metadata = { title: 'Merchandising' };

export default function MerchandisingPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <MerchandisingScreen />
    </Suspense>
  );
}
