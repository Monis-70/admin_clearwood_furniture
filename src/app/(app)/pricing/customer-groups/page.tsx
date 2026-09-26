import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { CustomerGroupsScreen } from '@/features/pricing/customer-groups-screen';

export const metadata: Metadata = { title: 'Customer groups' };

export default function CustomerGroupsPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <CustomerGroupsScreen />
    </Suspense>
  );
}
