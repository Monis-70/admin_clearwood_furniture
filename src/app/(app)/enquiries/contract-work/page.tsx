import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { EnquiriesScreen } from '@/features/enquiries/enquiries-screen';

export const metadata: Metadata = { title: 'Contract work' };

export default function ContractWorkPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <EnquiriesScreen formKey="contract-work" />
    </Suspense>
  );
}
