import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { ShipmentsScreen } from '@/features/orders/shipments-screen';

export const metadata: Metadata = { title: 'Shipments' };

export default function ShipmentsPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <ShipmentsScreen />
    </Suspense>
  );
}
