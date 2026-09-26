'use client';

import { z } from 'zod';

import {
  CheckField,
  EditorForm,
  FieldGrid,
  NumberField,
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
import { contentApi, type TestimonialRow } from '../api';
import { MediaField } from './form-fields';
import { parseIds } from '../model';

import { idLines, optionalMediaId } from './fields';

const schema = z.object({
  authorName: requiredText(1, 120, 'Name'),
  authorLocation: optionalText(120),
  authorRole: optionalText(120),
  avatarMediaId: optionalMediaId,
  quote: requiredText(1, 2_000, 'Quote'),
  stars: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[0-5](\.\d)?$/.test(v), 'Enter 0 to 5, e.g. 4.5')
    .transform((v) => (v === '' ? null : Math.round(Number(v) * 10_000)))
    .refine((v) => v === null || v <= 50_000, 'At most 5 stars'),
  productId: optionalText(40),
  mediaIds: idLines(10),
  isFeatured: z.boolean(),
  isActive: z.boolean(),
  position: requiredInt(0, 999, 'Order'),
  capturedAt: optionalDateTime(),
});
type Values = z.input<typeof schema>;

export function TestimonialDialog({
  row,
  onClose,
  onSaved,
}: {
  row: TestimonialRow | null;
  onClose(): void;
  onSaved(): void;
}) {
  return (
    <RecordDialog
      title={row ? `Edit ${row.authorName}'s quote` : 'New testimonial'}
      onClose={onClose}
      wide
    >
      <EditorForm
        schema={schema}
        defaultValues={{
          authorName: textInput(row?.authorName),
          authorLocation: textInput(row?.authorLocation),
          authorRole: textInput(row?.authorRole),
          avatarMediaId: textInput(row?.avatarMediaId),
          quote: textInput(row?.quote),
          stars: row?.ratingBp == null ? '' : String(row.ratingBp / 10_000),
          productId: textInput(row?.productId),
          mediaIds: parseIds(row?.mediaIdsJson).join('\n'),
          isFeatured: row?.isFeatured ?? false,
          isActive: row?.isActive ?? true,
          position: intInput(row?.position ?? 0),
          capturedAt: dateTimeInput(row?.capturedAt),
        }}
        successMessage={row ? 'Testimonial saved' : 'Testimonial created'}
        submitLabel={row ? 'Save changes' : 'Create testimonial'}
        onSubmit={async ({ stars, ...values }) => {
          const body = { ...values, ratingBp: stars };
          if (row) await contentApi.updateTestimonial(row.id, { ...body, version: row.version });
          else await contentApi.createTestimonial(body);
          onSaved();
        }}
      >
        <TextAreaField<Values> name="quote" label="Quote" rows={4} required />
        <FieldGrid>
          <TextField<Values> name="authorName" label="Customer name" required />
          <TextField<Values> name="authorLocation" label="City" />
          <TextField<Values> name="authorRole" label="Role" description="e.g. Interior designer" />
          <TextField<Values>
            name="stars"
            label="Rating"
            inputMode="decimal"
            description="0 to 5 stars; empty for none."
          />
        </FieldGrid>
        <MediaField<Values> name="avatarMediaId" label="Photo" />
        <FieldGrid>
          <TextField<Values>
            name="productId"
            label="Product ID"
            description="Optional: the product this is about."
          />
          <TextField<Values> name="capturedAt" label="Received" type="datetime-local" />
        </FieldGrid>
        <TextAreaField<Values>
          name="mediaIds"
          label="Extra image IDs"
          rows={2}
          description="Media library IDs, one per line (up to 10)."
        />
        <FieldGrid>
          <CheckField<Values>
            name="isFeatured"
            label="Featured"
            description="Shown by blocks set to featured quotes only."
          />
          <CheckField<Values> name="isActive" label="Visible" />
          <NumberField<Values> name="position" label="Order" description="Lower comes first." />
        </FieldGrid>
      </EditorForm>
    </RecordDialog>
  );
}
