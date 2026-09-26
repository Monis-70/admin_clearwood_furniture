import type { ReactNode } from 'react';

/** Sign-in and password pages: no navigation, one focused task. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[420px]">{children}</div>
    </main>
  );
}
