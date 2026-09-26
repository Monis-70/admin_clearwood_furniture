'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';

import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { FormAlert } from '@/components/patterns/form/form-alert';
import { EmptyState, ErrorState, SectionLoader } from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { endpoints } from '@/lib/api/endpoints';
import { hasCode } from '@/lib/api/errors';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import {
  CheckField,
  EditorForm,
  FieldGrid,
  FormSection,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
  intInput,
  optionalInt,
  optionalText,
  requiredInt,
  requiredText,
  textInput,
} from '../form-kit';
import { RecordDialog } from '../record-dialog';
import {
  attributesApi,
  taxonomyKeys,
  type AttributeGroupRow,
  type AttributeRow,
  type AttributeValueRow,
} from '../taxonomy/api';

import { DATA_TYPE_OPTIONS, HAS_VALUES, INPUT_LABELS, INPUT_OPTIONS, codeFrom } from './model';

const CODE = /^[A-Z][A-Z0-9_]*$/;
const schema = z.object({
  name: requiredText(2, 160, 'Name'),
  code: z.string().trim().min(2, 'At least 2 characters').max(64),
  groupId: z.string().transform((v) => v || null),
  inputType: z.string(),
  dataType: z.string(),
  unit: optionalText(24),
  helpText: optionalText(500),
  position: requiredInt(0, 10_000, 'Order'),
  isVariantDefining: z.boolean(),
  isFilterable: z.boolean(),
  isSearchable: z.boolean(),
  isRequired: z.boolean(),
  isComparable: z.boolean(),
  showInSwatch: z.boolean(),
  isActive: z.boolean(),
});
type Values = z.input<typeof schema>;
type Output = z.output<typeof schema>;

/** Codes are UPPER_SNAKE_CASE for new records; existing seeded codes are kept as they are. */
const newCode = (schema_: typeof schema) =>
  schema_.refine((v) => CODE.test(v.code), {
    path: ['code'],
    message: 'Use UPPER_SNAKE_CASE, e.g. SEAT_MATERIAL',
  });

