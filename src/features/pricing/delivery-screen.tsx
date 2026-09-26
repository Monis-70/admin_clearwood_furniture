'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, MoreHorizontal, Plus, Trash2, Truck, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { z } from 'zod';

import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { FormAlert } from '@/components/patterns/form/form-alert';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { PageHeader } from '@/components/patterns/page-header';
import {
  EmptyState,
  ErrorState,
  PermissionNotice,
  SectionLoader,
} from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { endpoints } from '@/lib/api/endpoints';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
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
import { formatRupees } from '../catalog/model';
import { RecordDialog } from '../catalog/record-dialog';

import {
  deliveryApi,
  deliveryKeys,
  type PincodeRow,
  type RateRow,
  type ZoneRow,
} from './delivery-api';
import { SHIPPING_METHOD_LABELS } from './lookups';

const CONDITIONS: Record<string, { label: string; unit: string }> = {
  PRICE: { label: 'Cart value', unit: '₹' },
  WEIGHT: { label: 'Weight', unit: 'grams' },
  ITEM_COUNT: { label: 'Number of items', unit: 'items' },
};

export function DeliveryScreen() {
  const { canCall } = usePermissions();
  if (!canCall(endpoints.pricing.zones)) {
    return <PermissionNotice area="delivery charges" all={['pricing.tax.read']} />;
  }
  return <Delivery />;
}

