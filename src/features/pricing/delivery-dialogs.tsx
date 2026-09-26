'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { z } from 'zod';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { EmptyState, ErrorState, SectionLoader } from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { notifySuccess } from '@/lib/notify';
import { cachePolicy } from '@/lib/query/policies';

import {
  CheckField,
  EditorForm,
  FieldGrid,
  MoneyField,
  NumberField,
  SelectField,
  TextField,
  intInput,
  optionalInt,
  optionalRupees,
  optionalText,
  paiseInput,
  requiredInt,
  requiredText,
  rupees,
  textInput,
} from '../catalog/form-kit';
import { RecordDialog } from '../catalog/record-dialog';

import {
  deliveryApi,
  deliveryKeys,
  type PincodeRow,
  type RateRow,
  type ZoneRow,
} from './delivery-api';
import { CONDITIONS, SHIPPING_METHOD_LABELS } from './lookups';

const zoneSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]{1,31}$/, 'Use UPPER_SNAKE_CASE, e.g. METRO'),
  name: requiredText(2, 120, 'Name'),
  priority: requiredInt(0, 10_000, 'Priority'),
  isActive: z.boolean(),
});
type ZoneValues = z.input<typeof zoneSchema>;

export function ZoneDialog({
  zone,
  onClose,
  onSaved,
}: {
  zone: ZoneRow | null;
  onClose(): void;
  onSaved(): void;
}) {
  return (
    <RecordDialog title={zone ? `Edit ${zone.name}` : 'New delivery zone'} onClose={onClose}>
      <EditorForm
        schema={zoneSchema}
        defaultValues={{
          code: textInput(zone?.code),
          name: textInput(zone?.name),
          priority: intInput(zone?.priority ?? 100),
          isActive: zone?.isActive ?? true,
        }}
        successMessage={zone ? 'Zone saved' : 'Zone created'}
        submitLabel={zone ? 'Save changes' : 'Create zone'}
        onSubmit={async ({ code, ...values }) => {
          if (zone) await deliveryApi.updateZone(zone.id, { ...values, version: zone.version });
          else await deliveryApi.createZone({ ...values, code });
          onSaved();
        }}
      >
        <FieldGrid>
          <TextField<ZoneValues> name="name" label="Name" required />
          {zone ? null : <TextField<ZoneValues> name="code" label="Code" required />}
        </FieldGrid>
        <NumberField<ZoneValues>
          name="priority"
          label="Priority"
          required
          description="When pincode ranges overlap, the lower number wins."
        />
        <CheckField<ZoneValues> name="isActive" label="Active" />
      </EditorForm>
    </RecordDialog>
  );
}

const rateSchema = z
  .object({
    method: z.string(),
    name: requiredText(2, 120, 'Name'),
    conditionType: z.string(),
    minValue: z.string().trim(),
    maxValue: z.string().trim(),
    basePaise: rupees('Charge'),
    perUnitPaise: optionalRupees('Per unit'),
    freeAbovePaise: optionalRupees('Free above'),
    etaMinDays: optionalInt(0, 365, 'Fastest delivery'),
    etaMaxDays: optionalInt(0, 365, 'Slowest delivery'),
    priority: requiredInt(0, 10_000, 'Priority'),
    isActive: z.boolean(),
  })
  .transform((v, ctx) => {
    const parse = (raw: string, path: 'minValue' | 'maxValue') => {
      if (raw === '') return null;
      const ok =
        v.conditionType === 'PRICE' ? /^\d{1,9}(\.\d{1,2})?$/.test(raw) : /^\d+$/.test(raw);
      if (!ok) {
        ctx.addIssue({
          code: 'custom',
          path: [path],
          message: v.conditionType === 'PRICE' ? 'Enter rupees' : 'Enter a whole number',
        });
        return null;
      }
      return v.conditionType === 'PRICE' ? Math.round(Number(raw) * 100) : Number(raw);
    };
    const minValue = parse(v.minValue, 'minValue');
    const maxValue = parse(v.maxValue, 'maxValue');
    if (minValue !== null && maxValue !== null && maxValue < minValue) {
      ctx.addIssue({
        code: 'custom',
        path: ['maxValue'],
        message: 'Must not be below the minimum',
      });
    }
    return { ...v, minValue, maxValue };
  });
type RateValues = z.input<typeof rateSchema>;

