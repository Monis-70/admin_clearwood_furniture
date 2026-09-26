import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { HomeScreen } from '@/features/dashboard/home-screen';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <HomeScreen />
    </Suspense>
  );
}
