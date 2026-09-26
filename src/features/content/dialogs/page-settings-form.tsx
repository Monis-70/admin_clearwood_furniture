'use client';

import { z } from 'zod';

import {
  CheckField,
  EditorForm,
  FieldGrid,
  FormSection,
  SelectField,
  TextAreaField,
  TextField,
  optionalText,
  requiredText,
  textInput,
} from '../../catalog/form-kit';
import { contentApi, type CmsPage } from '../api';
import { PAGE_TYPE_LABELS, options } from '../model';

import { optionalLink, optionalMediaId, slugField } from './fields';
import { MediaField } from './form-fields';

const schema = z.object({
  title: requiredText(1, 200, 'Title'),
  slug: slugField,
  type: z.enum(['STANDARD', 'LANDING', 'POLICY', 'HOME', 'CATEGORY_LANDING', 'HELP']),
  template: optionalText(60),
  excerpt: optionalText(500),
  heroMediaId: optionalMediaId,
  ogMediaId: optionalMediaId,
  seoTitle: optionalText(200),
  seoDescription: optionalText(400),
  seoKeywords: optionalText(400),
  canonicalUrl: optionalLink,
  noIndex: z.boolean(),
});
type Values = z.input<typeof schema>;

/** Page details and SEO fields; saved with the page version, so a parallel edit is refused. */
export function PageSettingsForm({
  page,
  readOnly,
  onSaved,
}: {
  page: CmsPage;
  readOnly: boolean;
  onSaved(page: CmsPage): void;
}) {
  return (
    <EditorForm
      key={`${page.id}:${page.version}`}
      schema={schema}
      defaultValues={{
        title: page.title,
        slug: page.slug,
        type: page.type as Values['type'],
        template: textInput(page.template),
        excerpt: textInput(page.excerpt),
        heroMediaId: textInput(page.heroMediaId),
        ogMediaId: textInput(page.ogMediaId),
        seoTitle: textInput(page.seoTitle),
        seoDescription: textInput(page.seoDescription),
        seoKeywords: textInput(page.seoKeywords),
        canonicalUrl: textInput(page.canonicalUrl),
        noIndex: page.noIndex,
      }}
      successMessage="Page settings saved"
      readOnly={
        readOnly ? (
          <p className="text-sm text-muted-foreground">
            Changing pages needs the cms.page.update permission.
          </p>
        ) : undefined
      }
      onSubmit={async (values) => {
        onSaved(await contentApi.updatePage(page.id, { ...values, version: page.version }));
      }}
    >
      <FormSection title="Page">
        <FieldGrid>
          <TextField<Values> name="title" label="Title" required />
          <TextField<Values>
            name="slug"
            label="URL slug"
            required
            description={
              page.isSystem
                ? 'The storefront relies on this page; change the slug with care.'
                : undefined
            }
          />
          <SelectField<Values> name="type" label="Type" options={options(PAGE_TYPE_LABELS)} />
          <TextField<Values> name="template" label="Template" description="Optional layout name." />
        </FieldGrid>
        <TextAreaField<Values> name="excerpt" label="Summary" rows={2} />
        <MediaField<Values> name="heroMediaId" label="Header image" />
      </FormSection>
      <FormSection title="Search engines and sharing">
        <TextField<Values> name="seoTitle" label="SEO title" description="Empty: the page title." />
        <TextAreaField<Values> name="seoDescription" label="SEO description" rows={2} />
        <TextField<Values> name="seoKeywords" label="Keywords" />
        <TextField<Values>
          name="canonicalUrl"
          label="Canonical address"
          description="Only when this page duplicates another address."
        />
        <MediaField<Values> name="ogMediaId" label="Sharing image" />
        <CheckField<Values>
          name="noIndex"
          label="Hide from search engines"
          description="Asks search engines not to list this page; it also leaves the sitemap."
        />
      </FormSection>
    </EditorForm>
  );
}
