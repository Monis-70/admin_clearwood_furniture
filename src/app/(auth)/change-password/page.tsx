import type { Metadata } from 'next';
import { Suspense } from 'react';

import { FullPageLoader } from '@/components/patterns/states';
import { ChangePasswordScreen } from '@/features/auth/change-password-screen';

export const metadata: Metadata = { title: 'Choose a new password' };

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <ChangePasswordScreen />
    </Suspense>
  );
}
