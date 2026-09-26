'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { z } from 'zod';

import type { CatalogSettingsUpdateInput } from '@shared/schemas/catalogAdmin';
import type { AdminCatalogSettingsDto } from '@shared/types/catalogAdmin';

import { PageHeader } from '@/components/patterns/page-header';
import { ErrorState, PermissionNotice, SectionLoader } from '@/components/patterns/states';
import { Alert } from '@/components/ui/alert';
import { endpoints } from '@/lib/api/endpoints';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { catalogApi, catalogKeys } from '../api';
import {
  CheckField,
  EditorForm,
  FieldGrid,
  FormSection,
  NumberField,
  TextField,
  intInput,
  requiredInt,
} from '../form-kit';

import { BADGES, type BadgeCode } from './badges';

const HEX = /^#[0-9a-fA-F]{6}$/;
const badgeSchema = z
  .object({ on: z.boolean(), label: z.string().trim(), color: z.string().trim() })
  .superRefine((value, ctx) => {
    if (!value.on) return;
    if (value.label.length < 1 || value.label.length > 40) {
      ctx.addIssue({ code: 'custom', path: ['label'], message: 'Use 1 to 40 characters' });
    }
    if (value.color !== '' && !HEX.test(value.color)) {
      ctx.addIssue({ code: 'custom', path: ['color'], message: 'Use a hex colour like #8B5A2B' });
    }
  });

const schema = z
  .object({
    defaultPageSize: requiredInt(1, 100, 'Default page size'),
    maxPageSize: requiredInt(1, 200, 'Largest page size'),
    showOutOfStock: z.boolean(),
    newArrivalDays: requiredInt(0, 365, 'New-arrival window'),
    badges: z.object(
      Object.fromEntries(BADGES.map((b) => [b.code, badgeSchema])) as Record<
        BadgeCode,
        typeof badgeSchema
      >,
    ),
  })
  .refine((v) => v.defaultPageSize <= v.maxPageSize, {
    path: ['defaultPageSize'],
    message: 'Cannot be larger than the largest page size',
  });
type Values = z.input<typeof schema>;
type Output = z.output<typeof schema>;

function toValues(settings: AdminCatalogSettingsDto): Values {
  return {
    defaultPageSize: intInput(settings.defaultPageSize),
    maxPageSize: intInput(settings.maxPageSize),
    showOutOfStock: settings.showOutOfStock,
    newArrivalDays: intInput(settings.newArrivalDays),
    badges: Object.fromEntries(
      BADGES.map(({ code }) => {
        const style = settings.badges[code];
        return [code, { on: Boolean(style), label: style?.label ?? '', color: style?.color ?? '' }];
      }),
    ) as Values['badges'],
  };
}

/** Only what changed: the API merges badges per code and treats a missing field as unchanged. */
export function settingsChanges(
  before: AdminCatalogSettingsDto,
  next: Output,
): CatalogSettingsUpdateInput | null {
  const changes: Record<string, unknown> = {};
  for (const key of [
    'defaultPageSize',
    'maxPageSize',
    'showOutOfStock',
    'newArrivalDays',
  ] as const) {
    if (next[key] !== before[key]) changes[key] = next[key];
  }
  const badges: Record<string, { label: string; color: string | null } | null> = {};
  for (const { code } of BADGES) {
    const was = before.badges[code] ?? null;
    const wanted = next.badges[code];
    const now = wanted.on ? { label: wanted.label, color: wanted.color || null } : null;
    if (JSON.stringify(was) !== JSON.stringify(now)) badges[code] = now;
  }
  if (Object.keys(badges).length > 0) changes.badges = badges;
  return Object.keys(changes).length > 0 ? (changes as CatalogSettingsUpdateInput) : null;
}

export function CatalogSettingsScreen() {
  const { canCall } = usePermissions();
  if (!canCall(endpoints.catalog.settings)) {
    return <PermissionNotice area="catalog settings" all={['catalog.product.read']} />;
  }
  return <CatalogSettings />;
}

function CatalogSettings() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: catalogKeys.settings(),
    queryFn: ({ signal }) => catalogApi.settings(signal),
    ...cachePolicy.detail,
  });
  const canEdit = canCall(endpoints.catalog.updateSettings);

  return (
    <>
      <PageHeader
        title="Catalog settings"
        description="How the storefront lists products: page sizes, out-of-stock products, what counts as new, and the words on product badges."
      />
      {settings.isPending ? (
        <SectionLoader label="Loading catalog settings…" />
      ) : settings.error ? (
        <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      ) : (
        <EditorForm<Values, Output, AdminCatalogSettingsDto>
          key={JSON.stringify(settings.data)}
          schema={schema}
          defaultValues={toValues(settings.data)}
          successMessage="Catalog settings saved"
          submitLabel="Save settings"
          readOnly={
            canEdit ? undefined : (
              <Alert tone="info" title="View only">
                Your role can see these settings but not change them.
              </Alert>
            )
          }
          onSubmit={async (values) => {
            const changes = settingsChanges(settings.data, values);
            if (!changes) return;
            const saved = await catalogApi.updateSettings(changes);
            queryClient.setQueryData(catalogKeys.settings(), saved);
            void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
          }}
        >
          <FormSection
            title="Listing pages"
            description="Applies to category, collection and search listings on the storefront."
          >
            <FieldGrid>
              <NumberField<Values>
                name="defaultPageSize"
                label="Products per page"
                required
                description="What a shopper sees before choosing another page size (1–100)."
              />
              <NumberField<Values>
                name="maxPageSize"
                label="Largest page size allowed"
                required
                description="The most products one page may ask for (1–200)."
              />
            </FieldGrid>
            <CheckField<Values>
              name="showOutOfStock"
              label="Show out-of-stock products"
              description="When off, products with no stock and not made to order are left out of listings."
            />
          </FormSection>
          <FormSection
            title="New arrivals"
            description={
              <>
                Products flagged &quot;New arrival&quot; always count. Flags are set per product
                (Merchandising tab) or in bulk from{' '}
                <Link className="underline underline-offset-2" href="/catalog/merchandising">
                  Merchandising
                </Link>
                .
              </>
            }
          >
            <NumberField<Values>
              name="newArrivalDays"
              label="Also new for this many days after publishing"
              unit="days"
              required
              description="0 means only flagged products are new (0–365)."
            />
          </FormSection>
          <FormSection
            title="Product badges"
            description="A badge appears on a product card only when it is switched on here. Leave the colour empty for the storefront's default."
          >
            <div className="flex flex-col gap-3">
              {BADGES.map((badge) => (
                <div key={badge.code} className="flex flex-col gap-3 rounded-md border p-3">
                  <CheckField<Values>
                    name={`badges.${badge.code}.on`}
                    label={`${badge.name} badge`}
                    description={`Shown when a product is ${badge.when}.`}
                    className="border-0 p-0"
                  />
                  <FieldGrid>
                    <TextField<Values>
                      name={`badges.${badge.code}.label`}
                      label="Words on the badge"
                    />
                    <TextField<Values>
                      name={`badges.${badge.code}.color`}
                      label="Colour"
                      placeholder="#8B5A2B"
                    />
                  </FieldGrid>
                </div>
              ))}
            </div>
          </FormSection>
        </EditorForm>
      )}
    </>
  );
}
