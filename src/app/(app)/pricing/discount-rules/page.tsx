import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { DiscountRulesScreen } from '@/features/pricing/discount-rules-screen';

export const metadata: Metadata = { title: 'Automatic discounts' };

export default function DiscountRulesPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <DiscountRulesScreen />
    </Suspense>
  );
}
