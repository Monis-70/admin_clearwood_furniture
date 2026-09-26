import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { PriceRulesScreen } from '@/features/pricing/price-rules-screen';

export const metadata: Metadata = { title: 'Price rules' };

export default function PriceRulesPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <PriceRulesScreen />
    </Suspense>
  );
}
