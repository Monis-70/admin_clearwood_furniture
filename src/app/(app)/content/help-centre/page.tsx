import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { HelpCentreScreen } from '@/features/content/help-centre-screen';

export const metadata: Metadata = { title: 'Help centre' };

export default function HelpCentrePage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <HelpCentreScreen />
    </Suspense>
  );
}
