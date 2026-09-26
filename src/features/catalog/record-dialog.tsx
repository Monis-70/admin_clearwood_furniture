'use client';

import type { ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** A scrollable dialog around one `EditorForm` (create or edit a small record). */
export function RecordDialog({
  title,
  description,
  onClose,
  children,
  wide,
}: {
  title: string;
  description?: ReactNode;
  onClose(): void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent
        className={`max-h-[90dvh] overflow-y-auto ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? undefined : 'sr-only'}>
            {description ?? title}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