export function RateDialog({
  rate,
  zoneId,
  onClose,
  onSaved,
}: {
  rate: RateRow | null;
  zoneId: string;
  onClose(): void;
  onSaved(): void;
}) {
  const bound = (v: number | null | undefined) =>
    v === null || v === undefined
      ? ''
      : rate?.conditionType === 'PRICE'
        ? String(v / 100)
        : String(v);
  return (
    <RecordDialog title={rate ? `Edit ${rate.name}` : 'New delivery rate'} onClose={onClose} wide>
      <EditorForm
        schema={rateSchema}
        defaultValues={{
          method: rate?.method ?? 'STANDARD',
          name: textInput(rate?.name),
          conditionType: rate?.conditionType ?? 'PRICE',
          minValue: bound(rate?.minValue),
          maxValue: bound(rate?.maxValue),
          basePaise: paiseInput(rate?.basePaise ?? 0),
          perUnitPaise: paiseInput(rate?.perUnitPaise),
          freeAbovePaise: paiseInput(rate?.freeAbovePaise),
          etaMinDays: intInput(rate?.etaMinDays),
          etaMaxDays: intInput(rate?.etaMaxDays),
          priority: intInput(rate?.priority ?? 100),
          isActive: rate?.isActive ?? true,
        }}
        successMessage={rate ? 'Rate saved' : 'Rate created'}
        submitLabel={rate ? 'Save changes' : 'Create rate'}
        onSubmit={async (values) => {
          const input = {
            ...values,
            method: values.method as 'STANDARD',
            conditionType: values.conditionType as 'PRICE',
          };
          if (rate) await deliveryApi.updateRate(rate.id, { ...input, version: rate.version });
          else await deliveryApi.createRate({ ...input, zoneId });
          onSaved();
        }}
      >
        <FieldGrid>
          <TextField<RateValues>
            name="name"
            label="Name"
            required
            description="Shown at checkout, e.g. Standard delivery."
          />
          <SelectField<RateValues>
            name="method"
            label="Method"
            options={Object.entries(SHIPPING_METHOD_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </FieldGrid>
        <FieldGrid columns={3}>
          <SelectField<RateValues>
            name="conditionType"
            label="Charged by"
            options={Object.entries(CONDITIONS).map(([value, c]) => ({
              value,
              label: `${c.label} (${c.unit})`,
            }))}
          />
          <TextField<RateValues>
            name="minValue"
            label="From"
            inputMode="decimal"
            description="Empty: no minimum."
          />
          <TextField<RateValues>
            name="maxValue"
            label="Up to"
            inputMode="decimal"
            description="Empty: no maximum."
          />
        </FieldGrid>
        <FieldGrid columns={3}>
          <MoneyField<RateValues> name="basePaise" label="Charge" required />
          <MoneyField<RateValues> name="perUnitPaise" label="Plus per unit" />
          <MoneyField<RateValues> name="freeAbovePaise" label="Free above cart value" />
        </FieldGrid>
        <FieldGrid columns={3}>
          <NumberField<RateValues> name="etaMinDays" label="Fastest (days)" />
          <NumberField<RateValues> name="etaMaxDays" label="Slowest (days)" />
          <NumberField<RateValues> name="priority" label="Priority" required />
        </FieldGrid>
        <CheckField<RateValues> name="isActive" label="Active" />
      </EditorForm>
    </RecordDialog>
  );
}

const PIN = /^[1-9][0-9]{5}$/;
const pincodeSchema = z.object({
  pincode: z.string().trim().regex(PIN, 'Six digits, not starting with 0'),
  city: optionalText(120),
  state: optionalText(120),
  stateCode: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[A-Z0-9]{2}$/.test(v), 'Two characters')
    .transform((v) => v || null),
  isServiceable: z.boolean(),
  codAvailable: z.boolean(),
  etaMinDays: optionalInt(0, 365, 'Fastest delivery'),
  etaMaxDays: optionalInt(0, 365, 'Slowest delivery'),
});
type PincodeValues = z.input<typeof pincodeSchema>;

const rangeSchema = z
  .object({
    fromPincode: z.string().trim().regex(PIN, 'Six digits, not starting with 0'),
    toPincode: z.string().trim().regex(PIN, 'Six digits, not starting with 0'),
    stateCode: z
      .string()
      .trim()
      .refine((v) => v === '' || /^[A-Z0-9]{2}$/.test(v), 'Two characters')
      .transform((v) => v || null),
  })
  .refine((v) => Number(v.toPincode) >= Number(v.fromPincode), {
    path: ['toPincode'],
    message: 'Must not be below the first pincode',
  });
type RangeValues = z.input<typeof rangeSchema>;

export function Pincodes({ zoneId, canEdit }: { zoneId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const pincodes = useQuery({
    queryKey: deliveryKeys.pincodes(zoneId),
    queryFn: ({ signal }) => deliveryApi.pincodes(zoneId, signal),
    ...cachePolicy.list,
  });
  const [adding, setAdding] = useState<'pincode' | 'range' | null>(null);
  const [removing, setRemoving] = useState<PincodeRow | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: deliveryKeys.pincodes(zoneId) });
  const upload = useMutation({
    mutationFn: (csv: File) => deliveryApi.importPincodes(zoneId, csv),
    onSuccess: ({ imported, skipped }) => {
      refresh();
      notifySuccess(`${imported} pincodes imported${skipped ? `, ${skipped} skipped` : ''}`);
    },
  });

  return (
    <div className="mt-4 flex flex-col gap-4">
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setAdding('pincode')}>
            <Plus aria-hidden />
            Add pincode
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAdding('range')}>
            Add a pincode range
          </Button>
          <Button
            size="sm"
            variant="outline"
            loading={upload.isPending}
            onClick={() => file.current?.click()}
          >
            <Upload aria-hidden />
            Import CSV
          </Button>
          <input
            ref={file}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="Pincode CSV file"
            onChange={(e) => {
              const chosen = e.target.files?.[0];
              if (chosen) upload.mutate(chosen);
              e.target.value = '';
            }}
          />
        </div>
      ) : null}
      {canEdit ? (
        <p className="text-xs text-muted-foreground">
          CSV columns: pincode, city, state, stateCode, isServiceable, codAvailable, etaMinDays,
          etaMaxDays. A pincode already in another zone moves to this one. Ranges are stored but not
          listed here (the API has no list of ranges).
        </p>
      ) : null}
      <FormAlert error={upload.error} />
      {pincodes.isPending ? (
        <SectionLoader label="Loading pincodes…" />
      ) : pincodes.error ? (
        <ErrorState error={pincodes.error} onRetry={() => void pincodes.refetch()} compact />
      ) : pincodes.data.length === 0 ? (
        <EmptyState icon={MapPin} title="No pincodes in this zone" compact />
      ) : (
        <>
          <ul className="flex flex-col divide-y rounded-md border text-sm" aria-label="Pincodes">
            {pincodes.data.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="font-mono font-medium">{p.pincode}</span>
                <span className="text-muted-foreground">
                  {[p.city, p.state].filter(Boolean).join(', ')}
                </span>
                {p.isServiceable ? null : <Badge tone="warning">Not delivered</Badge>}
                {p.codAvailable ? <Badge tone="info">Cash on delivery</Badge> : null}
                {canEdit ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="ml-auto"
                    aria-label={`Remove pincode ${p.pincode}`}
                    onClick={() => setRemoving(p)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          {pincodes.data.length >= 1000 ? (
            <p className="text-xs text-muted-foreground">Showing the first 1,000 pincodes.</p>
          ) : null}
        </>
      )}
      {adding === 'pincode' ? (
        <RecordDialog title="Add a pincode" onClose={() => setAdding(null)}>
          <EditorForm
            schema={pincodeSchema}
            defaultValues={{
              pincode: '',
              city: '',
              state: '',
              stateCode: '',
              isServiceable: true,
              codAvailable: false,
              etaMinDays: '',
              etaMaxDays: '',
            }}
            successMessage="Pincode saved"
            submitLabel="Add pincode"
            onSubmit={async (values) => {
              await deliveryApi.createPincode({ ...values, zoneId });
              refresh();
              setAdding(null);
            }}
          >
            <FieldGrid>
              <TextField<PincodeValues>
                name="pincode"
                label="Pincode"
                required
                inputMode="numeric"
              />
              <TextField<PincodeValues>
                name="stateCode"
                label="GST state code"
                description="Two characters, e.g. 27."
              />
              <TextField<PincodeValues> name="city" label="City" />
              <TextField<PincodeValues> name="state" label="State" />
              <NumberField<PincodeValues> name="etaMinDays" label="Fastest (days)" />
              <NumberField<PincodeValues> name="etaMaxDays" label="Slowest (days)" />
            </FieldGrid>
            <FieldGrid>
              <CheckField<PincodeValues> name="isServiceable" label="We deliver here" />
              <CheckField<PincodeValues> name="codAvailable" label="Cash on delivery available" />
            </FieldGrid>
          </EditorForm>
        </RecordDialog>
      ) : null}
      {adding === 'range' ? (
        <RecordDialog
          title="Add a pincode range"
          description="Every pincode from the first to the last belongs to this zone unless listed elsewhere."
          onClose={() => setAdding(null)}
        >
          <EditorForm
            schema={rangeSchema}
            defaultValues={{ fromPincode: '', toPincode: '', stateCode: '' }}
            successMessage="Range added"
            submitLabel="Add range"
            onSubmit={async (values) => {
              await deliveryApi.createRange({ ...values, zoneId });
              setAdding(null);
            }}
          >
            <FieldGrid columns={3}>
              <TextField<RangeValues>
                name="fromPincode"
                label="First pincode"
                required
                inputMode="numeric"
              />
              <TextField<RangeValues>
                name="toPincode"
                label="Last pincode"
                required
                inputMode="numeric"
              />
              <TextField<RangeValues> name="stateCode" label="GST state code" />
            </FieldGrid>
          </EditorForm>
        </RecordDialog>
      ) : null}
      {removing ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setRemoving(null))}
          title={`Remove pincode ${removing.pincode}?`}
          description="Checkout then matches it by range, or treats it as not served."
          confirmLabel="Remove pincode"
          level="destructive"
          onConfirm={async () => {
            await deliveryApi.removePincode(removing.id);
            refresh();
            notifySuccess('Pincode removed');
          }}
        />
      ) : null}
    </div>
  );
}
