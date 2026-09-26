'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import dynamic from 'next/dynamic';
import { useState, type ReactNode } from 'react';
import {
  FormProvider,
  useForm,
  useFormContext,
  useController,
  type DefaultValues,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { z } from 'zod';

import { FormAlert, FormField } from '@/components/patterns/form/form-field';
import { useUnsavedChangesGuard } from '@/components/patterns/form/use-unsaved-changes-guard';
import type {
  ConflictField,
  VersionConflictDialog as VersionConflictDialogType,
} from '@/components/patterns/form/version-conflict-dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { hasCode } from '@/lib/api/errors';
import { notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { applyServerErrors } from '@/lib/validation/server-errors';

const VersionConflictDialog = dynamic(
  () =>
    import('@/components/patterns/form/version-conflict-dialog').then(
      (m) => m.VersionConflictDialog,
    ),
  { ssr: false },
) as typeof VersionConflictDialogType;

/* ----------------------------------------------------------- field schemas */

/** '' means "not set" for optional text; the API stores null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .transform((value) => (value === '' ? null : value));

export const requiredText = (min: number, max: number, label = 'This field') =>
  z
    .string()
    .trim()
    .min(min, min <= 1 ? `${label} is required` : `${label} needs at least ${min} characters`)
    .max(max, `Use at most ${max} characters`);

const MONEY = /^\d{1,9}(\.\d{1,2})?$/;

/** Rupees typed by a person ("12499" or "12499.50") to integer paise. */
export const rupees = (label = 'Amount') =>
  z
    .string()
    .trim()
    .regex(MONEY, `${label}: enter rupees, for example 12499 or 12499.50`)
    .transform((value) => Math.round(Number(value) * 100));

export const optionalRupees = (label = 'Amount') =>
  z
    .string()
    .trim()
    .refine(
      (value) => value === '' || MONEY.test(value),
      `${label}: enter rupees, for example 12499`,
    )
    .transform((value) => (value === '' ? null : Math.round(Number(value) * 100)));

export const optionalInt = (min: number, max: number, label = 'Value') =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || /^-?\d+$/.test(value), `${label} must be a whole number`)
    .transform((value) => (value === '' ? null : Number(value)))
    .refine(
      (value) => value === null || (value >= min && value <= max),
      `${label} must be between ${min} and ${max}`,
    );

export const requiredInt = (min: number, max: number, label = 'Value') =>
  z
    .string()
    .trim()
    .regex(/^-?\d+$/, `${label} must be a whole number`)
    .transform(Number)
    .refine((value) => value >= min && value <= max, `${label} must be between ${min} and ${max}`);

export const paiseInput = (paise: number | null | undefined): string =>
  paise === null || paise === undefined ? '' : String(paise / 100);
export const intInput = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);
export const textInput = (value: string | null | undefined): string => value ?? '';

/** A `datetime-local` value (the admin's own clock) to an ISO instant; '' means not set. */
export const optionalDateTime = () =>
  z
    .string()
    .refine(
      (value) => value === '' || !Number.isNaN(Date.parse(value)),
      'Enter a valid date and time',
    )
    .transform((value) => (value === '' ? null : new Date(value).toISOString()));

/** An ISO instant to the `datetime-local` format in the admin's time zone. */
export function dateTimeInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/* ------------------------------------------------------------ form controls */

interface BaseFieldProps<T extends FieldValues> {
  name: FieldPath<T>;
  label: ReactNode;
  description?: ReactNode;
  required?: boolean;
  className?: string;
}

export function TextField<T extends FieldValues>({
  type = 'text',
  placeholder,
  prefix,
  inputMode,
  ...props
}: BaseFieldProps<T> & {
  type?: 'text' | 'email' | 'url' | 'date' | 'datetime-local';
  placeholder?: string;
  prefix?: string;
  inputMode?: 'numeric' | 'decimal' | 'text';
}) {
  const { register } = useFormContext<T>();
  return (
    <FormField<T> {...props}>
      {(control) =>
        prefix ? (
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
            >
              {prefix}
            </span>
            <Input
              {...control}
              {...register(props.name)}
              type={type}
              inputMode={inputMode}
              placeholder={placeholder}
              className="pl-7"
            />
          </div>
        ) : (
          <Input
            {...control}
            {...register(props.name)}
            type={type}
            inputMode={inputMode}
            placeholder={placeholder}
          />
        )
      }
    </FormField>
  );
}

export function MoneyField<T extends FieldValues>(props: BaseFieldProps<T>) {
  return <TextField<T> {...props} prefix="₹" inputMode="decimal" placeholder="0" />;
}

export function NumberField<T extends FieldValues>(props: BaseFieldProps<T> & { unit?: string }) {
  const { unit, ...rest } = props;
  return (
    <TextField<T>
      {...rest}
      inputMode="numeric"
      description={unit ? (rest.description ?? `In ${unit}`) : rest.description}
    />
  );
}

export function TextAreaField<T extends FieldValues>({
  rows = 4,
  ...props
}: BaseFieldProps<T> & { rows?: number }) {
  const { register } = useFormContext<T>();
  return (
    <FormField<T> {...props}>
      {(control) => <Textarea {...control} {...register(props.name)} rows={rows} />}
    </FormField>
  );
}

