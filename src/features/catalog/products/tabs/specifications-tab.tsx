'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import type { ProductAttributeValuesInput } from '@shared/schemas/catalogAdmin';
import type { AdminProductDetailDto } from '@shared/types/catalogAdmin';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { useUnsavedChangesGuard } from '@/components/patterns/form/use-unsaved-changes-guard';
import { EmptyState, ErrorState, SectionLoader } from '@/components/patterns/states';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { categoriesRoutes } from '@/lib/api/routes/categories';
import { productsRoutes } from '@/lib/api/routes/products';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { useAttributeGroups, useAttributeOptions } from '../../lookups';
import { categoriesApi, taxonomyKeys, type AttributeRow } from '../../taxonomy/api';
import { productsApi, productKeys } from '../api';
import { usePublishBlockers } from '../use-publish-blockers';

type Entry = ProductAttributeValuesInput['values'][number];
type Draft = Record<
  string,
  { valueIds: string[]; text: string; number: string; bool: '' | 'yes' | 'no' }
>;

const CHOICE = new Set(['SELECT', 'SWATCH_COLOR', 'SWATCH_IMAGE']);

function toDraft(product: AdminProductDetailDto): Draft {
  const draft: Draft = {};
  for (const value of product.attributeValues) {
    const entry = (draft[value.attributeId] ??= { valueIds: [], text: '', number: '', bool: '' });
    if (value.attributeValueId) entry.valueIds.push(value.attributeValueId);
    if (value.valueText !== null) entry.text = value.valueText;
    if (value.valueNumber !== null) entry.number = String(value.valueNumber);
    if (value.valueBoolean !== null) entry.bool = value.valueBoolean ? 'yes' : 'no';
  }
  return draft;
}

function toEntries(draft: Draft): { entries: Entry[]; invalid: string[] } {
  const entries: Entry[] = [];
  const invalid: string[] = [];
  let position = 0;
  for (const [attributeId, entry] of Object.entries(draft)) {
    for (const valueId of entry.valueIds) {
      entries.push({ attributeId, attributeValueId: valueId, position: position++ });
    }
    if (entry.text.trim())
      entries.push({ attributeId, valueText: entry.text.trim(), position: position++ });
    if (entry.number.trim()) {
      if (/^-?\d+$/.test(entry.number.trim())) {
        entries.push({
          attributeId,
          valueNumber: Number(entry.number.trim()),
          position: position++,
        });
      } else invalid.push(attributeId);
    }
    if (entry.bool)
      entries.push({ attributeId, valueBoolean: entry.bool === 'yes', position: position++ });
  }
  return { entries, invalid };
}

