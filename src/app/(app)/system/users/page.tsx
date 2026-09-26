import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { AdminUsersScreen } from '@/features/admin-users/admin-users-screen';

export const metadata: Metadata = { title: 'Admin users' };

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <AdminUsersScreen />
    </Suspense>
  );
}