function Delivery() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const params = useListParams<'zone'>({ filters: ['zone'] });
  const zones = useQuery({
    queryKey: deliveryKeys.zones(),
    queryFn: ({ signal }) => deliveryApi.zones(signal),
    ...cachePolicy.list,
  });
  const rates = useQuery({
    queryKey: deliveryKeys.rates(),
    queryFn: ({ signal }) => deliveryApi.rates(signal),
    ...cachePolicy.list,
  });
  const [editingZone, setEditingZone] = useState<ZoneRow | 'new' | null>(null);
  const [removingZone, setRemovingZone] = useState<ZoneRow | null>(null);
  const [editingRate, setEditingRate] = useState<{ rate: RateRow | null; zoneId: string } | null>(
    null,
  );
  const [removingRate, setRemovingRate] = useState<RateRow | null>(null);
  const canEdit = canCall(endpoints.pricing.updateZone);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: deliveryKeys.all });
  const openZone = zones.data?.find((z) => z.id === params.filters.zone);

  return (
    <>
      <PageHeader
        title="Delivery charges"
        description="Delivery zones, the rates charged in each and the pincodes they cover. Checkout picks the zone from the pincode and the rate from the cart."
        actions={
          canCall(endpoints.pricing.createZone) ? (
            <Button onClick={() => setEditingZone('new')}>
              <Plus aria-hidden />
              New zone
            </Button>
          ) : undefined
        }
      />
      {zones.isPending || rates.isPending ? (
        <SectionLoader label="Loading delivery zones…" />
      ) : zones.error || rates.error ? (
        <ErrorState
          error={zones.error ?? rates.error}
          onRetry={() => void (zones.refetch(), rates.refetch())}
        />
      ) : zones.data.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No delivery zones"
          description="Create a zone, add its pincodes, then its rates."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {zones.data.map((zone) => {
            const zoneRates = (rates.data ?? []).filter((r) => r.zoneId === zone.id);
            return (
              <section
                key={zone.id}
                aria-labelledby={`zone-${zone.id}`}
                className="flex flex-col gap-3 rounded-lg border bg-card p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id={`zone-${zone.id}`} className="text-base font-semibold">
                    {zone.name}
                  </h2>
                  <span className="font-mono text-xs text-muted-foreground">{zone.code}</span>
                  <Badge tone={zone.isActive ? 'success' : 'neutral'}>
                    {zone.isActive ? 'Active' : 'Off'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Priority {zone.priority}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => params.setFilter('zone', zone.id)}
                    >
                      <MapPin aria-hidden />
                      Pincodes
                    </Button>
                    {canEdit ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for zone ${zone.name}`}
                          >
                            <MoreHorizontal aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditingZone(zone)}>
                            Edit zone
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => setEditingRate({ rate: null, zoneId: zone.id })}
                          >
                            Add rate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setRemovingZone(zone)}
                          >
                            Delete zone…
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                </div>
                {zoneRates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No rates: checkout cannot deliver here yet.
                  </p>
                ) : (
                  <ul
                    className="flex flex-col divide-y rounded-md border text-sm"
                    aria-label={`Rates in ${zone.name}`}
                  >
                    {zoneRates.map((rate) => (
                      <li key={rate.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                        <span className="font-medium">{rate.name}</span>
                        <span className="text-muted-foreground">
                          {SHIPPING_METHOD_LABELS[rate.method] ?? rate.method}
                        </span>
                        <span>{describeRate(rate)}</span>
                        {rate.isActive ? null : <Badge tone="neutral">Off</Badge>}
                        {canEdit ? (
                          <span className="ml-auto flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingRate({ rate, zoneId: zone.id })}
                            >
                              Edit<span className="sr-only"> {rate.name}</span>
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Delete rate ${rate.name}`}
                              onClick={() => setRemovingRate(rate)}
                            >
                              <Trash2 aria-hidden />
                            </Button>
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-fit"
                    onClick={() => setEditingRate({ rate: null, zoneId: zone.id })}
                  >
                    <Plus aria-hidden />
                    Add rate<span className="sr-only"> to {zone.name}</span>
                  </Button>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
      {editingZone ? (
        <ZoneDialog
          zone={editingZone === 'new' ? null : editingZone}
          onClose={() => setEditingZone(null)}
          onSaved={() => {
            refresh();
            setEditingZone(null);
          }}
        />
      ) : null}
      {editingRate ? (
        <RateDialog
          rate={editingRate.rate}
          zoneId={editingRate.zoneId}
          onClose={() => setEditingRate(null)}
          onSaved={() => {
            refresh();
            setEditingRate(null);
          }}
        />
      ) : null}
      {removingZone ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setRemovingZone(null))}
          title={`Delete zone ${removingZone.name}?`}
          description="Its pincodes lose their delivery rates; checkout may no longer deliver there."
          confirmLabel="Delete zone"
          level="destructive"
          onConfirm={async () => {
            await deliveryApi.removeZone(removingZone.id);
            refresh();
            notifySuccess('Zone deleted');
          }}
        />
      ) : null}
      {removingRate ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setRemovingRate(null))}
          title={`Delete rate ${removingRate.name}?`}
          description="Checkout stops offering it immediately."
          confirmLabel="Delete rate"
          level="destructive"
          onConfirm={async () => {
            await deliveryApi.removeRate(removingRate.id);
            refresh();
            notifySuccess('Rate deleted');
          }}
        />
      ) : null}
      {params.filters.zone ? (
        <Sheet open onOpenChange={(o) => (o ? undefined : params.setFilter('zone', null))}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
            <SheetHeader className="p-0">
              <SheetTitle>Pincodes · {openZone?.name ?? 'Zone'}</SheetTitle>
              <SheetDescription>
                Where this zone delivers, with cash-on-delivery and delivery times.
              </SheetDescription>
            </SheetHeader>
            <Pincodes zoneId={params.filters.zone} canEdit={canEdit} />
          </SheetContent>
        </Sheet>
      ) : null}
    </>
  );
}

function describeRate(rate: RateRow): string {
  const unit = CONDITIONS[rate.conditionType];
  const bound = (v: number) =>
    rate.conditionType === 'PRICE' ? formatRupees(v) : `${v} ${unit?.unit ?? ''}`;
  const range =
    rate.minValue !== null || rate.maxValue !== null
      ? ` for ${unit?.label.toLowerCase() ?? 'value'} ${rate.minValue !== null ? `from ${bound(rate.minValue)}` : ''}${rate.maxValue !== null ? ` up to ${bound(rate.maxValue)}` : ''}`
      : '';
  const extra = rate.perUnitPaise ? ` + ${formatRupees(rate.perUnitPaise)} per unit` : '';
  const free = rate.freeAbovePaise ? `, free above ${formatRupees(rate.freeAbovePaise)}` : '';
  const eta =
    rate.etaMinDays !== null || rate.etaMaxDays !== null
      ? `, ${rate.etaMinDays ?? '?'}–${rate.etaMaxDays ?? '?'} days`
      : '';
  return `${formatRupees(rate.basePaise)}${extra}${range}${free}${eta}`;
}

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

function ZoneDialog({
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

function RateDialog({
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

function Pincodes({ zoneId, canEdit }: { zoneId: string; canEdit: boolean }) {
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
