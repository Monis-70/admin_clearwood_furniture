'use client';

import { ErrorState } from '@/components/patterns/states';

/** Render failures inside the shell: the navigation stays usable. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="py-10">
      <ErrorState error={error} title="This page could not be displayed" onRetry={reset} />
    </div>
  );
}
