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
import { contentApi, type HelpArticleRow, type HelpCategoryNode } from '../api';
import { ChecklistField, MediaField } from './form-fields';
import { CONTENT_STATUS_LABELS, flattenHelp, options, parseIds } from '../model';

import { optionalMediaId, slugField } from './fields';

const categorySchema = z.object({
  name: requiredText(1, 120, 'Name'),
  slug: slugField,
  description: optionalText(600),
  iconMediaId: optionalMediaId,
  parentId: z.string().transform((v) => (v === '' ? null : v)),
  position: requiredInt(0, 999, 'Order'),
  isActive: z.boolean(),
});
type CategoryValues = z.input<typeof categorySchema>;

export function HelpCategoryDialog({
  row,
  tree,
  onClose,
  onSaved,
}: {
  row: HelpCategoryNode | null;
  tree: readonly HelpCategoryNode[];
  onClose(): void;
  onSaved(): void;
}) {
  const parents = [...tree].sort((a, b) => a.position - b.position).filter((c) => c.id !== row?.id);
  return (
    <RecordDialog title={row ? `Edit ${row.name}` : 'New help category'} onClose={onClose}>
      <EditorForm
        schema={categorySchema}
        defaultValues={{
          name: textInput(row?.name),
          slug: textInput(row?.slug),
          description: textInput(row?.description),
          iconMediaId: textInput(row?.iconMediaId),
          parentId: row?.parentId ?? '',
          position: intInput(row?.position ?? 0),
          isActive: row?.isActive ?? true,
        }}
        successMessage={row ? 'Category saved' : 'Category created'}
        submitLabel={row ? 'Save changes' : 'Create category'}
        onSubmit={async (values) => {
          if (row) await contentApi.updateHelpCategory(row.id, { ...values, version: row.version });
          else await contentApi.createHelpCategory(values);
          onSaved();
        }}
      >
        <TextField<CategoryValues> name="name" label="Name" required />
        <TextField<CategoryValues> name="slug" label="URL slug" required />
        <SelectField<CategoryValues>
          name="parentId"
          label="Inside"
          placeholder="Top level"
          options={parents.map((c) => ({ value: c.id, label: c.name }))}
          description="Help categories nest two levels deep."
        />
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

const articleSchema = z.object({
  helpCategoryId: z.string().min(1, 'Choose a category'),
  slug: slugField,
  title: requiredText(1, 200, 'Title'),
  excerpt: optionalText(500),
  bodyMarkdown: z.string().min(1, 'Write the article').max(60_000),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  position: requiredInt(0, 999, 'Order'),
  relatedArticleIds: z.array(z.string()).max(20, 'At most 20 related articles'),
  seoTitle: optionalText(200),
  seoDescription: optionalText(400),
});
type ArticleValues = z.input<typeof articleSchema>;

export function HelpArticleDialog({
  row,
  tree,
  articles,
  defaultCategoryId,
  onClose,
  onSaved,
}: {
  row: HelpArticleRow | null;
  tree: readonly HelpCategoryNode[];
  articles: readonly HelpArticleRow[];
  defaultCategoryId?: string;
  onClose(): void;
  onSaved(): void;
}) {
  return (
    <RecordDialog title={row ? `Edit "${row.title}"` : 'New help article'} onClose={onClose} wide>
      <EditorForm
        schema={articleSchema}
        defaultValues={{
          helpCategoryId: row?.helpCategoryId ?? defaultCategoryId ?? '',
          slug: textInput(row?.slug),
          title: textInput(row?.title),
          excerpt: textInput(row?.excerpt),
          bodyMarkdown: textInput(row?.bodyMarkdown),
          status: row?.status ?? 'DRAFT',
          position: intInput(row?.position ?? 0),
          relatedArticleIds: parseIds(row?.relatedArticleIdsJson),
          seoTitle: textInput(row?.seoTitle),
          seoDescription: textInput(row?.seoDescription),
        }}
        successMessage={row ? 'Article saved' : 'Article created'}
        submitLabel={row ? 'Save changes' : 'Create article'}
        onSubmit={async ({ relatedArticleIds, ...values }) => {
          const body = {
            ...values,
            relatedArticleIds: relatedArticleIds.length ? relatedArticleIds : null,
          };
          if (row) await contentApi.updateHelpArticle(row.id, { ...body, version: row.version });
          else await contentApi.createHelpArticle(body);
          onSaved();
        }}
      >
        <FieldGrid>
          <TextField<ArticleValues> name="title" label="Title" required />
          <TextField<ArticleValues> name="slug" label="URL slug" required />
          <SelectField<ArticleValues>
            name="helpCategoryId"
            label="Category"
            required
            placeholder="Choose…"
            options={flattenHelp(tree).map((c) => ({
              value: c.id,
              label: `${'— '.repeat(c.level)}${c.name}`,
            }))}
          />
          <SelectField<ArticleValues>
            name="status"
            label="Status"
            options={options(CONTENT_STATUS_LABELS)}
          />
        </FieldGrid>
        <TextAreaField<ArticleValues> name="excerpt" label="Summary" rows={2} />
        <TextAreaField<ArticleValues>
          name="bodyMarkdown"
          label="Article"
          rows={14}
          required
          description="Markdown: # heading, **bold**, - list, [link](/path). Unsafe HTML is removed when saved."
        />
        <ChecklistField<ArticleValues>
          name="relatedArticleIds"
          label="Related articles"
          choices={articles
            .filter((a) => a.id !== row?.id)
            .map((a) => ({ value: a.id, label: a.title }))}
        />
        <FormSection title="Search engines">
          <TextField<ArticleValues>
            name="seoTitle"
            label="SEO title"
            description="Empty: the title."
          />
          <TextAreaField<ArticleValues> name="seoDescription" label="SEO description" rows={2} />
        </FormSection>
        <NumberField<ArticleValues>
          name="position"
          label="Order"
          description="Lower comes first."
        />
      </EditorForm>
    </RecordDialog>
  );
}
