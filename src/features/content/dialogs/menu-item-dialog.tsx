'use client';

import { useFormContext } from 'react-hook-form';
import { z } from 'zod';

import { NAVIGATION_MENU_COLUMN_MAX } from '@shared/constants';

import {
  CheckField,
  EditorForm,
  FieldGrid,
  FormSection,
  NumberField,
  SelectField,
  TextField,
  intInput,
  optionalInt,
  optionalText,
  requiredInt,
  requiredText,
  textInput,
} from '../../catalog/form-kit';
import { RecordDialog } from '../../catalog/record-dialog';
import { contentApi, type MenuItemRow } from '../api';
import { useCategoryChoices, useCollectionChoices } from '../lookups';
import { ITEM_TYPE_LABELS } from '../model';

import { optionalMediaId } from './fields';
import { MediaField } from './form-fields';

const LINK = /^(\/(?!\/)|https:\/\/[^\s/]+)/i;

const schema = z
  .object({
    label: requiredText(1, 120, 'Label'),
    type: z.enum(['CATEGORY', 'COLLECTION', 'URL', 'LEAD_FORM', 'PAGE']),
    categoryId: z.string(),
    collectionId: z.string(),
    url: z.string().trim().max(500),
    pageSlug: z.string().trim().toLowerCase().max(140),
    leadFormKey: z.string().trim().max(60),
    parentId: z.string(),
    position: requiredInt(0, 999, 'Order'),
    isActive: z.boolean(),
    isHighlighted: z.boolean(),
    badgeText: optionalText(40),
    badgeColor: optionalText(20),
    iconMediaId: optionalMediaId,
    menuColumn: optionalInt(0, NAVIGATION_MENU_COLUMN_MAX, 'Column'),
    openInNewTab: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const need = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    if (v.type === 'CATEGORY' && !v.categoryId) need('categoryId', 'Choose a category');
    if (v.type === 'COLLECTION' && !v.collectionId) need('collectionId', 'Choose a collection');
    if (v.type === 'URL' && !LINK.test(v.url)) need('url', 'Use /path or an https:// address');
    if (v.type === 'PAGE' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.pageSlug))
      need('pageSlug', "The published page's URL slug, e.g. about-us");
    if (v.type === 'LEAD_FORM' && !v.leadFormKey) need('leadFormKey', 'Enter the form key');
  })
  .transform(({ categoryId, collectionId, url, pageSlug, leadFormKey, parentId, ...rest }) => ({
    ...rest,
    parentId: parentId || null,
    ...(rest.type === 'CATEGORY' ? { categoryId } : {}),
    ...(rest.type === 'COLLECTION' ? { collectionId } : {}),
    ...(rest.type === 'URL' ? { url } : {}),
    ...(rest.type === 'PAGE' ? { pageSlug } : {}),
    ...(rest.type === 'LEAD_FORM' ? { leadFormKey } : {}),
  }));
type Values = z.input<typeof schema>;

function TargetField() {
  const type = useFormContext<Values>().watch('type');
  const categories = useCategoryChoices();
  const collections = useCollectionChoices();
  switch (type) {
    case 'CATEGORY':
      return (
        <SelectField<Values>
          name="categoryId"
          label="Category"
          required
          placeholder="Choose…"
          options={categories}
          description="Must be live on the storefront."
        />
      );
    case 'COLLECTION':
      return (
        <SelectField<Values>
          name="collectionId"
          label="Collection"
          required
          placeholder="Choose…"
          options={collections}
          description="Must be live on the storefront."
        />
      );
    case 'PAGE':
      return (
        <TextField<Values>
          name="pageSlug"
          label="Page URL slug"
          required
          description="The page must be published first."
        />
      );
    case 'LEAD_FORM':
      return (
        <TextField<Values>
          name="leadFormKey"
          label="Form key"
          required
          description="e.g. bulk-order or home-interiors."
        />
      );
    default:
      return (
        <TextField<Values> name="url" label="Link" required description="/path or https://…" />
      );
  }
}

export function MenuItemDialog({
  menuKey,
  row,
  parentId,
  parents,
  onClose,
  onSaved,
}: {
  menuKey: string;
  row: MenuItemRow | null;
  /** For a new sub-item. */
  parentId?: string | null;
  parents: readonly { value: string; label: string }[];
  onClose(): void;
  onSaved(): void;
}) {
  return (
    <RecordDialog title={row ? `Edit "${row.label}"` : 'New menu item'} onClose={onClose} wide>
      <EditorForm
        schema={schema}
        defaultValues={{
          label: textInput(row?.label),
          type: row?.type ?? 'CATEGORY',
          categoryId: row?.categoryId ?? '',
          collectionId: row?.collectionId ?? '',
          url: row?.type === 'URL' ? textInput(row.url) : '',
          pageSlug: row?.type === 'PAGE' ? (row.url ?? '').replace(/^\//, '') : '',
          leadFormKey: textInput(row?.leadFormKey),
          parentId: row?.parentId ?? parentId ?? '',
          position: intInput(row?.position ?? 0),
          isActive: row?.isActive ?? true,
          isHighlighted: row?.isHighlighted ?? false,
          badgeText: textInput(row?.badgeText),
          badgeColor: textInput(row?.badgeColor),
          iconMediaId: textInput(row?.iconMediaId),
          menuColumn: intInput(row?.menuColumn),
          openInNewTab: row?.openInNewTab ?? false,
        }}
        successMessage={row ? 'Menu item saved' : 'Menu item added'}
        submitLabel={row ? 'Save changes' : 'Add item'}
        onSubmit={async (values) => {
          if (row) await contentApi.updateMenuItem(row.id, values);
          else await contentApi.addMenuItem(menuKey, values);
          onSaved();
        }}
      >
        <FieldGrid>
          <TextField<Values> name="label" label="Label" required />
          <SelectField<Values>
            name="type"
            label="Opens"
            options={Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </FieldGrid>
        <TargetField />
        <FieldGrid>
          <SelectField<Values>
            name="parentId"
            label="Inside"
            placeholder="Top level"
            options={parents.filter((p) => p.value !== row?.id)}
            description="Menus nest three levels deep."
          />
          <NumberField<Values> name="position" label="Order" description="Lower comes first." />
        </FieldGrid>
        <FormSection title="Appearance">
          <FieldGrid columns={3}>
            <TextField<Values> name="badgeText" label="Badge" description="e.g. New" />
            <TextField<Values> name="badgeColor" label="Badge colour" />
            <NumberField<Values>
              name="menuColumn"
              label="Column"
              description={`Mega-menu column 0–${NAVIGATION_MENU_COLUMN_MAX}; empty for automatic.`}
            />
          </FieldGrid>
          <MediaField<Values> name="iconMediaId" label="Icon" />
          <FieldGrid columns={3}>
            <CheckField<Values> name="isActive" label="Visible" />
            <CheckField<Values> name="isHighlighted" label="Highlighted" />
            <CheckField<Values> name="openInNewTab" label="Open in a new tab" />
          </FieldGrid>
        </FormSection>
      </EditorForm>
    </RecordDialog>
  );
}
