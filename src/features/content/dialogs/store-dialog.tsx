'use client';

import { z } from 'zod';

import {
  CheckField,
  EditorForm,
  FieldGrid,
  FormSection,
  NumberField,
  TextAreaField,
  TextField,
  intInput,
  optionalText,
  requiredInt,
  requiredText,
  textInput,
} from '../../catalog/form-kit';
import { RecordDialog } from '../../catalog/record-dialog';
import { contentApi, type OpeningHours, type StoreRow } from '../api';
import { parseIds } from '../model';

import { idLines, optionalLink, slugField } from './fields';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
};
const TIME = /^\d{2}:\d{2}$/;

const coordinate = (limit: number, label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || /^-?\d{1,3}(\.\d+)?$/.test(v), `${label}: a decimal number`)
    .transform((v) => (v === '' ? null : Number(v)))
    .refine((v) => v === null || Math.abs(v) <= limit, `${label}: between -${limit} and ${limit}`);

const day = z
  .object({ opens: z.string(), closes: z.string(), closed: z.boolean() })
  .refine(
    (d) =>
      d.closed ||
      (d.opens === '' && d.closes === '') ||
      (TIME.test(d.opens) && TIME.test(d.closes)),
    'Enter both times, or tick Closed',
  );

const schema = z.object({
  name: requiredText(1, 160, 'Name'),
  slug: slugField,
  addressLine1: requiredText(1, 200, 'Address'),
  addressLine2: optionalText(200),
  city: requiredText(1, 80, 'City'),
  state: requiredText(1, 80, 'State'),
  stateCode: z.string().trim().toUpperCase().length(2, 'The two-letter state code, e.g. KA'),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'A six-digit pincode'),
  phone: optionalText(30),
  email: optionalText(160),
  mapsUrl: optionalLink,
  latitude: coordinate(90, 'Latitude'),
  longitude: coordinate(180, 'Longitude'),
  hours: z.object(
    Object.fromEntries(DAYS.map((d) => [d, day])) as Record<(typeof DAYS)[number], typeof day>,
  ),
  mediaIds: idLines(12),
  isActive: z.boolean(),
  isFlagship: z.boolean(),
  position: requiredInt(0, 999, 'Order'),
});
type Values = z.input<typeof schema>;

function hoursDefaults(json: string | null | undefined): Values['hours'] {
  let stored: OpeningHours[] = [];
  try {
    stored = json ? (JSON.parse(json) as OpeningHours[]) : [];
  } catch {
    stored = [];
  }
  return Object.fromEntries(
    DAYS.map((d) => {
      const found = stored.find((h) => h.day === d);
      return [
        d,
        { opens: found?.opens ?? '', closes: found?.closes ?? '', closed: found?.closed ?? false },
      ];
    }),
  ) as Values['hours'];
}

export function StoreDialog({
  row,
  onClose,
  onSaved,
}: {
  row: StoreRow | null;
  onClose(): void;
  onSaved(): void;
}) {
  return (
    <RecordDialog title={row ? `Edit ${row.name}` : 'New store'} onClose={onClose} wide>
      <EditorForm
        schema={schema}
        defaultValues={{
          name: textInput(row?.name),
          slug: textInput(row?.slug),
          addressLine1: textInput(row?.addressLine1),
          addressLine2: textInput(row?.addressLine2),
          city: textInput(row?.city),
          state: textInput(row?.state),
          stateCode: textInput(row?.stateCode),
          pincode: textInput(row?.pincode),
          phone: textInput(row?.phone),
          email: textInput(row?.email),
          mapsUrl: textInput(row?.mapsUrl),
          latitude: row?.latitude == null ? '' : String(row.latitude),
          longitude: row?.longitude == null ? '' : String(row.longitude),
          hours: hoursDefaults(row?.openingHoursJson),
          mediaIds: parseIds(row?.mediaIdsJson).join('\n'),
          isActive: row?.isActive ?? true,
          isFlagship: row?.isFlagship ?? false,
          position: intInput(row?.position ?? 0),
        }}
        successMessage={row ? 'Store saved' : 'Store created'}
        submitLabel={row ? 'Save changes' : 'Create store'}
        onSubmit={async ({ hours, ...values }) => {
          const openingHours = DAYS.flatMap((d) => {
            const h = hours[d];
            if (h.closed) return [{ day: d, opens: '00:00', closes: '00:00', closed: true }];
            return h.opens && h.closes
              ? [{ day: d, opens: h.opens, closes: h.closes, closed: false }]
              : [];
          });
          const body = { ...values, openingHours: openingHours.length ? openingHours : null };
          if (row) await contentApi.updateStore(row.id, { ...body, version: row.version });
          else await contentApi.createStore(body);
          onSaved();
        }}
      >
        <FieldGrid>
          <TextField<Values> name="name" label="Store name" required />
          <TextField<Values> name="slug" label="URL slug" required />
        </FieldGrid>
        <FormSection title="Address">
          <TextField<Values> name="addressLine1" label="Address line 1" required />
          <TextField<Values> name="addressLine2" label="Address line 2" />
          <FieldGrid columns={3}>
            <TextField<Values> name="city" label="City" required />
            <TextField<Values> name="state" label="State" required />
            <TextField<Values> name="stateCode" label="State code" required description="e.g. KA" />
            <TextField<Values> name="pincode" label="Pincode" inputMode="numeric" required />
            <TextField<Values> name="phone" label="Phone" />
            <TextField<Values> name="email" label="Email" type="email" />
          </FieldGrid>
          <FieldGrid columns={3}>
            <TextField<Values> name="mapsUrl" label="Map link" description="An https:// address." />
            <TextField<Values> name="latitude" label="Latitude" inputMode="decimal" />
            <TextField<Values> name="longitude" label="Longitude" inputMode="decimal" />
          </FieldGrid>
        </FormSection>
        <FormSection
          title="Opening hours"
          description="Leave a day empty to not show it. Times are 24-hour, e.g. 10:00 and 20:30."
        >
          <div className="grid gap-2">
            {DAYS.map((d) => (
              <div key={d} className="grid grid-cols-[6rem_1fr_1fr_auto] items-end gap-2">
                <span className="pb-2 text-sm font-medium">{DAY_LABELS[d]}</span>
                <TextField<Values>
                  name={`hours.${d}.opens`}
                  label={<span className="sr-only">{DAY_LABELS[d]} opens</span>}
                  placeholder="10:00"
                />
                <TextField<Values>
                  name={`hours.${d}.closes`}
                  label={<span className="sr-only">{DAY_LABELS[d]} closes</span>}
                  placeholder="20:00"
                />
                <CheckField<Values>
                  name={`hours.${d}.closed`}
                  label={
                    <>
                      Closed<span className="sr-only"> on {DAY_LABELS[d]}</span>
                    </>
                  }
                  className="p-2"
                />
              </div>
            ))}
          </div>
        </FormSection>
        <TextAreaField<Values>
          name="mediaIds"
          label="Photo IDs"
          rows={2}
          description="Media library IDs, one per line (up to 12)."
        />
        <FieldGrid columns={3}>
          <CheckField<Values> name="isActive" label="Visible" />
          <CheckField<Values> name="isFlagship" label="Flagship store" />
          <NumberField<Values> name="position" label="Order" description="Lower comes first." />
        </FieldGrid>
      </EditorForm>
    </RecordDialog>
  );
}
