import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { CollectionEditorScreen } from '@/features/catalog/collections/collection-editor-screen';

export const metadata: Metadata = { title: 'Collection' };

export default function EditCollectionPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <CollectionEditorScreen />
    </Suspense>
  );
}
