'use client';

import { CircleAlert, SearchX, ServerCrash, WifiOff, type LucideIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type * as React from 'react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { describeError, errorReference } from '@/lib/api/error-messages';
import { isApiError } from '@/lib/api/errors';
import { formatDateTime } from '@/lib/format/datetime';
import { cn } from '@/lib/utils';

import { CopyButton } from './copy-button';

export function FullPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh items-center justify-center gap-3 text-muted-foreground"
    >
      <Spinner aria-hidden className="size-5" />
      <span>{label}</span>
    </div>
  );
}

export function SectionLoader({
  label = 'Loading…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex items-center gap-2 py-8 text-muted-foreground', className)}
    >
      <Spinner aria-hidden />
      <span>{label}</span>
    </div>
  );
}

interface StateShellProps {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: 'neutral' | 'danger' | 'warning';
  compact?: boolean;
  role?: 'alert' | 'status';
  className?: string;
}

export function StateShell({
  icon: Icon,
  title,
  children,
  actions,
  tone = 'neutral',
  compact,
  role,
  className,
}: StateShellProps) {
  return (
    <div
      role={role}
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card text-center',
        compact ? 'px-4 py-6' : 'px-6 py-12',
        className,
      )}
    >
      <span
        className={cn(
          'flex size-10 items-center justify-center rounded-full',
          tone === 'danger' && 'bg-danger-bg text-danger',
          tone === 'warning' && 'bg-warning-bg text-warning',
          tone === 'neutral' && 'bg-secondary text-muted-foreground',
        )}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      {children ? <div className="max-w-md text-sm text-muted-foreground">{children}</div> : null}
      {actions ? <div className="mt-1 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  /** Only the actions the operator is allowed to take. */
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon = SearchX,
  title,
  description,
  action,
  compact,
  className,
}: EmptyStateProps) {
  return (
    <StateShell icon={icon} title={title} actions={action} compact={compact} className={className}>
      {description}
    </StateShell>
  );
}

/** Expected answers (wrong password, validation, permission) need no technical details. */
const DIAGNOSTIC_CODES = new Set([
  'UNEXPECTED_RESPONSE',
  'INTERNAL_SERVER_ERROR',
  'DATABASE_ERROR',
  'INVALID_JSON',
  'BAD_REQUEST',
  'CORS_ORIGIN_NOT_ALLOWED',
  'CSRF_TOKEN_INVALID',
  'WRITE_CONFLICT',
]);

function worthDiagnosing(error: unknown): boolean {
  if (!isApiError(error)) return false;
  return error.status === 0 || error.status >= 500 || DIAGNOSTIC_CODES.has(error.code);
}

/** Code, HTTP status and reference for support; no request data, cookies or tokens. */
export function ErrorDiagnostics({
  error,
  className,
  always = false,
}: {
  error: unknown;
  className?: string;
  always?: boolean;
}) {
  if (!isApiError(error) || (!always && !worthDiagnosing(error))) return null;
  const reference = errorReference(error);
  const rows: [string, string][] = [
    ['Code', error.code],
    ['HTTP status', error.status === 0 ? 'No response' : String(error.status)],
    ['Request', `${error.method} ${error.path}`],
    ['Time', formatDateTime(error.occurredAt)],
  ];
  return (
    <details className={cn('w-full max-w-md text-left text-xs text-muted-foreground', className)}>
      <summary className="cursor-pointer rounded-sm py-1 font-medium text-foreground/80 hover:text-foreground">
        Technical details
      </summary>
      <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 rounded-md bg-muted/60 p-3">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="font-medium">{term}</dt>
            <dd className="font-mono break-all">{value}</dd>
          </div>
        ))}
        {reference ? (
          <div className="contents">
            <dt className="font-medium">Reference</dt>
            <dd className="flex items-center gap-1 font-mono break-all">
              {reference}
              <CopyButton value={reference} label="reference" className="size-6" />
            </dd>
          </div>
        ) : null}
      </dl>
    </details>
  );
}

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  title?: string;
  compact?: boolean;
  className?: string;
}

export function ErrorState({
  error,
  onRetry,
  retrying,
  title,
  compact,
  className,
}: ErrorStateProps) {
  const presentation = describeError(error);
  const offline = isApiError(error) && (error.code === 'OFFLINE' || error.code === 'NETWORK_ERROR');
  const icon = offline
    ? WifiOff
    : isApiError(error) && error.status >= 500
      ? ServerCrash
      : CircleAlert;
  return (
    <StateShell
      icon={icon}
      title={title ?? presentation.title}
      tone={presentation.tone === 'error' ? 'danger' : 'warning'}
      role="alert"
      compact={compact}
      className={className}
      actions={
        presentation.retryable && onRetry ? (
          <Button variant="outline" onClick={onRetry} loading={retrying}>
            Try again
          </Button>
        ) : undefined
      }
    >
      <p>{presentation.message}</p>
      <ErrorDiagnostics error={error} className="mx-auto mt-3" />
    </StateShell>
  );
}

/**
 * The 403 state. Loaded on demand: it carries the plain-language names of all 86 permissions,
 * which most page views never need.
 */
export const PermissionNotice = dynamic(
  () => import('./permission-notice').then((m) => m.PermissionNotice),
  { ssr: false },
);

export function NotFoundState({
  title = 'Page not found',
  backHref = '/',
  backLabel = 'Go to the dashboard',
}: {
  title?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <StateShell
      icon={SearchX}
      title={title}
      actions={
        <Button asChild variant="outline">
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      }
    >
      <p>The page you asked for does not exist, or it was moved.</p>
    </StateShell>
  );
}

/** Start-up could not reach the API: not the same as being signed out. */
export function ApiUnavailable({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <ErrorState
        error={error}
        onRetry={onRetry}
        title="The admin cannot reach the ClearWood API"
        className="max-w-lg"
      />
    </div>
  );
}
