import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { CouponsScreen } from '@/features/pricing/coupons-screen';

export const metadata: Metadata = { title: 'Coupons' };

export default function CouponsPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <CouponsScreen />
    </Suspense>
  );
}
