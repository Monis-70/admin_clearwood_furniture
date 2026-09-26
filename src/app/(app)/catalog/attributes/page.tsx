import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { AttributesScreen } from '@/features/catalog/attributes/attributes-screen';

export const metadata: Metadata = { title: 'Attributes' };

export default function AttributesPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <AttributesScreen />
    </Suspense>
  );
}
