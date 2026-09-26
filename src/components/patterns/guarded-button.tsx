'use client';

import dynamic from 'next/dynamic';
import { useId, type ReactNode } from 'react';

import { Button, type ButtonProps } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/overlay';
import type { EndpointDef } from '@/lib/api/endpoint';
import { requirementOf, type Requirement } from '@/lib/permissions/requirements';
import { usePermissions } from '@/lib/permissions/use-permissions';

// The plain-language permission names load only when a button is actually blocked.
const RequirementText = dynamic(() => import('./requirement-text').then((m) => m.RequirementText), {
  ssr: false,
});

type GuardedButtonProps = ButtonProps & {
  /** The endpoint this button calls: its access rule decides whether the button is usable. */
  endpoint?: EndpointDef;
  requirement?: Requirement;
  /** Why the action is unavailable for a reason other than permissions (state, on hold…). */
  unavailableReason?: string;
};

/**
 * An action that explains itself when it cannot be used. It stays focusable (aria-disabled, not
 * disabled) so keyboard and screen-reader users reach the explanation too. Hiding or disabling
 * a button is convenience only: the API enforces the same rule.
 */
export function GuardedButton({
  endpoint,
  requirement,
  unavailableReason,
  onClick,
  children,
  ...props
}: GuardedButtonProps) {
  const { allows, missing } = usePermissions();
  const reasonId = useId();
  const needed = requirement ?? (endpoint ? requirementOf(endpoint.access) : 'session');

  let reason: ReactNode = unavailableReason ?? null;
  if (!reason && !allows(needed)) {
    const gap = missing(needed);
    reason = <RequirementText all={gap.all} any={gap.any} />;
  }

  if (!reason) {
    return (
      <Button onClick={onClick} {...props}>
        {children}
      </Button>
    );
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            {...props}
            aria-disabled="true"
            aria-describedby={reasonId}
            onClick={(event) => event.preventDefault()}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
      <span id={reasonId} className="sr-only">
        {reason}
      </span>
    </>
  );
}
