import type * as React from 'react';

import { cn } from '@/lib/utils';

export interface KeyValueItem {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}

export function KeyValueList({
  items,
  className,
}: {
  items: readonly KeyValueItem[];
  className?: string;
}) {
  return (
    <dl
      className={cn('grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(10rem,max-content)_1fr]', className)}
    >
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="flex flex-col gap-0.5 text-sm">
            <span>{item.value}</span>
            {item.hint ? <span className="text-xs text-muted-foreground">{item.hint}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
