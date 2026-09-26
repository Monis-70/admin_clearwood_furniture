'use client';

import { useState, type ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { describeError } from '@/lib/api/error-messages';

import { ErrorDiagnostics } from './states';

export type ConfirmLevel = 'standard' | 'destructive' | 'irreversible';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  /** What will change, in plain words, and whether it can be undone. */
  description: ReactNode;
  /** Optional list of what is affected (counts, names, blockers). */
  impact?: ReactNode;
  confirmLabel: string;
  level?: ConfirmLevel;
  /** For irreversible actions: the exact text the operator must type (a name, an email, DELETE). */
  confirmText?: string;
  /** Resolve to close; throw to keep the dialog open and show the error inside it. */
  onConfirm(): Promise<void> | void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  impact,
  confirmLabel,
  level = 'standard',
  confirmText,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [typed, setTyped] = useState('');
  const needsText = level === 'irreversible' && Boolean(confirmText);
  const textMatches = !needsText || typed.trim() === confirmText;

  const reset = () => {
    setError(null);
    setTyped('');
  };

  const change = (next: boolean) => {
    if (pending) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const confirm = async () => {
    if (pending || !textMatches) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      reset();
      onOpenChange(false);
    } catch (cause) {
      setError(cause);
    } finally {
      setPending(false);
    }
  };

  const presentation = error ? describeError(error) : null;

  return (
    <AlertDialog open={open} onOpenChange={change}>
      <AlertDialogContent onEscapeKeyDown={(event) => pending && event.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-2">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {impact ? <div className="rounded-md border bg-muted/40 p-3 text-sm">{impact}</div> : null}

        {needsText ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-text">
              Type <span className="font-mono font-semibold">{confirmText}</span> to confirm
            </Label>
            <Input
              id="confirm-text"
              autoComplete="off"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              disabled={pending}
            />
          </div>
        ) : null}

        {presentation ? (
          <Alert tone="danger" title={presentation.title} live="assertive">
            <p>{presentation.message}</p>
            <ErrorDiagnostics error={error} className="mt-2" />
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => change(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={level === 'standard' ? 'default' : 'destructive'}
            onClick={confirm}
            loading={pending}
            disabled={!textMatches}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
