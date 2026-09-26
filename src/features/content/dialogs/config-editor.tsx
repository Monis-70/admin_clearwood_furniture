'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useId, useState, type ReactNode } from 'react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { mediaRoutes } from '@/lib/api/routes/media';
import { usePermissions } from '@/lib/permissions/use-permissions';

import { ProductPicker } from '../../pricing/product-picker';
import {
  useBrandChoices,
  useCategoryChoices,
  useCollectionChoices,
  useFaqChoices,
  useStoreChoices,
  useTestimonialChoices,
  type Choice,
} from '../lookups';

import { dateTimeLocal, fromDateTimeLocal } from './datetime';

const MediaPicker = dynamic(() => import('../../media/media-picker').then((m) => m.MediaPicker), {
  ssr: false,
});

/*
 * A block's settings form, generated from its shared Zod config schema (the same registry the API
 * validates with). The API remains the judge: this only shapes the input and pre-checks it.
 */

const LABELS: Record<string, string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  headline: 'Headline',
  subheadline: 'Subheading',
  ctaLabel: 'Button text',
  ctaUrl: 'Button link',
  mediaId: 'Image',
  mobileMediaId: 'Phone image',
  iconMediaId: 'Icon',
  posterMediaId: 'Poster image',
  altText: 'Image description',
  textHex: 'Text colour',
  autoplayMs: 'Autoplay every (ms)',
  showDots: 'Show dots',
  categoryIds: 'Categories',
  categoryId: 'Category',
  collectionId: 'Collection',
  productIds: 'Products',
  limit: 'How many',
  columns: 'Columns',
  showViewAll: 'Show "View all"',
  panels: 'Panels',
  slides: 'Slides',
  items: 'Items',
  html: 'HTML',
  align: 'Alignment',
  maxWidthPx: 'Maximum width (px)',
  imagePosition: 'Image side',
  body: 'Text',
  url: 'Video address',
  caption: 'Caption',
  autoplay: 'Play automatically',
  testimonialIds: 'Testimonials',
  featuredOnly: 'Featured quotes only',
  faqIds: 'Questions',
  visibility: 'Questions shown on',
  label: 'Label',
  storeIds: 'Stores',
  showMap: 'Show map',
  buttonLabel: 'Button text',
  leadFormKey: 'Enquiry form key',
  handle: 'Instagram handle',
  linkUrl: 'Link',
  brandIds: 'Brands',
  heightPx: 'Height (px)',
  showDivider: 'Show a divider line',
  endsAt: 'Ends at',
  showLabels: 'Show names',
};

const HINTS: Record<string, string> = {
  ctaUrl: 'A path like /sale, or an https:// address.',
  linkUrl: 'A path like /sale, or an https:// address.',
  url: 'An embed address from an allowed video host (see Site settings).',
  html: 'Sanitised when saved: scripts and unsafe attributes are removed.',
  productIds: 'Or leave empty and choose a collection or category below.',
  leadFormKey: 'e.g. bulk-order or home-interiors.',
};

export const labelOf = (key: string) =>
  LABELS[key] ??
  key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

/** Strip Optional / Nullable / Default / Effects wrappers. */
function unwrap(schema: z.ZodTypeAny): { inner: z.ZodTypeAny; optional: boolean } {
  let inner = schema;
  let optional = false;
  for (let i = 0; i < 8; i += 1) {
    if (inner instanceof z.ZodOptional || inner instanceof z.ZodNullable) {
      optional = true;
      inner = inner._def.innerType as z.ZodTypeAny;
    } else if (inner instanceof z.ZodDefault) {
      inner = inner._def.innerType as z.ZodTypeAny;
    } else if (inner instanceof z.ZodEffects) {
      inner = inner._def.schema as z.ZodTypeAny;
    } else break;
  }
  return { inner, optional };
}

const maxOf = (schema: z.ZodString | z.ZodArray<z.ZodTypeAny>): number | null => {
  if (schema instanceof z.ZodArray) return schema._def.maxLength?.value ?? null;
  const check = schema._def.checks.find((c) => c.kind === 'max') as { value: number } | undefined;
  return check?.value ?? null;
};

