'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { CollectionRules } from '@shared/schemas/catalogAdmin';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { useUnsavedChangesGuard } from '@/components/patterns/form/use-unsaved-changes-guard';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { endpoints } from '@/lib/api/endpoints';
import { formatNumber } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';

import { catalogKeys } from '../../api';
import {
  flattenTree,
  useAttributeOptions,
  useBrandOptions,
  useCategoryOptions,
  useTaxClassOptions,
} from '../../lookups';
import { PRODUCT_TYPE_LABELS, productHref } from '../../products/model';
import {
  collectionKeys,
  collectionsApi,
  parseRules,
  type CollectionDetail,
  type RulePreview,
} from '../api';
import {
  OPERATOR_LABELS,
  RULE_FIELDS,
  STOCK_STATUS_LABELS,
  blankRule,
  coerceValue,
  describeRules,
  isList,
  type NameLookup,
  type Rule,
} from '../model';

type Group = CollectionRules['groups'][number];
interface Option {
  value: string;
  label: string;
  group?: string;
}

const EMPTY: CollectionRules = {
  match: 'ALL',
  groups: [{ match: 'ALL', rules: [blankRule('categoryId')] }],
};

export function RulesTab({ collection }: { collection: CollectionDetail }) {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const stored = useMemo(() => parseRules(collection.rulesJson), [collection.rulesJson]);
  const [rules, setRules] = useState<CollectionRules>(stored ?? EMPTY);
  const [preview, setPreview] = useState<RulePreview | null>(null);
  const dirty = JSON.stringify(rules) !== JSON.stringify(stored ?? EMPTY);
  useUnsavedChangesGuard(dirty);
  const canEdit = canCall(endpoints.collections.update) && !collection.deletedAt;
  const canPreview = canCall(endpoints.collections.previewRules);

  const categories = useCategoryOptions();
  const brands = useBrandOptions();
  const taxClasses = useTaxClassOptions();
  const attributes = useAttributeOptions();
  const options = useMemo(() => {
    const tree = flattenTree(categories.data ?? []);
    return {
      category: tree.map((c) => ({
        value: c.id,
        label: `${'\u00a0\u00a0'.repeat(c.depth)}${c.name}`,
      })),
      categoryPath: tree.map((c) => ({
        value: c.path,
        label: `${'\u00a0\u00a0'.repeat(c.depth)}${c.name}`,
      })),
      brand: (brands.data ?? []).map((b) => ({ value: b.id, label: b.name })),
      taxClass: (taxClasses.data ?? []).map((t) => ({ value: t.id, label: t.name })),
      attributeValue: (attributes.data ?? []).flatMap((a) =>
        a.values.map((v) => ({ value: v.id, label: v.label, group: a.name })),
      ),
      productType: Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
      stockStatus: Object.entries(STOCK_STATUS_LABELS).map(([value, label]) => ({ value, label })),
    } satisfies Record<string, Option[]>;
  }, [categories.data, brands.data, taxClasses.data, attributes.data]);
  const names: NameLookup = {
    category: (id) => categories.data?.find((c) => c.id === id)?.name,
    brand: (id) => brands.data?.find((b) => b.id === id)?.name,
    taxClass: (id) => taxClasses.data?.find((t) => t.id === id)?.name,
    attributeValue: (id) => options.attributeValue.find((o) => o.value === id)?.label,
  };

  const runPreview = useMutation({
    mutationFn: () => collectionsApi.previewRules(rules),
    onSuccess: setPreview,
  });
  const save = useMutation({
    mutationFn: () => collectionsApi.update(collection.id, { rules, version: collection.version }),
    onSuccess: (next) => {
      queryClient.setQueryData(collectionKeys.detail(collection.id), next);
      void queryClient.invalidateQueries({ queryKey: collectionKeys.all });
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      notifySuccess('Rules saved', 'Re-evaluate the collection to refresh its products now.');
    },
  });

  const setGroup = (index: number, group: Group) =>
    setRules((current) => ({
      ...current,
      groups: current.groups.map((g, i) => (i === index ? group : g)),
    }));
  const setRule = (gi: number, ri: number, rule: Rule) => {
    const group = rules.groups[gi]!;
    setGroup(gi, { ...group, rules: group.rules.map((r, i) => (i === ri ? rule : r)) });
    setPreview(null);
  };

  return (
    <section aria-labelledby="rules-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="rules-heading" className="text-base font-semibold">
          Rules
        </h2>
        <p className="text-sm text-muted-foreground">
          Published products that match join automatically. Check the preview before saving.
        </p>
      </div>
      <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
        {describeRules(rules, names)}
      </p>
      <FormAlert error={save.error ?? runPreview.error} />
      <fieldset disabled={!canEdit} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Label htmlFor="rules-match">Products must match</Label>
          <NativeSelect
            id="rules-match"
            className="w-auto"
            value={rules.match}
            onChange={(event) => setRules({ ...rules, match: event.target.value as 'ALL' | 'ANY' })}
          >
            <option value="ALL">every group</option>
            <option value="ANY">at least one group</option>
          </NativeSelect>
        </div>
        {rules.groups.map((group, gi) => (
          <fieldset key={gi} className="flex flex-col gap-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Group {gi + 1}</legend>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Label htmlFor={`group-${gi}-match`}>Match</Label>
              <NativeSelect
                id={`group-${gi}-match`}
                className="w-auto"
                value={group.match}
                onChange={(event) =>
                  setGroup(gi, { ...group, match: event.target.value as 'ALL' | 'ANY' })
                }
              >
                <option value="ALL">all conditions</option>
                <option value="ANY">any condition</option>
              </NativeSelect>
              {rules.groups.length > 1 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() =>
                    setRules({ ...rules, groups: rules.groups.filter((_, i) => i !== gi) })
                  }
                >
                  Remove group
                </Button>
              ) : null}
            </div>
            {group.rules.map((rule, ri) => (
              <RuleRow
                key={ri}
                id={`rule-${gi}-${ri}`}
                rule={rule}
                options={options}
                onChange={(next) => setRule(gi, ri, next)}
                onRemove={
                  group.rules.length > 1
                    ? () =>
                        setGroup(gi, { ...group, rules: group.rules.filter((_, i) => i !== ri) })
                    : undefined
                }
              />
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-fit"
              disabled={group.rules.length >= 20}
              onClick={() =>
                setGroup(gi, { ...group, rules: [...group.rules, blankRule('brandId')] })
              }
            >
              <Plus aria-hidden />
              Add condition
            </Button>
          </fieldset>
        ))}
        <div className="flex flex-wrap items-end gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={rules.groups.length >= 10}
            onClick={() =>
              setRules({
                ...rules,
                groups: [...rules.groups, { match: 'ALL', rules: [blankRule('categoryId')] }],
              })
            }
          >
            <Plus aria-hidden />
            Add group
          </Button>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rules-limit">At most (optional)</Label>
            <Input
              id="rules-limit"
              inputMode="numeric"
              className="w-32"
              value={rules.limit ?? ''}
              onChange={(event) => {
                const n = Number(event.target.value);
                setRules({
                  ...rules,
                  limit:
                    event.target.value && Number.isInteger(n) && n >= 1 && n <= 500 ? n : undefined,
                });
              }}
            />
          </div>
        </div>
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2">
        {canPreview ? (
          <Button
            type="button"
            variant="outline"
            loading={runPreview.isPending}
            onClick={() => runPreview.mutate()}
          >
            Preview matches
          </Button>
        ) : null}
        {dirty && canEdit ? (
          <Button type="button" variant="ghost" onClick={() => setRules(stored ?? EMPTY)}>
            Discard
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            type="button"
            disabled={!dirty}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            Save rules
          </Button>
        ) : null}
      </div>
      {preview ? (
        <Alert
          tone={preview.matched > 0 ? 'info' : 'warning'}
          title={`${formatNumber(preview.matched)} product${preview.matched === 1 ? '' : 's'} match right now`}
        >
          {preview.sample.length > 0 ? (
            <ul className="mt-1 list-disc pl-5">
              {preview.sample.map((product) => (
                <li key={product.id}>
                  <Link
                    href={productHref(product.id)}
                    className="underline-offset-2 hover:underline"
                  >
                    {product.name}
                  </Link>{' '}
                  <span className="font-mono text-xs">{product.sku}</span>
                </li>
              ))}
            </ul>
          ) : (
            'No published product matches these rules.'
          )}
        </Alert>
      ) : null}
    </section>
  );
}

function RuleRow({
  id,
  rule,
  options,
  onChange,
  onRemove,
}: {
  id: string;
  rule: Rule;
  options: Record<string, Option[]>;
  onChange(rule: Rule): void;
  onRemove?: () => void;
}) {
  const config = RULE_FIELDS[rule.field];
  const unsupported = !config;
  return (
    <div className="grid gap-2 sm:grid-cols-[12rem_10rem_minmax(0,1fr)_auto] sm:items-end">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-field`} className="text-xs">
          Field
        </Label>
        <NativeSelect
          id={`${id}-field`}
          value={rule.field}
          onChange={(event) => onChange(blankRule(event.target.value))}
        >
          {unsupported ? <option value={rule.field}>{rule.field} (kept as stored)</option> : null}
          {Object.entries(RULE_FIELDS).map(([value, field]) => (
            <option key={value} value={value}>
              {field.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-op`} className="text-xs">
          Condition
        </Label>
        <NativeSelect
          id={`${id}-op`}
          value={rule.operator}
          disabled={unsupported}
          onChange={(event) => {
            const operator = event.target.value as Rule['operator'];
            onChange({ ...rule, operator, value: coerceValue(rule, operator) });
          }}
        >
          {(config?.operators ?? [rule.operator]).map((operator) => (
            <option key={operator} value={operator}>
              {OPERATOR_LABELS[operator]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <ValueInput
        id={`${id}-value`}
        rule={rule}
        options={options}
        onChange={(value) => onChange({ ...rule, value })}
      />
      {onRemove ? (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Remove condition"
          onClick={onRemove}
          className="mb-1"
        >
          <Trash2 aria-hidden />
        </Button>
      ) : (
        <span />
      )}
    </div>
  );
}

function ValueInput({
  id,
  rule,
  options,
  onChange,
}: {
  id: string;
  rule: Rule;
  options: Record<string, Option[]>;
  onChange(value: Rule['value']): void;
}) {
  const kind = RULE_FIELDS[rule.field]?.kind;
  const label = (
    <Label htmlFor={id} className="text-xs">
      Value
    </Label>
  );
  if (!kind) return <p className="text-sm text-muted-foreground">{JSON.stringify(rule.value)}</p>;
  if (kind === 'boolean') {
    return (
      <div className="flex flex-col gap-1">
        {label}
        <NativeSelect
          id={id}
          value={String(rule.value)}
          onChange={(event) => onChange(event.target.value === 'true')}
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </NativeSelect>
      </div>
    );
  }
  const list = options[kind];
  if (list) {
    const multiple = isList(rule.operator);
    const groups = [...new Set(list.map((o) => o.group).filter(Boolean))] as string[];
    const render = (items: Option[]) =>
      items.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ));
    return (
      <div className="flex flex-col gap-1">
        {label}
        <NativeSelect
          id={id}
          multiple={multiple}
          className={multiple ? 'h-28' : undefined}
          value={multiple ? (rule.value as string[]).map(String) : String(rule.value)}
          onChange={(event) =>
            onChange(
              multiple
                ? Array.from(event.target.selectedOptions, (o) => o.value)
                : event.target.value,
            )
          }
        >
          {multiple ? null : <option value="">Choose…</option>}
          {groups.length
            ? groups.map((group) => (
                <optgroup key={group} label={group}>
                  {render(list.filter((o) => o.group === group))}
                </optgroup>
              ))
            : render(list)}
        </NativeSelect>
      </div>
    );
  }
  if (kind === 'money' || kind === 'number') {
    const toText = (v: string | number | boolean | undefined) =>
      kind === 'money' ? String(Number(v ?? 0) / 100) : String(v ?? 0);
    const fromText = (text: string) =>
      (kind === 'money' ? Math.round(Number(text) * 100) : Math.round(Number(text))) || 0;
    if (rule.operator === 'BETWEEN') {
      const [from, to] = Array.isArray(rule.value) ? rule.value : [0, 0];
      return (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-from`} className="text-xs">
              From{kind === 'money' ? ' (₹)' : ''}
            </Label>
            <Input
              id={`${id}-from`}
              inputMode="decimal"
              defaultValue={toText(from)}
              onBlur={(e) => onChange([fromText(e.target.value), Number(to ?? 0)])}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-to`} className="text-xs">
              To{kind === 'money' ? ' (₹)' : ''}
            </Label>
            <Input
              id={`${id}-to`}
              inputMode="decimal"
              defaultValue={toText(to)}
              onBlur={(e) => onChange([Number(from ?? 0), fromText(e.target.value)])}
            />
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={id} className="text-xs">
          Value{kind === 'money' ? ' (₹)' : ''}
        </Label>
        <Input
          id={id}
          inputMode="decimal"
          defaultValue={toText(rule.value as number)}
          key={`${rule.field}-${rule.operator}`}
          onBlur={(event) => onChange(fromText(event.target.value))}
        />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {label}
      <Input
        id={id}
        maxLength={200}
        value={String(rule.value)}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
