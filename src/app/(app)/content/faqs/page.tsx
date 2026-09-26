import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { FaqsScreen } from '@/features/content/faqs-screen';

export const metadata: Metadata = { title: 'FAQs' };

export default function FaqsPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <FaqsScreen />
    </Suspense>
  );
}
