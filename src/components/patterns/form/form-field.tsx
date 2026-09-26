'use client';

import { useId, useState, type ComponentProps, type ReactNode } from 'react';
import {
  get,
  useFormContext,
  type FieldError,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface FieldControlProps {
  id: string;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
  'aria-required': true | undefined;
}

interface FormFieldProps<T extends FieldValues> {
  name: FieldPath<T>;
  label: ReactNode;
  description?: ReactNode;
  required?: boolean;
  className?: string;
  children(control: FieldControlProps): ReactNode;
}

/**
 * Label, control, help text and error wired together: the error is announced, linked through
 * aria-describedby, and client (Zod) and server (422) errors appear in the same place.
 */
export function FormField<T extends FieldValues>({
  name,
  label,
  description,
  required,
  className,
  children,
}: FormFieldProps<T>) {
  const {
    formState: { errors },
  } = useFormContext<T>();
  const base = useId();
  const id = `${base}-control`;
  const error = get(errors, name) as FieldError | undefined;
  const descriptionId = description ? `${base}-description` : undefined;
  const errorId = error?.message ? `${base}-error` : undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <>
            <span aria-hidden className="text-destructive">
              *
            </span>
            <span className="sr-only">(required)</span>
          </>
        ) : null}
      </Label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': [descriptionId, errorId].filter(Boolean).join(' ') || undefined,
        'aria-required': required ? true : undefined,
      })}
      {description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error?.message ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type'>;

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-10', className)} />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-0.5 right-0.5 text-muted-foreground"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
      </Button>
    </div>
  );
}

/** Form-level problems: server messages that belong to no field, or a failed submission. */
export { FormAlert } from './form-alert';
