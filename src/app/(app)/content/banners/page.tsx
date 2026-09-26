import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { BannersScreen } from '@/features/content/banners-screen';

export const metadata: Metadata = { title: 'Banners' };

export default function BannersPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <BannersScreen />
    </Suspense>
  );
}
