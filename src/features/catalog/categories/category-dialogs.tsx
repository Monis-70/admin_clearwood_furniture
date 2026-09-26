'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { DeleteStrategy } from '@shared/enums';
import type { AdminCategoryDto } from '@shared/types/catalogAdmin';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { SectionLoader } from '@/components/patterns/states';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { formatNumber } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';

import { catalogKeys } from '../api';
import { categoryTrail, flattenTree } from '../lookups';
import { categoriesApi, taxonomyKeys } from '../taxonomy/api';

import type { CategoryDialog } from './categories-screen';
import { DELETE_STRATEGIES, KIND_OPTIONS, descendantIds } from './model';

export function CategoryDialogs({
  dialog,
  categories,
  onClose,
  onCreated,
  onDeleted,
}: {
  dialog: CategoryDialog;
  categories: readonly AdminCategoryDto[];
  onClose(): void;
  onCreated(category: AdminCategoryDto): void;
  onDeleted(): void;
}) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: catalogKeys.categoryTree() });
    void queryClient.invalidateQueries({ queryKey: taxonomyKeys.categories });
  };
  if (dialog.kind === 'create') {
    return (
      <CreateDialog
        parentId={dialog.parentId}
        categories={categories}
        onClose={onClose}
        onCreated={(category) => {
          refresh();
          onClose();
          onCreated(category);
        }}
      />
    );
  }
  if (dialog.kind === 'move') {
    return (
      <MoveDialog
        category={dialog.category}
        categories={categories}
        onClose={onClose}
        onMoved={refresh}
      />
    );
  }
  return (
    <DeleteDialog
      category={dialog.category}
      onClose={onClose}
      onDeleted={() => {
        refresh();
        onClose();
        onDeleted();
      }}
    />
  );
}

function ParentSelect({
  id,
  value,
  onChange,
  categories,
  exclude,
}: {
  id: string;
  value: string;
  onChange(value: string): void;
  categories: readonly AdminCategoryDto[];
  exclude?: Set<string>;
}) {
  return (
    <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Top level (no parent)</option>
      {flattenTree(categories).map((category) => (
        <option key={category.id} value={category.id} disabled={exclude?.has(category.id)}>
          {'\u00a0\u00a0'.repeat(category.depth)}
          {category.name}
        </option>
      ))}
    </NativeSelect>
  );
}

