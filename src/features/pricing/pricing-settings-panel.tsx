'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import type { PricingSettingsUpdateInput } from '@shared/schemas/pricing';
import type { PricingSettings } from '@shared/types/pricing';

import { ErrorState, SectionLoader } from '@/components/patterns/states';
import { Alert } from '@/components/ui/alert';
import { pricingRoutes } from '@/lib/api/routes/pricing';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import {
  CheckField,
  EditorForm,
  FieldGrid,
  FormSection,
  MoneyField,
  SelectField,
  TextField,
  paiseInput,
  rupees,
} from '../catalog/form-kit';
import { useTaxClassOptions } from '../catalog/lookups';
import { formatRupees } from '../catalog/model';

import { percent } from './lookups';
import { rulesApi, rulesKeys } from './rules-api';

const STATE = /^[A-Z0-9]{2}$/;
const schema = z.object({
  pricesIncludeTax: z.boolean(),
  sellerStateCode: z.string().trim().toUpperCase().regex(STATE, 'Two characters, e.g. 27'),
  defaultPlaceOfSupply: z.string().trim().toUpperCase().regex(STATE, 'Two characters, e.g. 27'),
  shippingTaxable: z.boolean(),
  shippingTaxClassCode: z.string(),
  roundTotalToRupee: z.boolean(),
  freeShippingThresholdPaise: rupees('Free delivery threshold'),
  showSavingsBadge: z.boolean(),
  minOrderValuePaise: rupees('Minimum order value'),
});
type Values = z.input<typeof schema>;
type Output = z.output<typeof schema>;

/** Only the settings that changed; the shipping tax class is sent only when one is chosen. */
export function pricingSettingsChanges(
  before: PricingSettings,
  next: Output,
): PricingSettingsUpdateInput | null {
  const changes: Record<string, unknown> = {};
  for (const key of [
    'pricesIncludeTax',
    'sellerStateCode',
    'defaultPlaceOfSupply',
    'shippingTaxable',
    'roundTotalToRupee',
    'freeShippingThresholdPaise',
    'showSavingsBadge',
    'minOrderValuePaise',
  ] as const) {
    if (next[key] !== before[key]) changes[key] = next[key];
  }
  if (next.shippingTaxClassCode) changes.shippingTaxClassCode = next.shippingTaxClassCode;
  return Object.keys(changes).length > 0 ? (changes as PricingSettingsUpdateInput) : null;
}

/** Store-wide GST and checkout settings the pricing engine reads. */
export function PricingSettingsPanel() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const taxClasses = useTaxClassOptions();
  const settings = useQuery({
    queryKey: rulesKeys.settings(),
    queryFn: ({ signal }) => rulesApi.settings(signal),
    ...cachePolicy.detail,
  });
  const canEdit = canCall(pricingRoutes.updateSettings);

  if (settings.isPending) return <SectionLoader label="Loading pricing settings…" />;
  if (settings.error)
    return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;

  return (
    <EditorForm<Values, Output, PricingSettings>
      key={JSON.stringify(settings.data)}
      schema={schema}
      defaultValues={{
        pricesIncludeTax: settings.data.pricesIncludeTax,
        sellerStateCode: settings.data.sellerStateCode,
        defaultPlaceOfSupply: settings.data.defaultPlaceOfSupply,
        shippingTaxable: settings.data.shippingTaxable,
        shippingTaxClassCode: '',
        roundTotalToRupee: settings.data.roundTotalToRupee,
        freeShippingThresholdPaise: paiseInput(settings.data.freeShippingThresholdPaise),
        showSavingsBadge: settings.data.showSavingsBadge,
        minOrderValuePaise: paiseInput(settings.data.minOrderValuePaise),
      }}
      successMessage="Pricing settings saved"
      submitLabel="Save settings"
      readOnly={
        canEdit ? undefined : (
          <Alert tone="info" title="View only">
            Your role can see these settings but not change them.
          </Alert>
        )
      }
      onSubmit={async (values) => {
        const changes = pricingSettingsChanges(settings.data, values);
        if (!changes) return;
        const saved = await rulesApi.updateSettings(changes);
        queryClient.setQueryData(rulesKeys.settings(), saved);
      }}
    >
      <FormSection
        title="GST"
        description="How tax is shown and which GST applies (CGST + SGST within the seller's state, IGST otherwise)."
      >
        <CheckField<Values>
          name="pricesIncludeTax"
          label="Prices include GST"
          description="When off, GST is added on top of catalog prices."
        />
        <FieldGrid>
          <TextField<Values>
            name="sellerStateCode"
            label="Seller's GST state code"
            required
            description="The state you ship from."
          />
          <TextField<Values>
            name="defaultPlaceOfSupply"
            label="Default place of supply"
            required
            description="Used when the buyer's state is not known."
          />
        </FieldGrid>
      </FormSection>
      <FormSection title="Delivery and totals">
        <FieldGrid>
          <CheckField<Values> name="shippingTaxable" label="Charge GST on delivery" />
          <SelectField<Values>
            name="shippingTaxClassCode"
            label="GST class for delivery"
            placeholder={`Keep the current rate (${percent(settings.data.shippingTaxRateBp)})`}
            options={(taxClasses.data ?? [])
              .filter((t) => t.isActive)
              .map((t) => ({ value: t.code, label: `${t.name} (${percent(t.rateBp)})` }))}
          />
        </FieldGrid>
        <FieldGrid>
          <MoneyField<Values>
            name="freeShippingThresholdPaise"
            label="Free delivery above"
            required
            description={`Currently ${formatRupees(settings.data.freeShippingThresholdPaise)}. 0 turns it off.`}
          />
          <MoneyField<Values>
            name="minOrderValuePaise"
            label="Minimum order value"
            required
            description="0 means no minimum."
          />
        </FieldGrid>
        <FieldGrid>
          <CheckField<Values>
            name="roundTotalToRupee"
            label="Round the total to the nearest rupee"
          />
          <CheckField<Values>
            name="showSavingsBadge"
            label="Show the savings badge"
            description="The 'You save' label on products with a compare-at price."
          />
        </FieldGrid>
      </FormSection>
    </EditorForm>
  );
}
