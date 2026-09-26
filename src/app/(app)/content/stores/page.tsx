import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { StoresScreen } from '@/features/content/people-and-places-screens';

export const metadata: Metadata = { title: 'Stores' };

export default function StoresPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <StoresScreen />
    </Suspense>
  );
}
