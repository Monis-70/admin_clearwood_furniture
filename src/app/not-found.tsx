import type { Metadata } from 'next';

import { NotFoundState } from '@/components/patterns/states';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <NotFoundState />
    </main>
  );
}
