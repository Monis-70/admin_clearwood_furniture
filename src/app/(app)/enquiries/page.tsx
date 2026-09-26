import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { EnquiriesScreen } from '@/features/enquiries/enquiries-screen';

export const metadata: Metadata = { title: 'Enquiries' };

export default function EnquiriesPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <EnquiriesScreen />
    </Suspense>
  );
}
