import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { ProductsScreen } from '@/features/catalog/products/products-screen';

export const metadata: Metadata = { title: 'Products' };

export default function ProductsPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <ProductsScreen />
    </Suspense>
  );
}
