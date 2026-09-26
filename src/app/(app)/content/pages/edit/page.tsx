import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { PageEditorScreen } from '@/features/content/page-editor-screen';

export const metadata: Metadata = { title: 'Edit page' };

export default function PageEditorPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <PageEditorScreen />
    </Suspense>
  );
}
