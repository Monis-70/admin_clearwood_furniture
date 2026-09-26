'use client';

import { useQuery } from '@tanstack/react-query';

import { enquiriesRoutes } from '@/lib/api/routes/enquiries';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { enquiriesApi, enquiryKeys } from './api';

/** Admins an enquiry can be assigned to; never requested without `lead.enquiry.assign`. */
export function useAssignees() {
  const { canCall } = usePermissions();
  return useQuery({
    queryKey: enquiryKeys.assignees(),
    queryFn: ({ signal }) => enquiriesApi.assignees(signal),
    enabled: canCall(enquiriesRoutes.assignees),
    ...cachePolicy.reference,
  });
}

/** "Priya Nair", or a neutral phrase when the name is not available to this role. */
export function assigneeName(
  id: string | null,
  assignees: readonly { id: string; name: string }[] | undefined,
): string {
  if (!id) return 'Nobody yet';
  return assignees?.find((a) => a.id === id)?.name ?? 'A colleague';
}
