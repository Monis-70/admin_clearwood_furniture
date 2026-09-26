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
  intInput,
  optionalText,
  requiredInt,
  requiredText,
  textInput,
} from '../../catalog/form-kit';
import { RecordDialog } from '../../catalog/record-dialog';
import { contentApi, type FaqCategoryRow, type FaqRow } from '../api';
import { MediaField } from './form-fields';
import { FAQ_VISIBILITY_LABELS, options, parseIds } from '../model';

import { idLines, optionalMediaId, slugField } from './fields';

const faqSchema = z.object({
  faqCategoryId: z.string().transform((v) => (v === '' ? null : v)),
  question: requiredText(1, 300, 'Question'),
  answer: requiredText(1, 8_000, 'Answer'),
  visibility: z.enum([
    'GLOBAL',
    'PRODUCT',
    'CATEGORY',
    'ORDER',
    'SHIPPING',
    'PAYMENT',
    'WARRANTY',
    'CARE',
  ]),
  position: requiredInt(0, 999, 'Order'),
  isActive: z.boolean(),
  targetProductIds: idLines(100),
  targetCategoryIds: idLines(100),
});
type FaqValues = z.input<typeof faqSchema>;

export function FaqDialog({
  row,
  categories,
  defaultCategoryId,
  onClose,
  onSaved,
}: {
  row: FaqRow | null;
  categories: readonly FaqCategoryRow[];
  defaultCategoryId?: string;
  onClose(): void;
  onSaved(): void;
}) {
  return (
    <RecordDialog title={row ? 'Edit question' : 'New question'} onClose={onClose} wide>
      <EditorForm
        schema={faqSchema}
        defaultValues={{
          faqCategoryId: row?.faqCategoryId ?? defaultCategoryId ?? '',
          question: textInput(row?.question),
          answer: textInput(row?.answer),
          visibility: (row?.visibility as FaqValues['visibility']) ?? 'GLOBAL',
          position: intInput(row?.position ?? 0),
          isActive: row?.isActive ?? true,
          targetProductIds: parseIds(row?.targetProductIdsJson).join('\n'),
          targetCategoryIds: parseIds(row?.targetCategoryIdsJson).join('\n'),
        }}
        successMessage={row ? 'Question saved' : 'Question created'}
        submitLabel={row ? 'Save changes' : 'Create question'}
        onSubmit={async ({ targetProductIds, targetCategoryIds, ...values }) => {
          const body = {
            ...values,
            targetProductIds: targetProductIds.length ? targetProductIds : null,
            targetCategoryIds: targetCategoryIds.length ? targetCategoryIds : null,
          };
          if (row) await contentApi.updateFaq(row.id, { ...body, version: row.version });
          else await contentApi.createFaq(body);
          onSaved();
        }}
      >
        <TextField<FaqValues> name="question" label="Question" required />
        <TextAreaField<FaqValues>
          name="answer"
          label="Answer"
          rows={6}
          required
          description="Plain text; formatting and links are removed when saved."
        />
        <FieldGrid>
          <SelectField<FaqValues>
            name="faqCategoryId"
            label="Group"
            placeholder="No group"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <SelectField<FaqValues>
            name="visibility"
            label="Shown on"
            options={options(FAQ_VISIBILITY_LABELS)}
          />
          <NumberField<FaqValues> name="position" label="Order" description="Lower comes first." />
          <CheckField<FaqValues> name="isActive" label="Visible" />
        </FieldGrid>
        <FormSection
          title="Only for some products or categories"
          description="Optional. With IDs here, product and category pages show this question only for them."
        >
          <FieldGrid>
            <TextAreaField<FaqValues>
              name="targetProductIds"
              label="Product IDs"
              rows={3}
              description="One per line."
            />
            <TextAreaField<FaqValues>
              name="targetCategoryIds"
              label="Category IDs"
              rows={3}
              description="One per line."
            />
          </FieldGrid>
        </FormSection>
      </EditorForm>
    </RecordDialog>
  );
}

const categorySchema = z.object({
  name: requiredText(1, 120, 'Name'),
  slug: slugField,
  description: optionalText(600),
  iconMediaId: optionalMediaId,
  position: requiredInt(0, 999, 'Order'),
  isActive: z.boolean(),
});
type CategoryValues = z.input<typeof categorySchema>;

export function FaqCategoryDialog({
  row,
  onClose,
  onSaved,
}: {
  row: FaqCategoryRow | null;
  onClose(): void;
  onSaved(): void;
}) {
  return (
    <RecordDialog title={row ? `Edit ${row.name}` : 'New question group'} onClose={onClose}>
      <EditorForm
        schema={categorySchema}
        defaultValues={{
          name: textInput(row?.name),
          slug: textInput(row?.slug),
          description: textInput(row?.description),
          iconMediaId: textInput(row?.iconMediaId),
          position: intInput(row?.position ?? 0),
          isActive: row?.isActive ?? true,
        }}
        successMessage={row ? 'Group saved' : 'Group created'}
        submitLabel={row ? 'Save changes' : 'Create group'}
        onSubmit={async (values) => {
          if (row) await contentApi.updateFaqCategory(row.id, { ...values, version: row.version });
          else await contentApi.createFaqCategory(values);
          onSaved();
        }}
      >
        <TextField<CategoryValues> name="name" label="Name" required />
        <TextField<CategoryValues> name="slug" label="URL slug" required />
        <TextAreaField<CategoryValues> name="description" label="Description" rows={2} />
        <MediaField<CategoryValues> name="iconMediaId" label="Icon" />
        <FieldGrid>
          <NumberField<CategoryValues>
            name="position"
            label="Order"
            description="Lower comes first."
          />
          <CheckField<CategoryValues> name="isActive" label="Visible" />
        </FieldGrid>
      </EditorForm>
    </RecordDialog>
  );
}
