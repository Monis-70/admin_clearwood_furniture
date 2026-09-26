'use client';

import { z } from 'zod';

import {
  CheckField,
  EditorForm,
  FieldGrid,
  TextField,
  optionalText,
  requiredText,
  textInput,
} from '../catalog/form-kit';
import { RecordDialog } from '../catalog/record-dialog';
import { taxClassesApi, type TaxClassRow } from '../catalog/taxonomy/api';

const schema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]{1,31}$/, 'Use UPPER_SNAKE_CASE, e.g. GST_18'),
  name: requiredText(2, 160, 'Name'),
  rate: z
    .string()
    .trim()
    .regex(/^\d{1,3}(\.\d{1,2})?$/, 'Enter a percentage like 18 or 12.5')
    .transform((v) => Math.round(Number(v) * 100))
    .refine((bp) => bp <= 10_000, 'At most 100%'),
  hsnCode: optionalText(16),
  isDefault: z.boolean(),
  isActive: z.boolean(),
});
type Values = z.input<typeof schema>;

/** Loaded when an admin creates or edits a tax class, so the list does not ship the form stack. */
export function TaxClassDialog({
  taxClass,
  onClose,
  onSaved,
}: {
  taxClass: TaxClassRow | null;
  onClose(): void;
  onSaved(): void;
}) {
  return (
    <RecordDialog
      title={taxClass ? `Edit ${taxClass.name}` : 'New tax class'}
      description="Changing a rate affects prices of every product in this class from now on."
      onClose={onClose}
    >
      <EditorForm
        schema={schema}
        defaultValues={{
          code: textInput(taxClass?.code),
          name: textInput(taxClass?.name),
          rate: taxClass ? String(taxClass.rateBp / 100) : '',
          hsnCode: textInput(taxClass?.hsnCode),
          isDefault: taxClass?.isDefault ?? false,
          isActive: taxClass?.isActive ?? true,
        }}
        successMessage={taxClass ? 'Tax class saved' : 'Tax class created'}
        submitLabel={taxClass ? 'Save changes' : 'Create tax class'}
        aliases={{ rateBp: 'rate' }}
        onSubmit={async ({ rate, ...values }) => {
          const input = { ...values, rateBp: rate };
          if (taxClass) await taxClassesApi.update(taxClass.id, input);
          else await taxClassesApi.create(input);
          onSaved();
        }}
      >
        <FieldGrid>
          <TextField<Values> name="name" label="Name" required />
          <TextField<Values> name="code" label="Code" required />
        </FieldGrid>
        <FieldGrid>
          <TextField<Values> name="rate" label="GST rate" inputMode="decimal" prefix="%" required />
          <TextField<Values> name="hsnCode" label="HSN code" />
        </FieldGrid>
        <FieldGrid>
          <CheckField<Values>
            name="isDefault"
            label="Default"
            description="Applies to products that have no tax class."
          />
          <CheckField<Values> name="isActive" label="Active" />
        </FieldGrid>
      </EditorForm>
    </RecordDialog>
  );
}
