import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { PriceListsScreen } from '@/features/pricing/price-lists-screen';

export const metadata: Metadata = { title: 'Price lists & tiers' };

export default function PriceListsPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <PriceListsScreen />
    </Suspense>
  );
}