/** A blank value for a new array element, from its schema. */
export function blankFor(schema: z.ZodTypeAny): unknown {
  if (schema instanceof z.ZodDefault) return schema._def.defaultValue();
  const { inner, optional } = unwrap(schema);
  if (optional) return undefined;
  if (inner instanceof z.ZodObject) {
    const shape = inner.shape as Record<string, z.ZodTypeAny>;
    return Object.fromEntries(
      Object.entries(shape)
        .map(([k, s]) => [k, blankFor(s)] as const)
        .filter(([, v]) => v !== undefined),
    );
  }
  if (inner instanceof z.ZodString) return '';
  if (inner instanceof z.ZodNumber) return 0;
  if (inner instanceof z.ZodBoolean) return false;
  if (inner instanceof z.ZodEnum) return (inner.options as string[])[0];
  if (inner instanceof z.ZodArray) return [];
  return undefined;
}

type Obj = Record<string, unknown>;

export function ConfigEditor({
  schema,
  value,
  onChange,
}: {
  schema: z.ZodTypeAny;
  value: Obj;
  onChange(next: Obj): void;
}) {
  const { inner } = unwrap(schema);
  if (!(inner instanceof z.ZodObject)) return null;
  return (
    <ObjectFields
      shape={inner.shape as Record<string, z.ZodTypeAny>}
      value={value}
      onChange={onChange}
    />
  );
}

function ObjectFields({
  shape,
  value,
  onChange,
}: {
  shape: Record<string, z.ZodTypeAny>;
  value: Obj;
  onChange(next: Obj): void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {Object.entries(shape).map(([key, s]) => (
        <Field
          key={key}
          name={key}
          schema={s}
          value={value[key]}
          onChange={(v) => {
            const next = { ...value };
            if (v === undefined) delete next[key];
            else next[key] = v;
            onChange(next);
          }}
        />
      ))}
    </div>
  );
}

function Labelled({
  id,
  name,
  optional,
  children,
}: {
  id: string;
  name: string;
  optional: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {labelOf(name)}
        {optional ? <span className="font-normal text-muted-foreground"> (optional)</span> : null}
      </Label>
      {children}
      {HINTS[name] ? <p className="text-xs text-muted-foreground">{HINTS[name]}</p> : null}
    </div>
  );
}

const ID_CHOICES: Record<string, () => Choice[]> = {
  categoryIds: useCategoryChoices,
  brandIds: useBrandChoices,
  faqIds: useFaqChoices,
  testimonialIds: useTestimonialChoices,
  storeIds: useStoreChoices,
};

