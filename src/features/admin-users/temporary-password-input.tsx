'use client';

import { RefreshCw } from 'lucide-react';

import { CopyButton } from '@/components/patterns/copy-button';
import { PasswordInput, type FieldControlProps } from '@/components/patterns/form/form-field';
import { Button } from '@/components/ui/button';
import { generateTemporaryPassword } from '@/lib/password';

interface TemporaryPasswordInputProps {
  control: FieldControlProps;
  value: string;
  onChange(value: string): void;
  onBlur?: () => void;
  name?: string;
}

/** Password box with Generate and Copy: the admin shares it once, the owner replaces it. */
export function TemporaryPasswordInput({
  control,
  value,
  onChange,
  onBlur,
  name,
}: TemporaryPasswordInputProps) {
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <PasswordInput
          {...control}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          autoComplete="new-password"
          spellCheck={false}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => onChange(generateTemporaryPassword())}
        aria-label="Generate a strong temporary password"
      >
        <RefreshCw aria-hidden />
        Generate
      </Button>
      {value ? <CopyButton value={value} label="temporary password" className="mt-0.5" /> : null}
    </div>
  );
}
