import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SectionLoader } from '@/components/patterns/states';
import { TestimonialsScreen } from '@/features/content/people-and-places-screens';

export const metadata: Metadata = { title: 'Testimonials' };

export default function TestimonialsPage() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <TestimonialsScreen />
    </Suspense>
  );
}
