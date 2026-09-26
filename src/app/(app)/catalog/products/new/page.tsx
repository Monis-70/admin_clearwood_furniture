import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { ProductCreateScreen } from '@/features/catalog/products/product-create-screen';

export const metadata: Metadata = { title: 'New product' };

export default function ProductNewPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <ProductCreateScreen />
    </Suspense>
  );
}
