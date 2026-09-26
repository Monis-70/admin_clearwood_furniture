'use client';

import './globals.css';

/** Last resort when the root layout itself fails; keeps no state and offers a reload. */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-IN">
      <body className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
        <div role="alert" className="flex max-w-md flex-col items-center gap-3 text-center">
          <h1 className="text-lg font-semibold">The admin could not start</h1>
          <p className="text-sm text-muted-foreground">
            Something went wrong while loading the page. Reload to try again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
