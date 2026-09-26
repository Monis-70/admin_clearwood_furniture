import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { MediaLibraryScreen } from '@/features/media/media-library-screen';

export const metadata: Metadata = { title: 'Media library' };

export default function MediaPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <MediaLibraryScreen />
    </Suspense>
  );
}
