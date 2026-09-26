import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { CollectionsScreen } from '@/features/catalog/collections/collections-screen';

export const metadata: Metadata = { title: 'Collections' };

export default function CollectionsPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <CollectionsScreen />
    </Suspense>
  );
}
