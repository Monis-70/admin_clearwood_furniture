'use client';

import { z } from 'zod';

import {
  CheckField,
  EditorForm,
  FieldGrid,
  FormSection,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
  dateTimeInput,
  intInput,
  optionalDateTime,
  optionalText,
  requiredInt,
  requiredText,
  textInput,
} from '../../catalog/form-kit';
import { RecordDialog } from '../../catalog/record-dialog';
import { contentApi, type AnnouncementRow } from '../api';
import { DEVICE_LABELS, options } from '../model';

import { optionalHex, optionalLink } from './fields';

const schema = z.object({
  message: requiredText(1, 300, 'Message'),
  linkUrl: optionalLink,
  linkLabel: optionalText(60),
  backgroundHex: optionalHex,
  textHex: optionalHex,
  isDismissible: z.boolean(),
  isActive: z.boolean(),
  startsAt: optionalDateTime(),
  endsAt: optionalDateTime(),
  position: requiredInt(0, 999, 'Order'),
  deviceVisibility: z.enum(['ALL', 'DESKTOP_ONLY', 'MOBILE_ONLY']),
});
type Values = z.input<typeof schema>;

export function AnnouncementDialog({
  row,
  onClose,
  onSaved,
}: {
  row: AnnouncementRow | null;
  onClose(): void;
  onSaved(): void;
}) {
  return (
    <RecordDialog
      title={row ? 'Edit announcement' : 'New announcement'}
      description="The thin bar above the storefront header."
      onClose={onClose}
      wide
    >
      <EditorForm
        schema={schema}
        defaultValues={{
          message: textInput(row?.message),
          linkUrl: textInput(row?.linkUrl),
          linkLabel: textInput(row?.linkLabel),
          backgroundHex: textInput(row?.backgroundHex),
          textHex: textInput(row?.textHex),
          isDismissible: row?.isDismissible ?? true,
          isActive: row?.isActive ?? true,
          startsAt: dateTimeInput(row?.startsAt),
          endsAt: dateTimeInput(row?.endsAt),
          position: intInput(row?.position ?? 0),
          deviceVisibility: (row?.deviceVisibility as Values['deviceVisibility']) ?? 'ALL',
        }}
        successMessage={row ? 'Announcement saved' : 'Announcement created'}
        submitLabel={row ? 'Save changes' : 'Create announcement'}
        onSubmit={async (values) => {
          if (row) await contentApi.updateAnnouncement(row.id, { ...values, version: row.version });
          else await contentApi.createAnnouncement(values);
          onSaved();
        }}
      >
        <TextAreaField<Values> name="message" label="Message" rows={2} required />
        <FieldGrid>
          <TextField<Values>
            name="linkUrl"
            label="Link"
            description="A path like /sale, or an https:// address."
          />
          <TextField<Values> name="linkLabel" label="Link text" />
        </FieldGrid>
        <FormSection title="When and where">
          <FieldGrid>
            <TextField<Values> name="startsAt" label="Show from" type="datetime-local" />
            <TextField<Values> name="endsAt" label="Show until" type="datetime-local" />
            <SelectField<Values>
              name="deviceVisibility"
              label="Devices"
              options={options(DEVICE_LABELS)}
            />
            <NumberField<Values>
              name="position"
              label="Order"
              description="When several are live, the lowest number shows."
            />
          </FieldGrid>
        </FormSection>
        <FieldGrid>
          <TextField<Values> name="backgroundHex" label="Background colour" placeholder="#1f2937" />
          <TextField<Values> name="textHex" label="Text colour" placeholder="#ffffff" />
          <CheckField<Values>
            name="isDismissible"
            label="Customers can close it"
            description="A closed bar stays hidden for that customer."
          />
          <CheckField<Values> name="isActive" label="On" />
        </FieldGrid>
      </EditorForm>
    </RecordDialog>
  );
}
