'use client';

import type { ReactNode } from 'react';
import { useController, type FieldPath, type FieldValues } from 'react-hook-form';

import { ImageField } from '@/features/media/image-field';

/** One image of a content record: upload a new one or choose from the library, with a preview. */
export function MediaField<T extends FieldValues>({
  name,
  label,
  description,
}: {
  name: FieldPath<T>;
  label: string;
  description?: string;
}) {
  return <ImageField<T> name={name} label={label} description={description} />;
}

/** Several choices from a known list, stored as an array of values. */
export function ChecklistField<T extends FieldValues>({
  name,
  label,
  description,
  choices,
  emptyText = 'Nothing to choose from yet.',
}: {
  name: FieldPath<T>;
  label: string;
  description?: ReactNode;
  choices: readonly { value: string; label: string }[];
  emptyText?: string;
}) {
  const { field } = useController<T>({ name });
  const value = (field.value as string[] | undefined) ?? [];
  const known = new Set(choices.map((c) => c.value));
  const unknown = value.filter((v) => !known.has(v));
  const toggle = (v: string) =>
    field.onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium">{label}</legend>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {choices.length === 0 && unknown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border p-2">
          {choices.map((c) => (
            <label key={c.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={value.includes(c.value)}
                disabled={field.disabled}
                onChange={() => toggle(c.value)}
              />
              {c.label}
            </label>
          ))}
          {unknown.map((v) => (
            <label key={v} className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked
                disabled={field.disabled}
                onChange={() => toggle(v)}
              />
              <span className="font-mono text-xs">{v}</span> (not found)
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
