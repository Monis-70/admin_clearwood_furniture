'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import type { AdminProductDetailDto } from '@shared/types/catalogAdmin';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { useUnsavedChangesGuard } from '@/components/patterns/form/use-unsaved-changes-guard';
import { ErrorState, SectionLoader } from '@/components/patterns/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { notifySuccess } from '@/lib/notify';

import { catalogKeys } from '../../api';
import { categoryTrail, flattenTree, useCategoryOptions } from '../../lookups';
import { productsApi, productKeys } from '../api';

/** Primary category (breadcrumbs, URL, required attributes) plus any number of extra listings. */
export function CategoryAssignment({
  product,
  canEdit,
}: {
  product: AdminProductDetailDto;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const tree = useCategoryOptions();
  const initialPrimary = product.categories.find((c) => c.isPrimary)?.categoryId ?? '';
  const initialOthers = product.categories.filter((c) => !c.isPrimary).map((c) => c.categoryId);
  const [primary, setPrimary] = useState(initialPrimary);
  const [others, setOthers] = useState<string[]>(initialOthers);
  const [filter, setFilter] = useState('');
  const ordered = useMemo(() => flattenTree(tree.data ?? []), [tree.data]);
  const dirty =
    primary !== initialPrimary || [...others].sort().join() !== [...initialOthers].sort().join();
  useUnsavedChangesGuard(dirty);

  const save = useMutation({
    mutationFn: () =>
      productsApi.setCategories(product.id, {
        primaryCategoryId: primary,
        categoryIds: others.filter((id) => id !== primary),
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(productKeys.detail(product.id), next);
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      notifySuccess('Categories saved');
    },
  });

  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? ordered.filter((category) => category.name.toLowerCase().includes(needle))
    : ordered;

  return (
    <section
      aria-labelledby="product-categories"
      className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5"
    >
      <div>
        <h2 id="product-categories" className="text-base font-semibold">
          Categories
        </h2>
        <p className="text-sm text-muted-foreground">
          The primary category decides the product&apos;s address and required specifications. It
          can also be listed in other categories.
        </p>
      </div>
      {tree.isPending ? (
        <SectionLoader label="Loading categories…" />
      ) : tree.error ? (
        <ErrorState error={tree.error} onRetry={() => void tree.refetch()} compact />
      ) : (
        <>
          <FormAlert error={save.error} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="primary-category">Primary category</Label>
            <NativeSelect
              id="primary-category"
              value={primary}
              disabled={!canEdit}
              onChange={(event) => setPrimary(event.target.value)}
            >
              <option value="">Choose a category</option>
              {ordered.map((category) => (
                <option key={category.id} value={category.id} disabled={!category.isActive}>
                  {'\u00a0\u00a0'.repeat(category.depth)}
                  {category.name}
                  {category.isActive ? '' : ' (inactive)'}
                </option>
              ))}
            </NativeSelect>
            {primary ? (
              <p className="text-xs text-muted-foreground">{categoryTrail(tree.data, primary)}</p>
            ) : null}
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Also listed in</legend>
            <Input
              type="search"
              aria-label="Filter categories"
              placeholder="Filter categories…"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            <div
              tabIndex={0}
              role="group"
              aria-label="Categories it can also be listed in"
              className="max-h-64 overflow-y-auto rounded-md border p-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {visible.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">No category matches.</p>
              ) : (
                visible.map((category) => {
                  const id = `also-${category.id}`;
                  const isPrimary = category.id === primary;
                  return (
                    <div
                      key={category.id}
                      className="flex items-center gap-2 py-1"
                      style={{ paddingLeft: needle ? 0 : category.depth * 16 }}
                    >
                      <input
                        id={id}
                        type="checkbox"
                        className="size-4 accent-primary"
                        disabled={!canEdit || isPrimary}
                        checked={isPrimary || others.includes(category.id)}
                        onChange={(event) =>
                          setOthers((current) =>
                            event.target.checked
                              ? [...current, category.id]
                              : current.filter((value) => value !== category.id),
                          )
                        }
                      />
                      <label htmlFor={id} className="text-sm">
                        {needle ? categoryTrail(tree.data, category.id) : category.name}
                        {isPrimary ? (
                          <span className="ml-1 text-xs text-muted-foreground">(primary)</span>
                        ) : null}
                      </label>
                    </div>
                  );
                })
              )}
            </div>
          </fieldset>
          {canEdit ? (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={!dirty || save.isPending}
                onClick={() => {
                  setPrimary(initialPrimary);
                  setOthers(initialOthers);
                }}
              >
                Discard
              </Button>
              <Button
                type="button"
                disabled={!dirty || !primary}
                loading={save.isPending}
                onClick={() => save.mutate()}
              >
                Save categories
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
