import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { AccountScreen } from '@/features/account/account-screen';

export const metadata: Metadata = { title: 'My account' };

export default function AccountPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <AccountScreen />
    </Suspense>
  );
}