export function AttributeEditor({
  id,
  groups,
  onClose,
  onCreated,
}: {
  id: string | null;
  groups: readonly AttributeGroupRow[];
  onClose(): void;
  onCreated(id: string): void;
}) {
  const attribute = useQuery({
    queryKey: taxonomyKeys.attribute(id ?? 'new'),
    queryFn: ({ signal }) => attributesApi.get(id!, signal),
    enabled: Boolean(id),
    ...cachePolicy.detail,
  });
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {!id ? (
          <>
            <SheetHeader className="p-0">
              <SheetTitle>New attribute</SheetTitle>
              <SheetDescription>Values can be added once it exists.</SheetDescription>
            </SheetHeader>
            <AttributeForm attribute={null} groups={groups} onCreated={onCreated} />
          </>
        ) : attribute.isPending ? (
          <>
            <SheetTitle className="sr-only">Attribute</SheetTitle>
            <SheetDescription className="sr-only">Loading</SheetDescription>
            <SectionLoader label="Loading attribute…" />
          </>
        ) : attribute.error ? (
          <>
            <SheetTitle>
              {hasCode(attribute.error, 'NOT_FOUND') ? 'Attribute not found' : 'Attribute'}
            </SheetTitle>
            <SheetDescription className="sr-only">Could not load</SheetDescription>
            <ErrorState error={attribute.error} onRetry={() => void attribute.refetch()} />
          </>
        ) : (
          <div className="flex flex-col gap-6">
            <SheetHeader className="p-0">
              <SheetTitle>{attribute.data.name}</SheetTitle>
              <SheetDescription>
                <span className="font-mono">{attribute.data.code}</span> ·{' '}
                {INPUT_LABELS[attribute.data.inputType] ?? attribute.data.inputType}
              </SheetDescription>
            </SheetHeader>
            {HAS_VALUES.has(attribute.data.inputType) ? (
              <ValuesPanel attribute={attribute.data} />
            ) : null}
            <AttributeForm
              key={attribute.data.version}
              attribute={attribute.data}
              groups={groups}
              onCreated={onCreated}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function AttributeForm({
  attribute,
  groups,
  onCreated,
}: {
  attribute: AttributeRow | null;
  groups: readonly AttributeGroupRow[];
  onCreated(id: string): void;
}) {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const canSave = attribute
    ? canCall(endpoints.attributes.update)
    : canCall(endpoints.attributes.create);
  const originalCode = attribute?.code;
  const validator = attribute
    ? schema.refine((v) => v.code === originalCode || CODE.test(v.code), {
        path: ['code'],
        message: 'Use UPPER_SNAKE_CASE, e.g. SEAT_MATERIAL',
      })
    : newCode(schema);

  return (
    <EditorForm<Values, Output, AttributeRow>
      schema={validator as unknown as z.ZodType<Output, z.ZodTypeDef, Values>}
      defaultValues={{
        name: textInput(attribute?.name),
        code: textInput(attribute?.code),
        groupId: textInput(attribute?.groupId),
        inputType: attribute?.inputType ?? 'SELECT',
        dataType: attribute?.dataType ?? 'STRING',
        unit: textInput(attribute?.unit),
        helpText: textInput(attribute?.helpText),
        position: intInput(attribute?.position ?? 0),
        isVariantDefining: attribute?.isVariantDefining ?? false,
        isFilterable: attribute?.isFilterable ?? true,
        isSearchable: attribute?.isSearchable ?? false,
        isRequired: attribute?.isRequired ?? false,
        isComparable: attribute?.isComparable ?? false,
        showInSwatch: attribute?.showInSwatch ?? false,
        isActive: attribute?.isActive ?? true,
      }}
      successMessage={attribute ? 'Attribute saved' : 'Attribute created'}
      submitLabel={attribute ? 'Save changes' : 'Create attribute'}
      readOnly={canSave ? undefined : <p className="text-sm text-muted-foreground">View only.</p>}
      conflict={
        attribute
          ? {
              fields: [
                { key: 'name', label: 'Name' },
                { key: 'groupId', label: 'Group' },
                { key: 'inputType', label: 'How it is filled in' },
                { key: 'position', label: 'Order' },
                { key: 'isVariantDefining', label: 'Variant option' },
                { key: 'isFilterable', label: 'Storefront filter' },
                { key: 'showInSwatch', label: 'Show as swatch' },
              ],
              yours: (values) => values as unknown as Partial<AttributeRow>,
              loadLatest: () => attributesApi.get(attribute.id),
              onReload: (latest) =>
                queryClient.setQueryData(taxonomyKeys.attribute(attribute.id), latest),
            }
          : undefined
      }
      onSubmit={async ({ code, ...values }) => {
        const input = {
          ...values,
          inputType: values.inputType as never,
          dataType: values.dataType as never,
        };
        if (attribute) {
          const next = await attributesApi.update(attribute.id, {
            ...input,
            ...(code !== attribute.code ? { code } : {}),
            version: attribute.version,
          });
          queryClient.setQueryData(taxonomyKeys.attribute(attribute.id), next);
        } else {
          const created = await attributesApi.create({ ...input, code });
          onCreated(created.id);
        }
        void queryClient.invalidateQueries({ queryKey: taxonomyKeys.attributes });
      }}
    >
      <FormSection title="Attribute">
        <FieldGrid>
          <TextField<Values> name="name" label="Name" required />
          <TextField<Values>
            name="code"
            label="Code"
            required
            description="Used in imports and storefront filters."
          />
        </FieldGrid>
        <FieldGrid>
          <SelectField<Values>
            name="groupId"
            label="Group"
            options={[
              { value: '', label: 'No group' },
              ...groups.map((g) => ({ value: g.id, label: g.name })),
            ]}
          />
          <SelectField<Values>
            name="inputType"
            label="How it is filled in"
            options={INPUT_OPTIONS}
          />
        </FieldGrid>
        <FieldGrid>
          <SelectField<Values> name="dataType" label="Data type" options={DATA_TYPE_OPTIONS} />
          <TextField<Values> name="unit" label="Unit" description="e.g. cm, kg" />
        </FieldGrid>
        <NumberField<Values>
          name="position"
          label="Order"
          description="Lower numbers come first."
        />
        <TextAreaField<Values>
          name="helpText"
          label="Help text"
          rows={2}
          description="Shown to admins filling in products."
        />
      </FormSection>
      <FormSection title="Behaviour">
        <FieldGrid>
          <CheckField<Values>
            name="isVariantDefining"
            label="Variant option"
            description="Variants are built from its values (e.g. Fabric colour)."
          />
          <CheckField<Values> name="isFilterable" label="Storefront filter" />
          <CheckField<Values>
            name="isRequired"
            label="Required"
            description="Must be filled in before publishing."
          />
          <CheckField<Values> name="isSearchable" label="Searchable" />
          <CheckField<Values> name="isComparable" label="Comparable" />
          <CheckField<Values> name="showInSwatch" label="Show as swatch" />
          <CheckField<Values> name="isActive" label="Active" />
        </FieldGrid>
      </FormSection>
    </EditorForm>
  );
}

const valueSchema = z.object({
  label: requiredText(1, 160, 'Label'),
  code: z.string().trim().min(1, 'Required').max(64),
  description: optionalText(1_000),
  colorHex: z
    .string()
    .trim()
    .refine((v) => v === '' || /^#[0-9a-fA-F]{6}$/.test(v), 'Use a hex colour like #8B5A2B')
    .transform((v) => v || null),
  numericValue: optionalInt(-1_000_000_000, 1_000_000_000, 'Number'),
  position: requiredInt(0, 10_000, 'Position'),
  isActive: z.boolean(),
});
type ValueValues = z.input<typeof valueSchema>;
type ValueOutput = z.output<typeof valueSchema>;
const VALUE_CODE = /^[A-Z0-9][A-Z0-9_-]*$/;

function ValuesPanel({ attribute }: { attribute: AttributeRow }) {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AttributeValueRow | null>(null);
  const [removing, setRemoving] = useState<AttributeValueRow | null>(null);
  const [label, setLabel] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const values = [...(attribute.values ?? [])].sort((a, b) => a.position - b.position);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: taxonomyKeys.attribute(attribute.id) });
    void queryClient.invalidateQueries({ queryKey: taxonomyKeys.attributes });
  };
  const add = useMutation({
    mutationFn: (valueCode: string) =>
      attributesApi.createValue(attribute.id, {
        label: label.trim(),
        code: valueCode,
        position: values.length ? Math.max(...values.map((v) => v.position)) + 1 : 0,
        isActive: true,
      }),
    onSuccess: (value) => {
      notifySuccess(`${value.label} added`);
      setLabel('');
      setCode('');
      setCodeTouched(false);
      refresh();
    },
  });
  const suggested = codeTouched ? code : codeFrom(label);
  const codeValid = VALUE_CODE.test(suggested);
  const swatch = attribute.inputType === 'SWATCH_COLOR';

  return (
    <section aria-labelledby="values-heading" className="flex flex-col gap-3">
      <h3 id="values-heading" className="text-base font-semibold">
        Values <span className="text-sm font-normal text-muted-foreground">({values.length})</span>
      </h3>
      {values.length === 0 ? (
        <EmptyState
          title="No values yet"
          description="Add the choices admins pick from, e.g. Oak, Walnut, Teak."
          compact
        />
      ) : (
        <ul className="flex flex-col divide-y rounded-md border">
          {values.map((value) => (
            <li key={value.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              {value.colorHex ? (
                <span
                  aria-hidden
                  className="size-5 shrink-0 rounded-full border"
                  style={{ backgroundColor: value.colorHex }}
                />
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="font-medium">{value.label}</span>{' '}
                <span className="font-mono text-xs text-muted-foreground">{value.code}</span>
              </span>
              {!value.isActive ? <Badge tone="neutral">Inactive</Badge> : null}
              {canCall(endpoints.attributes.updateValue) ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Edit ${value.label}`}
                  onClick={() => setEditing(value)}
                >
                  <Pencil aria-hidden />
                </Button>
              ) : null}
              {canCall(endpoints.attributes.removeValue) ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Delete ${value.label}`}
                  onClick={() => setRemoving(value)}
                >
                  <Trash2 aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canCall(endpoints.attributes.createValue) ? (
        <form
          className="flex flex-col gap-2 rounded-md border border-dashed p-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (label.trim() && codeValid) add.mutate(suggested);
          }}
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="value-label">New value</Label>
            <Input
              id="value-label"
              value={label}
              maxLength={160}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="value-code">Code</Label>
            <Input
              id="value-code"
              value={suggested}
              maxLength={64}
              aria-invalid={Boolean(suggested) && !codeValid}
              onChange={(event) => {
                setCodeTouched(true);
                setCode(event.target.value.toUpperCase());
              }}
            />
          </div>
          <Button type="submit" disabled={!label.trim() || !codeValid} loading={add.isPending}>
            Add value
          </Button>
          <FormAlert error={add.error} className="sm:basis-full" />
        </form>
      ) : null}
      {editing ? (
        <RecordDialog title={`Edit ${editing.label}`} onClose={() => setEditing(null)}>
          <EditorForm<ValueValues, ValueOutput, AttributeValueRow>
            schema={
              valueSchema.refine((v) => v.code === editing.code || VALUE_CODE.test(v.code), {
                path: ['code'],
                message: 'Use capitals, digits, _ or -',
              }) as unknown as z.ZodType<ValueOutput, z.ZodTypeDef, ValueValues>
            }
            defaultValues={{
              label: editing.label,
              code: editing.code,
              description: textInput(editing.description),
              colorHex: textInput(editing.colorHex),
              numericValue: intInput(editing.numericValue),
              position: intInput(editing.position),
              isActive: editing.isActive,
            }}
            successMessage="Value saved"
            onSubmit={async ({ code: nextCode, ...rest }) => {
              await attributesApi.updateValue(editing.id, {
                ...rest,
                ...(nextCode !== editing.code ? { code: nextCode } : {}),
                version: editing.version,
              });
              refresh();
              setEditing(null);
            }}
          >
            <FieldGrid>
              <TextField<ValueValues> name="label" label="Label" required />
              <TextField<ValueValues> name="code" label="Code" required />
            </FieldGrid>
            {swatch ? (
              <TextField<ValueValues> name="colorHex" label="Colour" placeholder="#8B5A2B" />
            ) : null}
            <TextAreaField<ValueValues> name="description" label="Description" rows={2} />
            <FieldGrid>
              <NumberField<ValueValues> name="position" label="Order" />
              <NumberField<ValueValues>
                name="numericValue"
                label="Numeric value"
                description="For sorting and number filters."
              />
            </FieldGrid>
            <CheckField<ValueValues> name="isActive" label="Active" />
          </EditorForm>
        </RecordDialog>
      ) : null}
      {removing ? (
        <LazyConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setRemoving(null))}
          title={`Delete ${removing.label}?`}
          description="Refused while products or variants still use this value."
          confirmLabel="Delete value"
          level="destructive"
          onConfirm={async () => {
            await attributesApi.removeValue(removing.id);
            refresh();
            notifySuccess('Value deleted');
          }}
        />
      ) : null}
    </section>
  );
}