export function SelectField<T extends FieldValues>({
  options,
  placeholder,
  ...props
}: BaseFieldProps<T> & {
  options: readonly { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}) {
  // Controlled: options often arrive after the form (reference data), and an uncontrolled select
  // would keep showing, and then submit, the placeholder instead of the stored value.
  const { field } = useController<T>({ name: props.name });
  return (
    <FormField<T> {...props}>
      {(control) => (
        <NativeSelect
          {...control}
          name={field.name}
          ref={field.ref}
          value={(field.value as string | null | undefined) ?? ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      )}
    </FormField>
  );
}

/** A yes/no setting: native checkbox with its explanation, so the whole row is the label. */
export function CheckField<T extends FieldValues>({
  name,
  label,
  description,
  className,
}: Omit<BaseFieldProps<T>, 'required'>) {
  const { register } = useFormContext<T>();
  const id = `check-${String(name)}`;
  return (
    <div className={cn('flex items-start gap-3 rounded-md border p-3', className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 accent-primary"
        aria-describedby={description ? `${id}-help` : undefined}
        {...register(name)}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {description ? (
          <p id={`${id}-help`} className="text-xs text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function FieldGrid({ children, columns = 2 }: { children: ReactNode; columns?: 1 | 2 | 3 }) {
  return (
    <div
      className={cn(
        'grid gap-4',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
      )}
    >
      {children}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5">
      <legend className="sr-only">{title}</legend>
      <div className="flex flex-col gap-0.5">
        <h2 aria-hidden className="text-base font-semibold">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}

/* ---------------------------------------------------------- the editor form */

interface EditorFormProps<Values extends FieldValues, Output, Record> {
  schema: z.ZodType<Output, z.ZodTypeDef, Values>;
  defaultValues: DefaultValues<Values>;
  /** Saves the parsed values; throws the ApiError on failure. */
  onSubmit(values: Output): Promise<unknown>;
  successMessage: string;
  /** Fields a 409 STALE_RESOURCE compares; enables "Reload latest". */
  conflict?: {
    fields: readonly ConflictField<Record>[];
    /** The parsed values that were sent, in the record's shape (paise, null for empty). */
    yours(values: NoInfer<Output>): Partial<Record>;
    loadLatest(): Promise<Record>;
    onReload(latest: Record): void;
  };
  /** Server field names that differ from form names. */
  aliases?: Readonly<{ [server: string]: string }>;
  children: ReactNode;
  submitLabel?: string;
  /** Without permission the form is shown read-only. */
  readOnly?: ReactNode;
  className?: string;
}

/**
 * One section of an editor: validation (shared Zod + field helpers), server 422 mapping, a sticky
 * save bar, duplicate-submit prevention, unsaved-changes protection and a version-conflict dialog
 * that never overwrites someone else's save.
 */
export function EditorForm<Values extends FieldValues, Output, Record>({
  schema,
  defaultValues,
  onSubmit,
  successMessage,
  conflict,
  aliases,
  children,
  submitLabel = 'Save changes',
  readOnly,
  className,
}: EditorFormProps<Values, Output, Record>) {
  const form = useForm<Values, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues,
    disabled: Boolean(readOnly),
  });
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [formMessages, setFormMessages] = useState<string[]>([]);
  const [conflicted, setConflicted] = useState<Output | null>(null);
  const { isDirty, isSubmitting } = form.formState;
  useUnsavedChangesGuard(isDirty && !isSubmitting);

  const submit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    setFormMessages([]);
    try {
      await onSubmit(values);
      notifySuccess(successMessage);
    } catch (error) {
      if (conflict && hasCode(error, 'STALE_RESOURCE')) {
        setConflicted(values);
        return;
      }
      const mapped = applyServerErrors(error, form.setError, { aliases });
      if (mapped && Object.keys(mapped.fields).length > 0) setFormMessages(mapped.form);
      else setSubmitError(error);
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={submit} noValidate className={cn('flex flex-col gap-5', className)}>
        {readOnly}
        <FormAlert error={submitError} messages={formMessages} />
        {children}
        {readOnly ? null : (
          <div
            className={cn(
              'sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur',
              !isDirty && 'opacity-90',
            )}
          >
            <span role="status" className="mr-auto text-sm text-muted-foreground">
              {isDirty ? 'Unsaved changes' : 'All changes saved'}
            </span>
            <Button
              type="button"
              variant="ghost"
              disabled={!isDirty || isSubmitting}
              onClick={() => form.reset()}
            >
              Discard
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              {submitLabel}
            </Button>
          </div>
        )}
      </form>
      {conflict && conflicted ? (
        <VersionConflictDialog<Record>
          open
          yours={conflict.yours(conflicted)}
          fields={conflict.fields}
          loadLatest={conflict.loadLatest}
          onReload={(latest) => {
            setConflicted(null);
            conflict.onReload(latest);
          }}
          onCancel={() => setConflicted(null)}
        />
      ) : null}
    </FormProvider>
  );
}
