import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { SearchInsightsScreen } from '@/features/search/search-screens';

export const metadata: Metadata = { title: 'Search insights' };

export default function SearchInsightsPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <SearchInsightsScreen />
    </Suspense>
  );
}
