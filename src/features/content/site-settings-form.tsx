'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { PageHeader } from '@/components/patterns/page-header';
import { ErrorState, SectionLoader } from '@/components/patterns/states';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/surface';
import { contentRoutes } from '@/lib/api/routes/content';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import {
  CheckField,
  EditorForm,
  FieldGrid,
  FormProblem,
  FormSection,
  TextAreaField,
  TextField,
} from '../catalog/form-kit';

import { contentApi, contentKeys, type SiteSettings } from './api';
import { MediaField } from './dialogs/form-fields';
import { SitemapCard } from './sitemap-card';

const text = (max: number) => z.string().trim().max(max, `Use at most ${max} characters`);

/** The keys the API lets the content screen write (content.service WRITABLE_SETTINGS). */
const schema = z.object({
  site__contact_phone: text(40),
  site__whatsapp_number: text(20),
  site__support_email: text(160),
  site__address: text(400),
  site__gstin_display: text(20),
  site__business_hours: text(300),
  site__social__instagram: text(300),
  site__social__facebook: text(300),
  site__social__youtube: text(300),
  site__social__pinterest: text(300),
  site__social__linkedin: text(300),
  site__announcement_enabled: z.boolean(),
  site__newsletter_enabled: z.boolean(),
  seo__default_title_template: text(200),
  seo__default_description: text(400),
  seo__og_default_media_id: text(40),
  seo__robots_extra: text(2_000),
  seo__google_site_verification: text(200),
  cms__whitelisted_iframe_hosts: text(1_000),
});
type Values = z.infer<typeof schema>;
type Key = keyof Values;
const KEYS = Object.keys(schema.shape) as Key[];
const BOOLEAN_KEYS = new Set<Key>(['site__announcement_enabled', 'site__newsletter_enabled']);
/** Form field names use "__" because react-hook-form reads dots as nesting. */
const apiKey = (field: Key) => field.replace(/__/g, '.');

function toForm(settings: SiteSettings): Values {
  return Object.fromEntries(
    KEYS.map((key) => {
      const v = settings[apiKey(key)];
      return [
        key,
        BOOLEAN_KEYS.has(key)
          ? v === true || v === 'true'
          : v === null || v === undefined
            ? ''
            : String(v),
      ];
    }),
  ) as Values;
}

/** Loaded by the site settings screen after the page, so the form stack is not in its first load. */
export function SiteSettingsForm() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: contentKeys.settings(),
    queryFn: ({ signal }) => contentApi.settings(signal),
    ...cachePolicy.config,
  });
  const canEdit = canCall(contentRoutes.updateSettings);

  return (
    <>
      <PageHeader
        title="Site & SEO settings"
        description="Contact details, social links and search-engine defaults used across the storefront."
      />
      {settings.isPending ? (
        <SectionLoader label="Loading settings…" />
      ) : settings.error ? (
        <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      ) : (
        <div className="flex flex-col gap-6">
          <EditorForm
            key={JSON.stringify(settings.data)}
            schema={schema}
            defaultValues={toForm(settings.data)}
            successMessage="Settings saved"
            readOnly={
              canEdit ? undefined : (
                <Alert tone="info" title="Read-only">
                  Changing these needs the system.setting.update permission.
                </Alert>
              )
            }
            onSubmit={async (values) => {
              const before = toForm(settings.data);
              const changed = Object.fromEntries(
                KEYS.filter((key) => values[key] !== before[key]).map((key) => [
                  apiKey(key),
                  values[key],
                ]),
              ) as SiteSettings;
              if (Object.keys(changed).length === 0) throw new FormProblem(['Nothing changed.']);
              const saved = await contentApi.updateSettings(changed);
              queryClient.setQueryData(contentKeys.settings(), saved);
            }}
          >
            <FormSection title="Contact">
              <FieldGrid>
                <TextField<Values> name="site__contact_phone" label="Phone" />
                <TextField<Values>
                  name="site__whatsapp_number"
                  label="WhatsApp number"
                  description="Digits with country code, e.g. 919876543210."
                />
                <TextField<Values> name="site__support_email" label="Support email" type="email" />
                <TextField<Values> name="site__gstin_display" label="GSTIN shown in the footer" />
              </FieldGrid>
              <TextAreaField<Values> name="site__address" label="Address" rows={2} />
              <TextField<Values> name="site__business_hours" label="Business hours" />
            </FormSection>
            <FormSection title="Social links">
              <FieldGrid>
                <TextField<Values> name="site__social__instagram" label="Instagram" />
                <TextField<Values> name="site__social__facebook" label="Facebook" />
                <TextField<Values> name="site__social__youtube" label="YouTube" />
                <TextField<Values> name="site__social__pinterest" label="Pinterest" />
                <TextField<Values> name="site__social__linkedin" label="LinkedIn" />
              </FieldGrid>
            </FormSection>
            <FormSection title="Storefront features">
              <FieldGrid>
                <CheckField<Values>
                  name="site__announcement_enabled"
                  label="Show the announcement bar"
                  description="Announcements are managed under Content › Announcements."
                />
                <CheckField<Values>
                  name="site__newsletter_enabled"
                  label="Show newsletter sign-up"
                />
              </FieldGrid>
            </FormSection>
            <FormSection title="Search engines">
              <TextField<Values>
                name="seo__default_title_template"
                label="Title template"
                description='"%s" is replaced by the page title, e.g. "%s | ClearWood".'
              />
              <TextAreaField<Values>
                name="seo__default_description"
                label="Default description"
                rows={2}
              />
              <MediaField<Values>
                name="seo__og_default_media_id"
                label="Default sharing image"
                description="Used when a page has no image of its own."
              />
              <FieldGrid>
                <TextField<Values>
                  name="seo__google_site_verification"
                  label="Google site verification code"
                />
                <TextField<Values>
                  name="cms__whitelisted_iframe_hosts"
                  label="Allowed video hosts"
                  description="Comma-separated, e.g. www.youtube.com,player.vimeo.com"
                />
              </FieldGrid>
              <TextAreaField<Values>
                name="seo__robots_extra"
                label="Extra robots.txt lines"
                rows={3}
              />
            </FormSection>
          </EditorForm>
          {settings.data['site.usp_lines'] !== undefined ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Selling-point lines</CardTitle>
                <CardDescription>
                  Stored as a list; this API accepts only single values, so the list cannot be
                  changed here yet.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(settings.data['site.usp_lines'], null, 2)}
                </pre>
              </CardContent>
            </Card>
          ) : null}
          {canCall(contentRoutes.rebuildSitemap) ? <SitemapCard /> : null}
        </div>
      )}
    </>
  );
}
