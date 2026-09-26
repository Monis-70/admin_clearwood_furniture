'use client';

import { describeError, errorReference } from '@/lib/api/error-messages';
import { isAbortError } from '@/lib/api/errors';

/** sonner is loaded on first use; the Toaster itself mounts lazily in the root providers. */
const loadToast = () => import('sonner').then((module) => module.toast);

/** Success of an action that leaves the screen or affects other screens. */
export function notifySuccess(message: string, description?: string): void {
  void loadToast().then((toast) => toast.success(message, { description }));
}

/** Something changed that the operator should know about (not an error, not their action). */
export function notifyInfo(message: string, description?: string, id?: string): void {
  void loadToast().then((toast) => toast.info(message, { description, id, duration: 10_000 }));
}

/** Errors stay until dismissed and carry the support reference. */
export function notifyError(error: unknown, context?: string): void {
  if (isAbortError(error)) return;
  const presentation = describeError(error);
  const reference = errorReference(error);
  const title = context ? `${context}: ${presentation.title}` : presentation.title;
  void loadToast().then((toast) =>
    toast.error(title, {
      description: reference
        ? `${presentation.message} Reference: ${reference}`
        : presentation.message,
      duration: Infinity,
    }),
  );
}
