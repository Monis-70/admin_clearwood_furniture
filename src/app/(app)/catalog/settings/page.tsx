import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { CatalogSettingsScreen } from '@/features/catalog/settings/catalog-settings-screen';

export const metadata: Metadata = { title: 'Catalog settings' };

export default function CatalogSettingsPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <CatalogSettingsScreen />
    </Suspense>
  );
}
