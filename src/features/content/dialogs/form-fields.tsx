'use client';

import { ImagePlus, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState, type ReactNode } from 'react';
import { useController, type FieldPath, type FieldValues } from 'react-hook-form';

import { FormField } from '@/components/patterns/form/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { endpoints } from '@/lib/api/endpoints';
import { usePermissions } from '@/lib/permissions/use-permissions';

const MediaPicker = dynamic(() => import('../../media/media-picker').then((m) => m.MediaPicker), {
  ssr: false,
});

/**
 * One image from the media library, stored as its id. With media access the admin picks from the
 * library; without it the id can still be typed (the API checks it exists).
 */
export function MediaField<T extends FieldValues>({
  name,
  label,
  description,
}: {
  name: FieldPath<T>;
  label: ReactNode;
  description?: ReactNode;
}) {
  const { canCall } = usePermissions();
  const { field } = useController<T>({ name });
  const [picking, setPicking] = useState(false);
  const value = (field.value as string | undefined) ?? '';
  const canPick = canCall(endpoints.media.list);
  return (
    <FormField<T> name={name} label={label} description={description}>
      {(control) => (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            {...control}
            name={field.name}
            ref={field.ref}
            value={value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            placeholder="No image"
            className="max-w-xs font-mono text-xs"
            readOnly={canPick}
            disabled={field.disabled}
          />
          {canPick && !field.disabled ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
              <ImagePlus aria-hidden />
              {value ? 'Change' : 'Choose image'}
            </Button>
          ) : null}
          {value && !field.disabled ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => field.onChange('')}
              aria-label={`Remove ${typeof label === 'string' ? label : 'image'}`}
            >
              <X aria-hidden />
            </Button>
          ) : null}
          {picking ? (
            <MediaPicker
              title="Choose an image"
              multiple={false}
              onClose={() => setPicking(false)}
              onChoose={(assets) => {
                if (assets[0]) field.onChange(assets[0].id);
                setPicking(false);
              }}
            />
          ) : null}
        </div>
      )}
    </FormField>
  );
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
