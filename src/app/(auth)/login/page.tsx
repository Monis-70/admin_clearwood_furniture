import type { Metadata } from 'next';
import { Suspense } from 'react';

import { FullPageLoader } from '@/components/patterns/states';
import { SignInScreen } from '@/features/auth/sign-in-screen';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <SignInScreen />
    </Suspense>
  );
}
