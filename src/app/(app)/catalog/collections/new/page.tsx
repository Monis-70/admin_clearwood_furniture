import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { CollectionCreateScreen } from '@/features/catalog/collections/collection-create-screen';

export const metadata: Metadata = { title: 'New collection' };

export default function NewCollectionPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <CollectionCreateScreen />
    </Suspense>
  );
}
