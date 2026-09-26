'use client';

import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import type { AdminProductDetailDto } from '@shared/types/catalogAdmin';

import { productsRoutes } from '@/lib/api/routes/products';
import { usePermissions } from '@/lib/permissions/use-permissions';

import {
  CheckField,
  EditorForm,
  FieldGrid,
  FormSection,
  NumberField,
  TextAreaField,
  intInput,
  optionalInt,
  optionalText,
  requiredInt,
  textInput,
} from '../../form-kit';

import { ReadOnlyNotice, productConflict, saveProduct } from './shared';

const schema = z.object({
  isMadeToOrder: z.boolean(),
  leadTimeDays: optionalInt(0, 365, 'Lead time'),
  allowCustomization: z.boolean(),
  manufacturedInHouse: z.boolean(),
  manufacturingNote: optionalText(2_000),
  assemblyRequired: z.boolean(),
  warrantyMonths: optionalInt(0, 600, 'Warranty'),
  careInstructions: optionalText(4_000),
  weightGrams: optionalInt(0, 10_000_000, 'Weight'),
  lengthMm: optionalInt(0, 100_000, 'Length'),
  widthMm: optionalInt(0, 100_000, 'Width'),
  heightMm: optionalInt(0, 100_000, 'Height'),
  seatHeightMm: optionalInt(0, 100_000, 'Seat height'),
  minOrderQty: requiredInt(1, 999, 'Minimum order quantity'),
  maxOrderQty: optionalInt(1, 999, 'Maximum order quantity'),
});
type Values = z.input<typeof schema>;

export function FulfilmentTab({ product }: { product: AdminProductDetailDto }) {
  const queryClient = useQueryClient();
  const { canCall } = usePermissions();
  const canEdit = canCall(productsRoutes.update) && !product.deletedAt;

  return (
    <EditorForm
      key={product.version}
      schema={schema}
      defaultValues={{
        isMadeToOrder: product.isMadeToOrder,
        leadTimeDays: intInput(product.leadTimeDays),
        allowCustomization: product.allowCustomization,
        manufacturedInHouse: product.manufacturedInHouse,
        manufacturingNote: textInput(product.manufacturingNote),
        assemblyRequired: product.assemblyRequired,
        warrantyMonths: intInput(product.warrantyMonths),
        careInstructions: textInput(product.careInstructions),
        weightGrams: intInput(product.weightGrams),
        lengthMm: intInput(product.lengthMm),
        widthMm: intInput(product.widthMm),
        heightMm: intInput(product.heightMm),
        seatHeightMm: intInput(product.seatHeightMm),
        minOrderQty: intInput(product.minOrderQty),
        maxOrderQty: intInput(product.maxOrderQty),
      }}
      successMessage="Fulfilment details saved"
      readOnly={canEdit ? undefined : <ReadOnlyNotice product={product} />}
      conflict={productConflict(product, queryClient, [
        { key: 'isMadeToOrder', label: 'Made to order' },
        { key: 'leadTimeDays', label: 'Lead time (days)' },
        { key: 'allowCustomization', label: 'Customisation available' },
        { key: 'manufacturedInHouse', label: 'Made in our own workshop' },
        { key: 'manufacturingNote', label: 'Manufacturing note' },
        { key: 'assemblyRequired', label: 'Needs assembly' },
        { key: 'warrantyMonths', label: 'Warranty (months)' },
        { key: 'careInstructions', label: 'Care instructions' },
        { key: 'weightGrams', label: 'Weight (grams)' },
        { key: 'lengthMm', label: 'Length (mm)' },
        { key: 'widthMm', label: 'Width (mm)' },
        { key: 'heightMm', label: 'Height (mm)' },
        { key: 'seatHeightMm', label: 'Seat height (mm)' },
        { key: 'minOrderQty', label: 'Minimum per order' },
        { key: 'maxOrderQty', label: 'Maximum per order' },
      ])}
      onSubmit={(values) => saveProduct(queryClient, product, values)}
    >
      <FormSection title="Making and delivery">
        <FieldGrid>
          <CheckField<Values>
            name="isMadeToOrder"
            label="Made to order"
            description="Built after the order is placed; stock does not limit sales."
          />
          <NumberField<Values>
            name="leadTimeDays"
            label="Lead time"
            unit="days"
            description="How long making and dispatch take. Shown to customers."
          />
          <CheckField<Values> name="manufacturedInHouse" label="Made in our own workshop" />
          <CheckField<Values>
            name="assemblyRequired"
            label="Needs assembly"
            description="Customers are told before they buy."
          />
        </FieldGrid>
        <TextAreaField<Values> name="manufacturingNote" label="Manufacturing note" rows={2} />
      </FormSection>
      <FormSection
        title="Customisation"
        description="Whether customers may ask for custom sizes, fabrics or finishes."
      >
        <CheckField<Values>
          name="allowCustomization"
          label="Customisation available"
          description="Customisation charges are set as price rules with the Customisation scope."
        />
      </FormSection>
      <FormSection
        title="Size and weight"
        description="Used for delivery quotes and the product page."
      >
        <FieldGrid columns={3}>
          <NumberField<Values> name="lengthMm" label="Length" unit="mm" />
          <NumberField<Values> name="widthMm" label="Width" unit="mm" />
          <NumberField<Values> name="heightMm" label="Height" unit="mm" />
          <NumberField<Values> name="seatHeightMm" label="Seat height" unit="mm" />
          <NumberField<Values> name="weightGrams" label="Weight" unit="grams" />
        </FieldGrid>
      </FormSection>
      <FormSection title="Warranty and care">
        <NumberField<Values> name="warrantyMonths" label="Warranty" unit="months" />
        <TextAreaField<Values> name="careInstructions" label="Care instructions" rows={3} />
      </FormSection>
      <FormSection title="Order quantity">
        <FieldGrid>
          <NumberField<Values> name="minOrderQty" label="Minimum per order" required />
          <NumberField<Values>
            name="maxOrderQty"
            label="Maximum per order"
            description="Empty: no limit."
          />
        </FieldGrid>
      </FormSection>
    </EditorForm>
  );
}