/** Product specifications: one value (or several) per attribute, saved as one set. */
export function SpecificationsTab({ product }: { product: AdminProductDetailDto }) {
  const queryClient = useQueryClient();
  const { canCall } = usePermissions();
  const attributes = useAttributeOptions();
  const groups = useAttributeGroups();
  const primary = product.categories.find((c) => c.isPrimary)?.categoryId ?? null;
  const links = useQuery({
    queryKey: taxonomyKeys.categoryPart(primary ?? '-', 'attributes'),
    queryFn: ({ signal }) => categoriesApi.attributes(primary!, signal),
    enabled: Boolean(primary) && canCall(categoriesRoutes.attributes),
    ...cachePolicy.reference,
  });
  const canEdit = canCall(productsRoutes.setAttributeValues) && !product.deletedAt;
  const gate = usePublishBlockers(product);
  const foreign = new Set(
    (gate.data ?? [])
      .filter((blocker) => blocker.code === 'INVALID_CATEGORY_ATTRIBUTES')
      .flatMap((blocker) => {
        const ids = blocker.details?.attributeIds;
        return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
      }),
  );
  const initial = useMemo(() => toDraft(product), [product]);
  const [draft, setDraft] = useState<Draft>(initial);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  useUnsavedChangesGuard(dirty);

  const required = new Set(
    (links.data ?? []).filter((link) => link.isRequired).map((link) => link.attributeId),
  );
  const { entries, invalid } = toEntries(draft);

  const save = useMutation({
    mutationFn: () => productsApi.setAttributeValues(product.id, { values: entries }),
    onSuccess: (next) => {
      queryClient.setQueryData(productKeys.detail(product.id), next);
      notifySuccess('Specifications saved');
    },
  });

  if (attributes.isPending) return <SectionLoader label="Loading attributes…" />;
  if (attributes.error) {
    return <ErrorState error={attributes.error} onRetry={() => void attributes.refetch()} />;
  }
  const active = attributes.data.filter((attribute) => attribute.isActive || draft[attribute.id]);
  if (active.length === 0) {
    return (
      <EmptyState
        title="No attributes defined"
        description="Create attributes such as Material or Seat depth first; they become the product's specifications."
      />
    );
  }

  const groupName = new Map((groups.data ?? []).map((group) => [group.id, group.name]));
  const byGroup = new Map<string, AttributeRow[]>();
  for (const attribute of active) {
    const name = attribute.groupId ? (groupName.get(attribute.groupId) ?? 'Other') : 'Other';
    byGroup.set(name, [...(byGroup.get(name) ?? []), attribute]);
  }

  const set = (attributeId: string, patch: Partial<Draft[string]>) =>
    setDraft((current) => ({
      ...current,
      [attributeId]: Object.assign(
        { valueIds: [], text: '', number: '', bool: '' as const },
        current[attributeId],
        patch,
      ),
    }));

  return (
    <div className="flex flex-col gap-5">
      <FormAlert
        error={save.error}
        messages={invalid.length > 0 ? ['Numbers must be whole numbers.'] : []}
      />
      {foreign.size > 0 ? (
        <Alert tone="warning" title="Publishing is blocked by these specifications">
          {attributes.data
            .filter((attribute) => foreign.has(attribute.id))
            .map((attribute) => attribute.name)
            .join(', ')}{' '}
          {foreign.size === 1 ? 'is' : 'are'} not used by the primary category. Clear{' '}
          {foreign.size === 1 ? 'that value' : 'those values'} here, or link the attribute to the
          primary category (or one of its parents) under Categories → Attributes.
        </Alert>
      ) : null}
      {[...byGroup.entries()].map(([group, list]) => (
        <fieldset key={group} className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5">
          <legend className="px-1 text-base font-semibold">{group}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {list.map((attribute) => {
              const entry = draft[attribute.id] ?? { valueIds: [], text: '', number: '', bool: '' };
              const id = `spec-${attribute.id}`;
              const label = (
                <span className="flex flex-wrap items-center gap-1.5">
                  {attribute.name}
                  {attribute.unit ? (
                    <span className="text-muted-foreground">({attribute.unit})</span>
                  ) : null}
                  {required.has(attribute.id) ? (
                    <Badge tone="warning">Required by category</Badge>
                  ) : null}
                  {foreign.has(attribute.id) ? (
                    <Badge tone="danger">Not in the primary category</Badge>
                  ) : null}
                  {attribute.isVariantDefining ? (
                    <Badge tone="outline">Variant option</Badge>
                  ) : null}
                </span>
              );
              const values = attribute.values.filter(
                (value) => value.isActive || entry.valueIds.includes(value.id),
              );
              return (
                <div key={attribute.id} className="flex flex-col gap-1.5">
                  {attribute.inputType === 'MULTISELECT' ? (
                    <fieldset>
                      <legend className="mb-1 text-sm font-medium">{label}</legend>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {values.map((value) => (
                          <label key={value.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="size-4 accent-primary"
                              disabled={!canEdit}
                              checked={entry.valueIds.includes(value.id)}
                              onChange={(event) =>
                                set(attribute.id, {
                                  valueIds: event.target.checked
                                    ? [...entry.valueIds, value.id]
                                    : entry.valueIds.filter((v) => v !== value.id),
                                })
                              }
                            />
                            {value.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ) : (
                    <>
                      <label htmlFor={id} className="text-sm font-medium">
                        {label}
                      </label>
                      {CHOICE.has(attribute.inputType) ? (
                        <NativeSelect
                          id={id}
                          disabled={!canEdit}
                          value={entry.valueIds[0] ?? ''}
                          onChange={(event) =>
                            set(attribute.id, {
                              valueIds: event.target.value ? [event.target.value] : [],
                            })
                          }
                        >
                          <option value="">Not set</option>
                          {values.map((value) => (
                            <option key={value.id} value={value.id}>
                              {value.label}
                            </option>
                          ))}
                        </NativeSelect>
                      ) : attribute.inputType === 'BOOLEAN' ? (
                        <NativeSelect
                          id={id}
                          disabled={!canEdit}
                          value={entry.bool}
                          onChange={(event) =>
                            set(attribute.id, { bool: event.target.value as Draft[string]['bool'] })
                          }
                        >
                          <option value="">Not set</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </NativeSelect>
                      ) : attribute.inputType === 'NUMBER' ? (
                        <Input
                          id={id}
                          inputMode="numeric"
                          disabled={!canEdit}
                          value={entry.number}
                          aria-invalid={invalid.includes(attribute.id) || undefined}
                          onChange={(event) => set(attribute.id, { number: event.target.value })}
                        />
                      ) : (
                        <Input
                          id={id}
                          maxLength={500}
                          disabled={!canEdit}
                          value={entry.text}
                          onChange={(event) => set(attribute.id, { text: event.target.value })}
                        />
                      )}
                    </>
                  )}
                  {attribute.helpText ? (
                    <p className="text-xs text-muted-foreground">{attribute.helpText}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
      {canEdit ? (
        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t bg-background py-3">
          <span role="status" className="mr-auto text-sm text-muted-foreground">
            {dirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
          <Button
            variant="ghost"
            disabled={!dirty || save.isPending}
            onClick={() => setDraft(initial)}
          >
            Discard
          </Button>
          <Button
            disabled={!dirty || invalid.length > 0}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            Save specifications
          </Button>
        </div>
      ) : null}
    </div>
  );
}
