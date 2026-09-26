import type * as React from 'react';

import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  /** One line answering "what is this page for?". */
  description?: React.ReactNode;
  /** Status badge of the record on detail pages. */
  status?: React.ReactNode;
  /** Primary action first, then secondary actions. */
  actions?: React.ReactNode;
  /** Back link or breadcrumb above the title. */
  eyebrow?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  status,
  actions,
  eyebrow,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 pb-6 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow ? <div className="text-sm text-muted-foreground">{eyebrow}</div> : null}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[22px] leading-tight">{title}</h1>
          {status}
        </div>
        {description ? (
          <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
