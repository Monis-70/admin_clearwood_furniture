import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { NotificationsScreen } from '@/features/orders/notifications-screen';

export const metadata: Metadata = { title: 'Notification log' };

export default function NotificationsPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <NotificationsScreen />
    </Suspense>
  );
}
