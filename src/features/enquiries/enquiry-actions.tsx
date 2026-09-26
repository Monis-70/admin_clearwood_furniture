'use client';

import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import type { AdminEnquiryDto } from '@shared/types/enquiry';

import { enquiriesRoutes } from '@/lib/api/routes/enquiries';
import { usePermissions } from '@/lib/permissions/use-permissions';

import {
  EditorForm,
  FormProblem,
  SelectField,
  TextAreaField,
  optionalText,
  textInput,
} from '../catalog/form-kit';

import { enquiriesApi, enquiryKeys, type EnquiryChanges } from './api';
import { assigneeName, useAssignees } from './assignees';
import { ENQUIRY_STATUS } from './model';

const schema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'QUOTED', 'CLOSED', 'SPAM']),
  assignedToId: z.string(),
  adminNote: optionalText(5_000),
});
type Values = z.input<typeof schema>;

/**
 * Work an enquiry: move it along (new → contacted → quoted → closed, or spam), give it to a
 * colleague and keep an internal note. Saved with the enquiry version, so parallel edits are refused.
 */
export function EnquiryActions({ enquiry }: { enquiry: AdminEnquiryDto }) {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const assignees = useAssignees();
  const canAssign = canCall(enquiriesRoutes.assignees);
  const canUpdate = canCall(enquiriesRoutes.update);
  const choices = [
    ...(assignees.data ?? []).map((a) => ({ value: a.id, label: a.name })),
    ...(enquiry.assignedToId && !assignees.data?.some((a) => a.id === enquiry.assignedToId)
      ? [{ value: enquiry.assignedToId, label: assigneeName(enquiry.assignedToId, undefined) }]
      : []),
  ];

  return (
    <section
      aria-labelledby="enquiry-actions"
      className="flex flex-col gap-3 rounded-lg border p-4"
    >
      <h3 id="enquiry-actions" className="text-sm font-semibold">
        Follow-up
      </h3>
      <EditorForm<Values, z.output<typeof schema>, AdminEnquiryDto>
        key={`${enquiry.id}:${enquiry.version}`}
        schema={schema}
        defaultValues={{
          status: enquiry.status,
          assignedToId: enquiry.assignedToId ?? '',
          adminNote: textInput(enquiry.adminNote),
        }}
        successMessage="Enquiry updated"
        readOnly={
          canUpdate ? undefined : (
            <p className="text-sm text-muted-foreground">
              Updating enquiries needs the lead.enquiry.update permission.
            </p>
          )
        }
        conflict={{
          fields: [
            {
              key: 'status',
              label: 'Status',
              format: (v) => ENQUIRY_STATUS[v as keyof typeof ENQUIRY_STATUS]?.label ?? String(v),
            },
            {
              key: 'assignedToId',
              label: 'Assigned to',
              format: (v) => assigneeName((v as string | null) ?? null, assignees.data),
            },
            {
              key: 'adminNote',
              label: 'Internal note',
              format: (v) => (v as string | null) ?? '—',
            },
          ],
          yours: (values) => ({
            status: values.status,
            assignedToId: values.assignedToId || null,
            adminNote: values.adminNote,
          }),
          loadLatest: () => enquiriesApi.get(enquiry.id),
          onReload: (latest) => queryClient.setQueryData(enquiryKeys.detail(enquiry.id), latest),
        }}
        onSubmit={async (values) => {
          const changes: EnquiryChanges = { version: enquiry.version };
          if (values.status !== enquiry.status) changes.status = values.status;
          const assigned = values.assignedToId || null;
          if (canAssign && assigned !== enquiry.assignedToId) changes.assignedToId = assigned;
          if (values.adminNote !== enquiry.adminNote) changes.adminNote = values.adminNote;
          if (Object.keys(changes).length === 1) throw new FormProblem(['Nothing changed.']);
          const saved = await enquiriesApi.update(enquiry.id, changes);
          queryClient.setQueryData(enquiryKeys.detail(enquiry.id), saved);
          void queryClient.invalidateQueries({ queryKey: [...enquiryKeys.all, 'list'] });
        }}
      >
        <SelectField<Values>
          name="status"
          label="Status"
          options={Object.entries(ENQUIRY_STATUS).map(([value, def]) => ({
            value,
            label: `${def.label}: ${def.description}`,
          }))}
        />
        {canAssign ? (
          <SelectField<Values>
            name="assignedToId"
            label="Assigned to"
            placeholder="Nobody"
            options={choices}
            description="Only admins who can read enquiries are listed."
          />
        ) : (
          <p className="text-sm">
            <span className="font-medium">Assigned to:</span>{' '}
            {assigneeName(enquiry.assignedToId, undefined)}
            <span className="block text-xs text-muted-foreground">
              Assigning needs the lead.enquiry.assign permission.
            </span>
          </p>
        )}
        <TextAreaField<Values>
          name="adminNote"
          label="Internal note"
          rows={4}
          description="Seen by admins only: what was discussed, quoted or agreed. Never shown to the customer."
        />
      </EditorForm>
    </section>
  );
}
