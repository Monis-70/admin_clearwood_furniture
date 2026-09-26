import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { SearchIndexScreen } from '@/features/search/search-screens';

export const metadata: Metadata = { title: 'Index maintenance' };

export default function SearchIndexPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <SearchIndexScreen />
    </Suspense>
  );
}
