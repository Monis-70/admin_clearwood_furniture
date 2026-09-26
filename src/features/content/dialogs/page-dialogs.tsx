'use client';

import { z } from 'zod';

import { EditorForm, SelectField, TextField, requiredText } from '../../catalog/form-kit';
import { RecordDialog } from '../../catalog/record-dialog';
import { contentApi, type CmsPage, type CmsPageRow } from '../api';
import { PAGE_TYPE_LABELS, options } from '../model';

import { slugField } from './fields';

const createSchema = z.object({
  title: requiredText(1, 200, 'Title'),
  slug: slugField,
  type: z.enum(['STANDARD', 'LANDING', 'POLICY', 'HOME', 'CATEGORY_LANDING', 'HELP']),
});
type CreateValues = z.input<typeof createSchema>;

/** A new page starts as an empty draft; blocks and publishing happen in the editor. */
export function NewPageDialog({
  onClose,
  onCreated,
}: {
  onClose(): void;
  onCreated(page: CmsPage): void;
}) {
  return (
    <RecordDialog
      title="New page"
      description="It starts as a draft with no blocks."
      onClose={onClose}
    >
      <EditorForm
        schema={createSchema}
        defaultValues={{ title: '', slug: '', type: 'STANDARD' }}
        successMessage="Page created"
        submitLabel="Create page"
        onSubmit={async (values) => onCreated(await contentApi.createPage(values))}
      >
        <TextField<CreateValues> name="title" label="Title" required />
        <TextField<CreateValues>
          name="slug"
          label="URL slug"
          required
          description="The address: /summer-sale for summer-sale. Cannot clash with another page."
        />
        <SelectField<CreateValues> name="type" label="Type" options={options(PAGE_TYPE_LABELS)} />
      </EditorForm>
    </RecordDialog>
  );
}

const duplicateSchema = z.object({ title: requiredText(1, 200, 'Title'), slug: slugField });
type DuplicateValues = z.input<typeof duplicateSchema>;

export function DuplicatePageDialog({
  page,
  onClose,
  onCreated,
}: {
  page: CmsPageRow;
  onClose(): void;
  onCreated(page: CmsPage): void;
}) {
  return (
    <RecordDialog
      title={`Duplicate "${page.title}"`}
      description="The copy has the same blocks and settings, starts as a draft and has no history."
      onClose={onClose}
    >
      <EditorForm
        schema={duplicateSchema}
        defaultValues={{ title: `${page.title} (copy)`, slug: `${page.slug}-copy` }}
        successMessage="Page duplicated"
        submitLabel="Duplicate"
        onSubmit={async (values) => onCreated(await contentApi.duplicatePage(page.id, values))}
      >
        <TextField<DuplicateValues> name="title" label="Title" required />
        <TextField<DuplicateValues> name="slug" label="URL slug" required />
      </EditorForm>
    </RecordDialog>
  );
}
