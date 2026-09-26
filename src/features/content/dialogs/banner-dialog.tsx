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
  dateTimeInput,
  intInput,
  optionalDateTime,
  optionalText,
  requiredInt,
  requiredText,
  textInput,
} from '../../catalog/form-kit';
import { RecordDialog } from '../../catalog/record-dialog';
import { contentApi, type BannerRow } from '../api';
import { useCategoryChoices, useCollectionChoices } from '../lookups';
import { DEVICE_LABELS, PLACEMENT_LABELS, options, parseIds } from '../model';

import { optionalHex, optionalLink, optionalMediaId } from './fields';
import { ChecklistField, MediaField } from './form-fields';

const schema = z.object({
  name: requiredText(1, 160, 'Name'),
  placement: z.enum([
    'HOME_HERO',
    'HOME_STRIP',
    'CATEGORY_TOP',
    'PDP_SIDEBAR',
    'CART_PROMO',
    'CHECKOUT',
    'ANNOUNCEMENT_BAR',
    'POPUP',
    'FOOTER',
  ]),
  mediaId: optionalMediaId,
  mobileMediaId: optionalMediaId,
  altText: optionalText(200),
  headline: optionalText(200),
  subheadline: optionalText(600),
  ctaLabel: optionalText(60),
  ctaUrl: optionalLink,
  ctaStyle: z.enum(['', 'PRIMARY', 'SECONDARY', 'LINK']).transform((v) => (v === '' ? null : v)),
  backgroundHex: optionalHex,
  textHex: optionalHex,
  position: requiredInt(0, 999, 'Order'),
  isActive: z.boolean(),
  deviceVisibility: z.enum(['ALL', 'DESKTOP_ONLY', 'MOBILE_ONLY']),
  startsAt: optionalDateTime(),
  endsAt: optionalDateTime(),
  targetCategoryIds: z.array(z.string()).max(50, 'At most 50 categories'),
  targetCollectionIds: z.array(z.string()).max(50, 'At most 50 collections'),
});
type Values = z.input<typeof schema>;

export function BannerDialog({
  row,
  onClose,
  onSaved,
}: {
  row: BannerRow | null;
  onClose(): void;
  onSaved(): void;
}) {
  const categories = useCategoryChoices();
  const collections = useCollectionChoices();
  return (
    <RecordDialog title={row ? `Edit ${row.name}` : 'New banner'} onClose={onClose} wide>
      <EditorForm
        schema={schema}
        defaultValues={{
          name: textInput(row?.name),
          placement: (row?.placement as Values['placement']) ?? 'HOME_HERO',
          mediaId: textInput(row?.mediaId),
          mobileMediaId: textInput(row?.mobileMediaId),
          altText: textInput(row?.altText),
          headline: textInput(row?.headline),
          subheadline: textInput(row?.subheadline),
          ctaLabel: textInput(row?.ctaLabel),
          ctaUrl: textInput(row?.ctaUrl),
          ctaStyle: (row?.ctaStyle as Values['ctaStyle']) ?? '',
          backgroundHex: textInput(row?.backgroundHex),
          textHex: textInput(row?.textHex),
          position: intInput(row?.position ?? 0),
          isActive: row?.isActive ?? true,
          deviceVisibility: (row?.deviceVisibility as Values['deviceVisibility']) ?? 'ALL',
          startsAt: dateTimeInput(row?.startsAt),
          endsAt: dateTimeInput(row?.endsAt),
          targetCategoryIds: parseIds(row?.targetCategoryIdsJson),
          targetCollectionIds: parseIds(row?.targetCollectionIdsJson),
        }}
        successMessage={row ? 'Banner saved' : 'Banner created'}
        submitLabel={row ? 'Save changes' : 'Create banner'}
        onSubmit={async ({ targetCategoryIds, targetCollectionIds, ...values }) => {
          const body = {
            ...values,
            targetCategoryIds: targetCategoryIds.length ? targetCategoryIds : null,
            targetCollectionIds: targetCollectionIds.length ? targetCollectionIds : null,
          };
          if (row) await contentApi.updateBanner(row.id, { ...body, version: row.version });
          else await contentApi.createBanner(body);
          onSaved();
        }}
      >
        <FieldGrid>
          <TextField<Values> name="name" label="Name" required description="Internal only." />
          <SelectField<Values>
            name="placement"
            label="Where it appears"
            options={options(PLACEMENT_LABELS)}
          />
        </FieldGrid>
        <FormSection title="Images">
          <MediaField<Values> name="mediaId" label="Image" />
          <MediaField<Values>
            name="mobileMediaId"
            label="Phone image"
            description="Optional: a taller crop for phones."
          />
          <TextField<Values>
            name="altText"
            label="Image description"
            description="Read aloud by screen readers."
          />
        </FormSection>
        <FormSection title="Text and button">
          <TextField<Values> name="headline" label="Headline" />
          <TextAreaField<Values> name="subheadline" label="Subheading" rows={2} />
          <FieldGrid columns={3}>
            <TextField<Values> name="ctaLabel" label="Button text" />
            <TextField<Values> name="ctaUrl" label="Button link" description="/path or https://" />
            <SelectField<Values>
              name="ctaStyle"
              label="Button style"
              options={[
                { value: '', label: 'Default' },
                { value: 'PRIMARY', label: 'Primary' },
                { value: 'SECONDARY', label: 'Secondary' },
                { value: 'LINK', label: 'Text link' },
              ]}
            />
            <TextField<Values>
              name="backgroundHex"
              label="Background colour"
              placeholder="#f5f5f4"
            />
            <TextField<Values> name="textHex" label="Text colour" placeholder="#111827" />
          </FieldGrid>
        </FormSection>
        <FormSection title="When and where">
          <FieldGrid>
            <TextField<Values> name="startsAt" label="Show from" type="datetime-local" />
            <TextField<Values> name="endsAt" label="Show until" type="datetime-local" />
            <SelectField<Values>
              name="deviceVisibility"
              label="Devices"
              options={options(DEVICE_LABELS)}
            />
            <NumberField<Values> name="position" label="Order" description="Lower comes first." />
          </FieldGrid>
          <CheckField<Values> name="isActive" label="On" />
          <FieldGrid>
            <ChecklistField<Values>
              name="targetCategoryIds"
              label="Only in these categories"
              description="None ticked: everywhere in this placement."
              choices={categories}
              emptyText="Categories are not available to your role."
            />
            <ChecklistField<Values>
              name="targetCollectionIds"
              label="Only in these collections"
              description="None ticked: everywhere in this placement."
              choices={collections}
              emptyText="Collections are not available to your role."
            />
          </FieldGrid>
        </FormSection>
      </EditorForm>
    </RecordDialog>
  );
}
