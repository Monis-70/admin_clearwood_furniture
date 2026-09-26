import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { DeliveryScreen } from '@/features/pricing/delivery-screen';

export const metadata: Metadata = { title: 'Delivery charges' };

export default function DeliveryPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <DeliveryScreen />
    </Suspense>
  );
}
