import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { ProductEditorScreen } from '@/features/catalog/products/product-editor-screen';

export const metadata: Metadata = { title: 'Edit product' };

export default function ProductEditPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <ProductEditorScreen />
    </Suspense>
  );
}
