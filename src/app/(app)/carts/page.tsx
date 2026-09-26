import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { CartsScreen } from '@/features/carts/carts-screen';

export const metadata: Metadata = { title: 'Carts & wishlists' };

export default function CartsPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <CartsScreen />
    </Suspense>
  );
}
