import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { SynonymsScreen } from '@/features/search/search-screens';

export const metadata: Metadata = { title: 'Synonyms' };

export default function SynonymsPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <SynonymsScreen />
    </Suspense>
  );
}
