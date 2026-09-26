'use client';

import { Alert } from '@/components/ui/alert';
import { describeError } from '@/lib/api/error-messages';

import { ErrorDiagnostics } from '../states';

/** Form-level problems: server messages that belong to no field, or a failed submission. */
export function FormAlert({
  error,
  messages = [],
  className,
}: {
  error?: unknown;
  messages?: readonly string[];
  className?: string;
}) {
  if (!error && messages.length === 0) return null;
  const presentation = error ? describeError(error) : null;
  return (
    <Alert
      tone="danger"
      live="assertive"
      title={presentation?.title ?? 'Please check the form'}
      className={className}
    >
      {messages.length > 0 ? (
        <ul className="list-disc pl-4">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : (
        <p>{presentation?.message}</p>
      )}
      {error ? <ErrorDiagnostics error={error} className="mt-2" /> : null}
    </Alert>
  );
}
