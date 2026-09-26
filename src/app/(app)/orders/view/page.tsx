import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { OrderViewScreen } from '@/features/orders/order-view-screen';

export const metadata: Metadata = { title: 'Order' };

export default function OrderViewPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <OrderViewScreen />
    </Suspense>
  );
}
