'use client';

import { z } from 'zod';

import {
  CheckField,
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
} from '../form-kit';
import type { CollectionDetail } from './api';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const collectionSchema = z
  .object({
    name: requiredText(2, 160, 'Name'),
    slug: z
      .string()
      .trim()
      .refine((v) => v === '' || SLUG.test(v), 'Use lowercase words joined by dashes')
      .transform((v) => v || undefined),
    type: z.enum(['MANUAL', 'AUTOMATIC']),
    description: optionalText(10_000),
    isActive: z.boolean(),
    position: requiredInt(0, 10_000, 'Order'),
    startsAt: optionalDateTime(),
    endsAt: optionalDateTime(),
    seoTitle: optionalText(180),
    seoDescription: optionalText(400),
  })
  .superRefine((value, ctx) => {
    if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Must be after the start' });
    }
  });
export type CollectionValues = z.input<typeof collectionSchema>;

export function collectionDefaults(c: CollectionDetail | null): CollectionValues {
  return {
    name: textInput(c?.name),
    slug: textInput(c?.slug),
    type: c?.type ?? 'MANUAL',
    description: textInput(c?.description),
    isActive: c?.isActive ?? true,
    position: intInput(c?.position ?? 0),
    startsAt: dateTimeInput(c?.startsAt),
    endsAt: dateTimeInput(c?.endsAt),
    seoTitle: textInput(c?.seoTitle),
    seoDescription: textInput(c?.seoDescription),
  };
}

export function CollectionFields({ creating }: { creating: boolean }) {
  return (
    <>
      <FormSection title="Collection">
        <FieldGrid>
          <TextField<CollectionValues> name="name" label="Name" required />
          <TextField<CollectionValues>
            name="slug"
            label="URL slug"
            description={creating ? 'Empty: made from the name.' : undefined}
          />
        </FieldGrid>
        {creating ? (
          <SelectField<CollectionValues>
            name="type"
            label="How products are chosen"
            options={[
              { value: 'MANUAL', label: 'By hand (manual)' },
              { value: 'AUTOMATIC', label: 'By rules (automatic)' },
            ]}
          />
        ) : null}
        <TextAreaField<CollectionValues> name="description" label="Description" rows={3} />
        <FieldGrid>
          <NumberField<CollectionValues>
            name="position"
            label="Order"
            description="Lower numbers come first."
          />
          <CheckField<CollectionValues>
            name="isActive"
            label="Active"
            description="Visible on the storefront."
          />
        </FieldGrid>
      </FormSection>
      <FormSection title="Schedule" description="Leave empty to show it all the time.">
        <FieldGrid>
          <TextField<CollectionValues> name="startsAt" label="Show from" type="datetime-local" />
          <TextField<CollectionValues> name="endsAt" label="Show until" type="datetime-local" />
        </FieldGrid>
      </FormSection>
      <FormSection title="SEO">
        <TextField<CollectionValues> name="seoTitle" label="SEO title" />
        <TextAreaField<CollectionValues> name="seoDescription" label="SEO description" rows={2} />
      </FormSection>
    </>
  );
}
