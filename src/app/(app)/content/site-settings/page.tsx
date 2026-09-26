import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { SiteSettingsScreen } from '@/features/content/site-settings-screen';

export const metadata: Metadata = { title: 'Site & SEO settings' };

export default function SiteSettingsPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <SiteSettingsScreen />
    </Suspense>
  );
}
