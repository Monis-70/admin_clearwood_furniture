import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { CategoriesScreen } from '@/features/catalog/categories/categories-screen';

export const metadata: Metadata = { title: 'Categories' };

export default function CategoriesPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <CategoriesScreen />
    </Suspense>
  );
}
