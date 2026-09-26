import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { AnnouncementsScreen } from '@/features/content/announcements-screen';

export const metadata: Metadata = { title: 'Announcements' };

export default function AnnouncementsPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <AnnouncementsScreen />
    </Suspense>
  );
}