function CreateDialog({
  parentId,
  categories,
  onClose,
  onCreated,
}: {
  parentId: string | null;
  categories: readonly AdminCategoryDto[];
  onClose(): void;
  onCreated(category: AdminCategoryDto): void;
}) {
  const keyFor = useIdempotencyKey();
  const [name, setName] = useState('');
  const [parent, setParent] = useState(parentId ?? '');
  const [kind, setKind] = useState('STANDARD');
  const create = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        parentId: parent || null,
        kind: kind as never,
        isActive: true,
        showInMenu: true,
        isFeatured: false,
      };
      return categoriesApi.create(body, keyFor(body));
    },
    onSuccess: (category) => {
      notifySuccess('Category created', `${category.name} is ready to fill in.`);
      onCreated(category);
    },
  });
  return (
    <Dialog open onOpenChange={(open) => (open || create.isPending ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New category</DialogTitle>
          <DialogDescription>
            Details, attributes and SEO can be added once it exists.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length >= 2) create.mutate();
          }}
        >
          <FormAlert error={create.error} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-category-name">Name</Label>
            <Input
              id="new-category-name"
              value={name}
              maxLength={160}
              autoFocus
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-category-parent">Parent</Label>
            <ParentSelect
              id="new-category-parent"
              value={parent}
              onChange={setParent}
              categories={categories}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-category-kind">Kind</Label>
            <NativeSelect
              id="new-category-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={name.trim().length < 2} loading={create.isPending}>
              Create category
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({
  category,
  categories,
  onClose,
  onMoved,
}: {
  category: AdminCategoryDto;
  categories: readonly AdminCategoryDto[];
  onClose(): void;
  onMoved(): void;
}) {
  const [parent, setParent] = useState(category.parentId ?? '');
  const move = useMutation({
    mutationFn: () =>
      categoriesApi.move(category.id, { parentId: parent || null, version: category.version }),
    onSuccess: (moved) => {
      notifySuccess('Category moved', `Now at ${moved.path.split('/').join(' › ')}.`);
      onMoved();
      onClose();
    },
  });
  const exclude = descendantIds(categories, category.id);
  return (
    <Dialog open onOpenChange={(open) => (open || move.isPending ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move {category.name}</DialogTitle>
          <DialogDescription>Its subcategories and products move with it.</DialogDescription>
        </DialogHeader>
        <FormAlert error={move.error} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="move-parent">New parent</Label>
          <ParentSelect
            id="move-parent"
            value={parent}
            onChange={setParent}
            categories={categories}
            exclude={exclude}
          />
          <p className="text-xs text-muted-foreground">
            Now: {categoryTrail(categories, category.id)}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={move.isPending}>
            Cancel
          </Button>
          <Button
            disabled={(parent || null) === category.parentId}
            loading={move.isPending}
            onClick={() => move.mutate()}
          >
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  category,
  onClose,
  onDeleted,
}: {
  category: AdminCategoryDto;
  onClose(): void;
  onDeleted(): void;
}) {
  const [strategy, setStrategy] = useState<DeleteStrategy>('BLOCK');
  const [typed, setTyped] = useState('');
  const impact = useQuery({
    queryKey: taxonomyKeys.categoryPart(category.id, 'delete-impact', strategy),
    queryFn: ({ signal }) => categoriesApi.deleteImpact(category.id, strategy, signal),
    staleTime: 0,
  });
  const remove = useMutation({
    mutationFn: () => categoriesApi.remove(category.id, strategy),
    onSuccess: () => {
      notifySuccess(`${category.name} deleted`, 'It can be restored from “Including deleted”.');
      onDeleted();
    },
  });
  const blocked = impact.data?.blocked ?? true;

  return (
    <Dialog open onOpenChange={(open) => (open || remove.isPending ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete {category.name}?</DialogTitle>
          <DialogDescription>
            Choose what happens to what is inside it. The preview comes from the server.
          </DialogDescription>
        </DialogHeader>
        <FormAlert error={remove.error} />
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">What to delete</legend>
          {Object.entries(DELETE_STRATEGIES).map(([value, info]) => (
            <label
              key={value}
              className="flex items-start gap-2 rounded-md border p-2 text-sm has-[:checked]:border-primary"
            >
              <input
                type="radio"
                name="delete-strategy"
                value={value}
                checked={strategy === value}
                onChange={() => setStrategy(value as DeleteStrategy)}
                className="mt-0.5 accent-primary"
              />
              <span>
                <span className="font-medium">{info.label}</span>
                <span className="block text-xs text-muted-foreground">{info.explain}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div role="status" aria-live="polite" className="rounded-md border bg-muted/40 p-3 text-sm">
          {impact.isPending ? (
            <SectionLoader label="Checking what would change…" className="py-2" />
          ) : impact.error ? (
            <FormAlert error={impact.error} />
          ) : (
            <>
              <p className="font-medium">This would affect:</p>
              <ul className="mt-1 list-disc pl-5">
                <li>
                  {formatNumber(impact.data.descendants)} subcategories (
                  {formatNumber(impact.data.directChildren)} directly below)
                </li>
                <li>
                  {formatNumber(impact.data.descendantProducts)} product listings (
                  {formatNumber(impact.data.directProducts)} in this category)
                </li>
              </ul>
              {impact.data.blocked ? (
                <Alert tone="warning" title="Not possible with this choice" className="mt-2">
                  {impact.data.blockReason ?? 'The server refuses this deletion.'}
                </Alert>
              ) : null}
            </>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm-category">Type {category.name} to confirm</Label>
          <Input
            id="confirm-category"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={remove.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={blocked || typed.trim() !== category.name}
            loading={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Delete category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
