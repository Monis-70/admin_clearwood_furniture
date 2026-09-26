import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { PagesScreen } from '@/features/content/content-screens';

export const metadata: Metadata = { title: 'Pages' };

export default function ContentPagesPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <PagesScreen />
    </Suspense>
  );
}