function Field({
  name,
  schema,
  value,
  onChange,
}: {
  name: string;
  schema: z.ZodTypeAny;
  value: unknown;
  onChange(v: unknown): void;
}) {
  const id = useId();
  const { inner, optional } = unwrap(schema);

  if (inner instanceof z.ZodBoolean) {
    return (
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {labelOf(name)}
      </label>
    );
  }

  if (inner instanceof z.ZodEnum) {
    const values = inner.options as string[];
    return (
      <Labelled id={id} name={name} optional={optional}>
        <NativeSelect
          id={id}
          value={(value as string | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
        >
          {optional ? <option value="">Any</option> : null}
          {values.map((v) => (
            <option key={v} value={v}>
              {v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ')}
            </option>
          ))}
        </NativeSelect>
      </Labelled>
    );
  }

  if (inner instanceof z.ZodNumber) {
    return (
      <Labelled id={id} name={name} optional={optional}>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          className="max-w-40"
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) =>
            onChange(e.target.value === '' ? (optional ? undefined : 0) : Number(e.target.value))
          }
        />
      </Labelled>
    );
  }

  if (inner instanceof z.ZodString) {
    if (/mediaId$/i.test(name))
      return (
        <Labelled id={id} name={name} optional={optional}>
          <MediaInput
            id={id}
            value={(value as string | undefined) ?? ''}
            onChange={(v) => onChange(v || (optional ? undefined : ''))}
          />
        </Labelled>
      );
    if (name === 'collectionId' || name === 'categoryId')
      return (
        <ChoiceField id={id} name={name} optional={optional} value={value} onChange={onChange} />
      );
    if (name === 'endsAt')
      return (
        <Labelled id={id} name={name} optional={optional}>
          <Input
            id={id}
            type="datetime-local"
            className="max-w-60"
            value={dateTimeLocal(value as string | undefined)}
            onChange={(e) => onChange(fromDateTimeLocal(e.target.value))}
          />
        </Labelled>
      );
    const max = maxOf(inner);
    const long = name === 'html' || name === 'body' || (max !== null && max > 200);
    const text = (value as string | undefined) ?? '';
    const set = (v: string) => onChange(v === '' && optional ? undefined : v);
    return (
      <Labelled id={id} name={name} optional={optional}>
        {long ? (
          <Textarea
            id={id}
            rows={name === 'html' ? 12 : 3}
            className={name === 'html' ? 'font-mono text-xs' : undefined}
            value={text}
            maxLength={max ?? undefined}
            onChange={(e) => set(e.target.value)}
          />
        ) : (
          <Input
            id={id}
            value={text}
            maxLength={max ?? undefined}
            placeholder={/Hex$/.test(name) ? '#rrggbb' : undefined}
            onChange={(e) => set(e.target.value)}
          />
        )}
      </Labelled>
    );
  }

  if (inner instanceof z.ZodArray) {
    const element = unwrap(inner.element as z.ZodTypeAny).inner;
    const list = Array.isArray(value) ? value : [];
    const max = maxOf(inner);
    if (element instanceof z.ZodString) {
      if (name === 'productIds')
        return <ProductList name={name} value={list as string[]} max={max} onChange={onChange} />;
      return <IdList name={name} value={list as string[]} max={max} onChange={onChange} />;
    }
    if (element instanceof z.ZodObject)
      return (
        <ObjectList
          name={name}
          element={inner.element as z.ZodTypeAny}
          value={list as Obj[]}
          max={max}
          onChange={onChange}
        />
      );
  }

  if (inner instanceof z.ZodObject) {
    return (
      <fieldset className="flex flex-col gap-3 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">{labelOf(name)}</legend>
        <ObjectFields
          shape={inner.shape as Record<string, z.ZodTypeAny>}
          value={(value as Obj | undefined) ?? {}}
          onChange={onChange}
        />
      </fieldset>
    );
  }

  return null;
}

function MediaInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange(v: string): void;
}) {
  const { canCall } = usePermissions();
  const [picking, setPicking] = useState(false);
  const canPick = canCall(mediaRoutes.list);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        id={id}
        value={value}
        readOnly={canPick}
        placeholder="No image"
        className="max-w-xs font-mono text-xs"
        onChange={(e) => onChange(e.target.value.trim())}
      />
      {canPick ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
          {value ? 'Change' : 'Choose image'}
        </Button>
      ) : null}
      {value ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
          Remove
        </Button>
      ) : null}
      {picking ? (
        <MediaPicker
          title="Choose an image"
          multiple={false}
          onClose={() => setPicking(false)}
          onChoose={(assets) => {
            if (assets[0]) onChange(assets[0].id);
            setPicking(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ChoiceField({
  id,
  name,
  optional,
  value,
  onChange,
}: {
  id: string;
  name: 'collectionId' | 'categoryId';
  optional: boolean;
  value: unknown;
  onChange(v: unknown): void;
}) {
  const categories = useCategoryChoices();
  const collections = useCollectionChoices();
  const choices = name === 'categoryId' ? categories : collections;
  const current = (value as string | undefined) ?? '';
  return (
    <Labelled id={id} name={name} optional={optional}>
      <NativeSelect
        id={id}
        value={current}
        onChange={(e) =>
          onChange(e.target.value === '' ? (optional ? undefined : '') : e.target.value)
        }
      >
        <option value="">{optional ? 'None' : 'Choose…'}</option>
        {current && !choices.some((c) => c.value === current) ? (
          <option value={current}>{current} (not in the list)</option>
        ) : null}
        {choices.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </NativeSelect>
    </Labelled>
  );
}

function IdList({
  name,
  value,
  max,
  onChange,
}: {
  name: string;
  value: string[];
  max: number | null;
  onChange(v: unknown): void;
}) {
  const useChoices = ID_CHOICES[name] ?? (() => [] as Choice[]);
  const choices = useChoices();
  const known = new Map(choices.map((c) => [c.value, c.label]));
  const [adding, setAdding] = useState('');
  const full = max !== null && value.length >= max;
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">
        {labelOf(name)}
        {max ? <span className="font-normal text-muted-foreground"> (up to {max})</span> : null}
      </legend>
      {value.length > 0 ? (
        <ol className="flex flex-col divide-y rounded-md border text-sm">
          {value.map((v, i) => (
            <li key={v} className="flex items-center gap-2 px-2 py-1">
              <span className="flex-1">
                {known.get(v) ?? <span className="font-mono text-xs">{v}</span>}
              </span>
              <MoveButtons
                index={i}
                length={value.length}
                onMove={(to) => onChange(move(value, i, to))}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${known.get(v) ?? v}`}
                onClick={() => onChange(value.filter((x) => x !== v))}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
      ) : null}
      {!full ? (
        choices.length > 0 ? (
          <div className="flex gap-2">
            <label htmlFor={id} className="sr-only">
              Add to {labelOf(name)}
            </label>
            <NativeSelect id={id} value={adding} onChange={(e) => setAdding(e.target.value)}>
              <option value="">Choose…</option>
              {choices
                .filter((c) => !value.includes(c.value))
                .map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
            </NativeSelect>
            <Button
              type="button"
              variant="outline"
              disabled={!adding}
              onClick={() => {
                onChange([...value, adding]);
                setAdding('');
              }}
            >
              Add
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              aria-label={`ID to add to ${labelOf(name)}`}
              value={adding}
              placeholder="Paste an ID"
              onChange={(e) => setAdding(e.target.value.trim())}
            />
            <Button
              type="button"
              variant="outline"
              disabled={!adding || value.includes(adding)}
              onClick={() => {
                onChange([...value, adding]);
                setAdding('');
              }}
            >
              Add
            </Button>
          </div>
        )
      ) : null}
    </fieldset>
  );
}

function ProductList({
  name,
  value,
  max,
  onChange,
}: {
  name: string;
  value: string[];
  max: number | null;
  onChange(v: unknown): void;
}) {
  const [names, setNames] = useState<Record<string, string>>({});
  const full = max !== null && value.length >= max;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">
        {labelOf(name)}
        {max ? <span className="font-normal text-muted-foreground"> (up to {max})</span> : null}
      </legend>
      <p className="text-xs text-muted-foreground">{HINTS.productIds}</p>
      {value.length > 0 ? (
        <ol className="flex flex-col divide-y rounded-md border text-sm">
          {value.map((v, i) => (
            <li key={v} className="flex items-center gap-2 px-2 py-1">
              <span className="flex-1">
                {names[v] ?? <span className="font-mono text-xs">{v}</span>}
              </span>
              <MoveButtons
                index={i}
                length={value.length}
                onMove={(to) => onChange(move(value, i, to))}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${names[v] ?? v}`}
                onClick={() => onChange(value.filter((x) => x !== v))}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
      ) : null}
      {!full ? (
        <ProductPicker
          exclude={value}
          actionLabel="Add"
          onPick={(p) => {
            setNames((n) => ({ ...n, [p.id]: p.name }));
            onChange([...value, p.id]);
          }}
        />
      ) : null}
    </fieldset>
  );
}

function ObjectList({
  name,
  element,
  value,
  max,
  onChange,
}: {
  name: string;
  element: z.ZodTypeAny;
  value: Obj[];
  max: number | null;
  onChange(v: unknown): void;
}) {
  const shape = (unwrap(element).inner as z.ZodObject<z.ZodRawShape>).shape as Record<
    string,
    z.ZodTypeAny
  >;
  const singular = labelOf(name).replace(/s$/, '');
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">
        {labelOf(name)}
        {max ? <span className="font-normal text-muted-foreground"> (up to {max})</span> : null}
      </legend>
      {value.map((item, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">
              {singular} {i + 1}
            </span>
            <span className="flex items-center">
              <MoveButtons
                index={i}
                length={value.length}
                onMove={(to) => onChange(move(value, i, to))}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${singular.toLowerCase()} ${i + 1}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <Trash2 aria-hidden />
              </Button>
            </span>
          </div>
          <ObjectFields
            shape={shape}
            value={item}
            onChange={(next) => onChange(value.map((x, j) => (j === i ? next : x)))}
          />
        </div>
      ))}
      {max === null || value.length < max ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => onChange([...value, blankFor(element) as Obj])}
        >
          <Plus aria-hidden />
          Add {singular.toLowerCase()}
        </Button>
      ) : null}
    </fieldset>
  );
}

function move<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

function MoveButtons({
  index,
  length,
  onMove,
}: {
  index: number;
  length: number;
  onMove(to: number): void;
}) {
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={index === 0}
        aria-label="Move up"
        onClick={() => onMove(index - 1)}
      >
        <ArrowUp aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={index === length - 1}
        aria-label="Move down"
        onClick={() => onMove(index + 1)}
      >
        <ArrowDown aria-hidden />
      </Button>
    </>
  );
}
