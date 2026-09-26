import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { RolesScreen } from '@/features/roles/roles-screen';

export const metadata: Metadata = { title: 'Roles & permissions' };

export default function RolesPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <RolesScreen />
    </Suspense>
  );
}
