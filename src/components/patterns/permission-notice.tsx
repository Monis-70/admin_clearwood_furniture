'use client';

import { Lock } from 'lucide-react';
import Link from 'next/link';

import type { Permission } from '@shared/enums';

import { Button } from '@/components/ui/button';
import { describeRequirement } from '@/lib/permissions/labels';

import { StateShell } from './states';

interface PermissionNoticeProps {
  /** What the area is, in words: "the audit log". */
  area: string;
  all?: readonly Permission[];
  any?: readonly Permission[];
  compact?: boolean;
}

/** The 403 state: what is missing and who can grant it. The API enforces it regardless. */
export function PermissionNotice({ area, all = [], any = [], compact }: PermissionNoticeProps) {
  const needed = describeRequirement(all, any);
  return (
    <StateShell
      icon={Lock}
      title={`You don't have access to ${area}`}
      tone="warning"
      compact={compact}
      actions={
        compact ? undefined : (
          <Button asChild variant="outline">
            <Link href="/">Go to the dashboard</Link>
          </Button>
        )
      }
    >
      <p>
        {needed ? (
          <>
            This needs the permission:{' '}
            <strong className="font-medium text-foreground">{needed}</strong>.{' '}
          </>
        ) : null}
        Ask a Super Admin to update your role if you need it.
      </p>
    </StateShell>
  );
}
