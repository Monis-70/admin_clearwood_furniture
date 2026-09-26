import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { OrdersScreen } from '@/features/orders/orders-screen';

export const metadata: Metadata = { title: 'Orders' };

export default function OrdersPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <OrdersScreen />
    </Suspense>
  );
}
