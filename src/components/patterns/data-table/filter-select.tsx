'use client';

import { NativeSelect } from '@/components/ui/native-select';

const ALL = '';

interface FilterSelectProps {
  label: string;
  value: string | undefined;
  options: readonly { value: string; label: string }[];
  onChange(value: string | null): void;
  /** Text of the "no filter" choice. */
  allLabel?: string;
  className?: string;
}

/** One list filter; the choice lives in the URL like every other list parameter. */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  allLabel = 'All',
  className,
}: FilterSelectProps) {
  return (
    <NativeSelect
      aria-label={label}
      value={value ?? ALL}
      onChange={(event) => onChange(event.target.value === ALL ? null : event.target.value)}
      className={className ?? 'w-full sm:w-44'}
    >
      <option value={ALL}>
        {label}: {allLabel}
      </option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  );
}
