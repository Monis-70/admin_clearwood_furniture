import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { isApiError } from '@/lib/api/errors';

export interface MappedServerErrors {
  /** Field path (dot notation, as the form names it) → message. */
  fields: Record<string, string>;
  /** Messages that belong to no visible field. */
  form: string[];
}

export interface MapOptions {
  /** Server field name → form field name (e.g. the password policy reports `password`). */
  aliases?: Readonly<Record<string, string>>;
  /** Only these form fields can show an error; anything else becomes a form-level message. */
  fields?: readonly string[];
}

interface IssueLike {
  location?: unknown;
  path?: unknown;
  message?: unknown;
}

const capitalise = (text: string): string => (text ? text[0]!.toUpperCase() + text.slice(1) : text);

/**
 * Maps the API's 422 details onto a form. The API answers in several shapes (validate()
 * middleware issues, uncaught Zod issues, `{field, issues}` from the password policy, `{field}`
 * single-field checks, `{rejected, writable}` for settings); unknown shapes fall back to the
 * error message so nothing is ever silently dropped.
 */
export function mapServerErrors(
  error: unknown,
  options: MapOptions = {},
): MappedServerErrors | null {
  if (!isApiError(error) || error.status !== 422) return null;
  const out: MappedServerErrors = { fields: {}, form: [] };
  const alias = (name: string): string => options.aliases?.[name] ?? name;
  const accepts = (name: string): boolean => !options.fields || options.fields.includes(name);
  const put = (name: string | null, message: string): void => {
    if (name && accepts(name) && !out.fields[name]) out.fields[name] = message;
    else if (!out.form.includes(message)) out.form.push(message);
  };

  const details = error.details;
  if (Array.isArray(details)) {
    for (const raw of details as IssueLike[]) {
      const message = typeof raw.message === 'string' ? capitalise(raw.message) : error.message;
      const location = typeof raw.location === 'string' ? raw.location : 'body';
      const path =
        typeof raw.path === 'string' ? raw.path : Array.isArray(raw.path) ? raw.path.join('.') : '';
      put(location === 'body' && path ? alias(path) : null, message);
    }
  } else if (details && typeof details === 'object') {
    const record = details as Record<string, unknown>;
    if (typeof record.field === 'string') {
      const issues = Array.isArray(record.issues)
        ? record.issues.filter((i): i is string => typeof i === 'string')
        : [];
      const subject = record.field === 'password' ? 'Password' : capitalise(record.field);
      const message =
        issues.length > 0 ? issues.map((i) => `${subject} ${i}`).join('. ') : error.message;
      put(alias(record.field), message);
    } else if (Array.isArray(record.rejected)) {
      put(null, `${error.message}: ${record.rejected.join(', ')}`);
    } else {
      put(null, error.message);
    }
  } else {
    put(null, error.message);
  }
  return out;
}

/** Applies mapped errors to React Hook Form and focuses the first invalid field. */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  options: MapOptions = {},
): MappedServerErrors | null {
  const mapped = mapServerErrors(error, options);
  if (!mapped) return null;
  const names = Object.keys(mapped.fields);
  names.forEach((name, index) => {
    setError(
      name as Path<T>,
      { type: 'server', message: mapped.fields[name] },
      { shouldFocus: index === 0 },
    );
  });
  return mapped;
}
