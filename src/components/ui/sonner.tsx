'use client';

import { Toaster as Sonner, type ToasterProps } from 'sonner';

/** Success toasts dismiss after 4 s; errors stay until dismissed (see showErrorToast). */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-right"
      closeButton
      duration={4000}
      toastOptions={{
        classNames: {
          toast: 'rounded-md border border-border bg-card text-foreground shadow-overlay',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-secondary text-secondary-foreground',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
