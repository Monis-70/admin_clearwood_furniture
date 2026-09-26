import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { ImportExportScreen } from '@/features/catalog/import-export/import-export-screen';

export const metadata: Metadata = { title: 'Import & export' };

export default function ImportExportPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <ImportExportScreen />
    </Suspense>
  );
}
