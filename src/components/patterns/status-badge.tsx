'use client';

import type * as React from 'react';

import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/overlay';

export interface StatusDefinition {
  label: string;
  tone: BadgeTone;
  /** What the status means for the operator ("Visible on the storefront"). */
  description?: string;
}

export type StatusRegistry<T extends string> = Readonly<Record<T, StatusDefinition>>;

interface StatusBadgeProps<T extends string> {
  status: T;
  registry: StatusRegistry<T>;
  icon?: React.ReactNode;
}

/** Colour is never the only signal: the label is always visible, the meaning is one hover away. */
export function StatusBadge<T extends string>({ status, registry, icon }: StatusBadgeProps<T>) {
  const definition = registry[status] ?? { label: status, tone: 'neutral' as const };
  const badge = (
    <Badge tone={definition.tone}>
      {icon}
      {definition.label}
    </Badge>
  );
  if (!definition.description) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {badge}
          <span className="sr-only">: {definition.description}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{definition.description}</TooltipContent>
    </Tooltip>
  );
}

/** A legend listing every status of a registry with its meaning. */
export function StatusLegend<T extends string>({ registry }: { registry: StatusRegistry<T> }) {
  return (
    <dl className="grid gap-2 text-sm">
      {(Object.keys(registry) as T[]).map((key) => (
        <div key={key} className="flex items-start gap-3">
          <dt className="w-32 shrink-0">
            <Badge tone={registry[key].tone}>{registry[key].label}</Badge>
          </dt>
          <dd className="text-muted-foreground">{registry[key].description ?? ''}</dd>
        </div>
      ))}
    </dl>
  );
}
