'use client';

import { z } from 'zod';

import {
  CheckField,
  EditorForm,
  FieldGrid,
  TextAreaField,
  TextField,
  optionalText,
  textInput,
} from '../catalog/form-kit';
import { RecordDialog } from '../catalog/record-dialog';

import { searchApi, type SynonymRow } from './api';

const schema = z.object({
  term: z.string().trim().min(2, 'At least 2 characters').max(60),
  synonyms: z
    .string()
    .transform((v) => [
      ...new Set(
        v
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ])
    .refine((list) => list.length >= 1 && list.length <= 25, 'Enter 1 to 25 words or phrases')
    .refine(
      (list) => list.every((s) => s.length >= 2 && s.length <= 60),
      'Each is 2 to 60 characters',
    ),
  isTwoWay: z.boolean(),
  isActive: z.boolean(),
  note: optionalText(300),
});
type Values = z.input<typeof schema>;

/** Words that should find the same products, e.g. "couch" → sofa. */
export function SynonymDialog({
  synonym,
  term,
  onClose,
  onSaved,
}: {
  synonym: SynonymRow | null;
  term?: string;
  onClose(): void;
  onSaved(): void;
}) {
  return (
    <RecordDialog title={synonym ? `Edit "${synonym.term}"` : 'New synonym set'} onClose={onClose}>
      <EditorForm
        schema={schema}
        defaultValues={{
          term: synonym?.term ?? term ?? '',
          synonyms: synonym ? synonym.synonyms.join('\n') : '',
          isTwoWay: synonym?.isTwoWay ?? true,
          isActive: synonym?.isActive ?? true,
          note: textInput(synonym?.note),
        }}
        successMessage={synonym ? 'Synonyms saved' : 'Synonyms created'}
        submitLabel={synonym ? 'Save changes' : 'Create synonyms'}
        onSubmit={async ({ term: t, ...values }) => {
          if (synonym) await searchApi.updateSynonym(synonym.term, values);
          else await searchApi.createSynonym({ ...values, term: t });
          onSaved();
        }}
      >
        {synonym ? null : (
          <TextField<Values> name="term" label="When customers search for" required />
        )}
        <TextAreaField<Values>
          name="synonyms"
          label="Also search for"
          rows={4}
          required
          description="One per line, or separated by commas."
        />
        <FieldGrid>
          <CheckField<Values>
            name="isTwoWay"
            label="Works both ways"
            description="Searching any of the words finds the others."
          />
          <CheckField<Values> name="isActive" label="Active" />
        </FieldGrid>
        <TextField<Values>
          name="note"
          label="Note"
          description="Why this synonym exists (internal)."
        />
      </EditorForm>
    </RecordDialog>
  );
}
