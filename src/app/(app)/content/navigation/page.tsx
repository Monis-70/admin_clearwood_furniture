import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { NavigationScreen } from '@/features/content/navigation-screen';

export const metadata: Metadata = { title: 'Navigation menus' };

export default function NavigationPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <NavigationScreen />
    </Suspense>
  );
}
