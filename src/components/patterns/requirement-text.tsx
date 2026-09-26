'use client';

import type { Permission } from '@shared/enums';

import { describeRequirement } from '@/lib/permissions/labels';

/** "You need the permission: …" in plain words; loaded only when a button is actually blocked. */
export function RequirementText({
  all,
  any,
}: {
  all: readonly Permission[];
  any: readonly Permission[];
}) {
  return <>You need the permission: {describeRequirement(all, any)}.</>;
}
