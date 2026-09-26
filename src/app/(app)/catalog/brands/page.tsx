import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { BrandsScreen } from '@/features/catalog/brands/brands-screen';

export const metadata: Metadata = { title: 'Brands' };

export default function BrandsPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <BrandsScreen />
    </Suspense>
  );
}
