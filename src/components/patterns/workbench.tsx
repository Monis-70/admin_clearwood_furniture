'use client';

import { AlertTriangle, ArrowRight, CircleCheck, CircleDashed } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

const EntityHistory = dynamic(
  () => import('@/features/audit/entity-history').then((m) => m.EntityHistory),
  { ssr: false },
);

export interface WorkbenchIssue {
  key: string;
  label: string;
  /** Where the operator fixes it; omitted when no screen can. */
  href?: string;
  tone?: 'blocker' | 'warning';
}

export interface WorkbenchRelated {
  label: string;
  count: number | null;
  href?: string;
}

interface WorkbenchProps {
  /** e.g. "Product". */
  kind: string;
  title: string;
  status: ReactNode;
  /** 0–100 as the API computes it, with the factors behind it. */
  health?: {
    score: number;
    factors: { key: string; label: string; satisfied: boolean; href?: string }[];
  };
  issues: readonly WorkbenchIssue[];
  /** Record-specific summaries (for example a product's media), built from API data. */
  blocks?: readonly { id: string; title: string; content: ReactNode }[];
  /** Permission-aware buttons or links; the caller never passes actions the admin cannot use. */
  actions?: ReactNode;
  related?: readonly WorkbenchRelated[];
  facts?: readonly { label: string; value: ReactNode }[];
  history?: { entity: string; entityId: string };
  className?: string;
}

/**
 * Context for the record being managed: where it stands, what blocks it and what to do next.
 * Everything shown comes from the API (status, completeness, publish blockers, audit); nothing is
 * inferred here. It is not a dashboard: one record, the few facts that drive the next action.
 */
export function Workbench({
  kind,
  title,
  status,
  health,
  issues,
  blocks,
  actions,
  related,
  facts,
  history,
  className,
}: WorkbenchProps) {
  const blockers = issues.filter((issue) => issue.tone !== 'warning');
  const warnings = issues.filter((issue) => issue.tone === 'warning');

  return (
    <aside
      aria-label={`${kind} workbench`}
      className={cn('flex flex-col gap-4 rounded-lg border bg-card p-4 text-sm', className)}
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{kind}</p>
        <p className="font-semibold break-words">{title}</p>
        <div className="flex flex-wrap items-center gap-1.5">{status}</div>
      </div>

      {health ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">Completeness</span>
            <span className="tabular font-semibold">{health.score}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Completeness"
            aria-valuenow={health.score}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                'h-full rounded-full',
                health.score >= 80
                  ? 'bg-success'
                  : health.score >= 50
                    ? 'bg-warning'
                    : 'bg-destructive',
              )}
              style={{ width: `${health.score}%` }}
            />
          </div>
        </div>
      ) : null}

      <section aria-labelledby="workbench-attention" className="flex flex-col gap-2">
        <h2 id="workbench-attention" className="font-medium">
          {issues.length > 0 ? 'Needs attention' : 'Ready'}
        </h2>
        {issues.length === 0 ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <CircleCheck aria-hidden className="size-4 text-success" />
            Nothing is blocking this {kind.toLowerCase()}.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {[...blockers, ...warnings].map((issue) => (
              <li key={issue.key} className="flex items-start gap-2">
                <AlertTriangle
                  aria-hidden
                  className={cn(
                    'mt-0.5 size-4 shrink-0',
                    issue.tone === 'warning' ? 'text-warning' : 'text-destructive',
                  )}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span>
                    <span className="sr-only">
                      {issue.tone === 'warning' ? 'Warning: ' : 'Blocks publishing: '}
                    </span>
                    {issue.label}
                  </span>
                  {issue.href ? (
                    <Link
                      href={issue.href}
                      className="w-fit text-xs font-medium text-primary hover:underline"
                    >
                      Fix this<span className="sr-only">: {issue.label}</span>
                    </Link>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {blocks?.map((block) => (
        <section
          key={block.id}
          aria-labelledby={`workbench-${block.id}`}
          className="flex flex-col gap-2"
        >
          <h2 id={`workbench-${block.id}`} className="font-medium">
            {block.title}
          </h2>
          {block.content}
        </section>
      ))}

      {health && health.factors.some((factor) => !factor.satisfied) ? (
        <details className="group">
          <summary className="cursor-pointer font-medium">What would complete it</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {health.factors.map((factor) => (
              <li key={factor.key} className="flex items-center gap-2">
                {factor.satisfied ? (
                  <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />
                ) : (
                  <CircleDashed aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="sr-only">{factor.satisfied ? 'Done: ' : 'To do: '}</span>
                {factor.href && !factor.satisfied ? (
                  <Link href={factor.href} className="hover:underline">
                    {factor.label}
                  </Link>
                ) : (
                  <span className={factor.satisfied ? 'text-muted-foreground' : undefined}>
                    {factor.label}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {actions ? (
        <section aria-label="Next actions" className="flex flex-col gap-2">
          <h2 className="font-medium">Next actions</h2>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </section>
      ) : null}

      {facts && facts.length > 0 ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {facts.map((fact) => (
            <div key={fact.label} className="contents">
              <dt className="text-muted-foreground">{fact.label}</dt>
              <dd className="min-w-0 text-right break-words">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {related && related.length > 0 ? (
        <section aria-labelledby="workbench-related" className="flex flex-col gap-1.5">
          <h2 id="workbench-related" className="font-medium">
            Related
          </h2>
          <ul className="flex flex-col divide-y rounded-md border">
            {related.map((item) => (
              <li key={item.label}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/50"
                  >
                    <span>{item.label}</span>
                    <span className="tabular flex items-center gap-1 text-muted-foreground">
                      {item.count ?? '—'}
                      <ArrowRight aria-hidden className="size-3.5" />
                    </span>
                  </Link>
                ) : (
                  <span className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>{item.label}</span>
                    <span className="tabular text-muted-foreground">{item.count ?? '—'}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {history ? (
        <section aria-labelledby="workbench-history" className="flex flex-col gap-1.5">
          <h2 id="workbench-history" className="font-medium">
            Recent activity
          </h2>
          <EntityHistory entity={history.entity} entityId={history.entityId} />
        </section>
      ) : null}
    </aside>
  );
}
