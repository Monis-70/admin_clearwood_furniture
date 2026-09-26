'use client';

import { z } from 'zod';

import {
  CheckField,
  EditorForm,
  FieldGrid,
  NumberField,
  TextAreaField,
  TextField,
  intInput,
  optionalText,
  requiredInt,
  requiredText,
  textInput,
} from '../form-kit';
import { RecordDialog } from '../record-dialog';
import { brandsApi, type BrandRow } from '../taxonomy/api';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const schema = z.object({
  name: requiredText(2, 160, 'Name'),
  slug: z
    .string()
    .trim()
    .refine((v) => v === '' || SLUG.test(v), 'Use lowercase words joined by dashes')
    .transform((v) => v || undefined),
  description: optionalText(4_000),
  position: requiredInt(0, 10_000, 'Position'),
  isActive: z.boolean(),
});
type Values = z.input<typeof schema>;

/** Loaded when an admin creates or edits a brand, so the list does not ship the form stack. */
export function BrandDialog({
  brand,
  onClose,
  onSaved,
}: {
  brand: BrandRow | null;
  onClose(): void;
  onSaved(): void;
}) {
  return (
    <RecordDialog title={brand ? `Edit ${brand.name}` : 'New brand'} onClose={onClose}>
      <EditorForm
        schema={schema}
        defaultValues={{
          name: textInput(brand?.name),
          slug: textInput(brand?.slug),
          description: textInput(brand?.description),
          position: intInput(brand?.position ?? 0),
          isActive: brand?.isActive ?? true,
        }}
        successMessage={brand ? 'Brand saved' : 'Brand created'}
        submitLabel={brand ? 'Save changes' : 'Create brand'}
        onSubmit={async (values) => {
          if (brand) await brandsApi.update(brand.id, { ...values, version: brand.version });
          else await brandsApi.create(values);
          onSaved();
        }}
      >
        <TextField<Values> name="name" label="Name" required />
        <TextField<Values>
          name="slug"
          label="URL slug"
          description={brand ? undefined : 'Empty: made from the name.'}
        />
        <TextAreaField<Values> name="description" label="Description" rows={3} />
        <FieldGrid>
          <NumberField<Values>
            name="position"
            label="Order"
            description="Lower numbers come first."
          />
          <CheckField<Values> name="isActive" label="Active" />
        </FieldGrid>
      </EditorForm>
    </RecordDialog>
  );
}
