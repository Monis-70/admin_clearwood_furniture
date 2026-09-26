'use client';

import { useState, type ReactNode } from 'react';

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
import { describeError } from '@/lib/api/error-messages';

export interface ConflictField<T> {
  key: keyof T & string;
  label: string;
  format?: (value: T[keyof T]) => ReactNode;
}

interface VersionConflictDialogProps<T> {
  open: boolean;
  /** The values the operator tried to save. */
  yours: Partial<T>;
  fields: readonly ConflictField<T>[];
  /** Loads the record as it is now on the server. */
  loadLatest(): Promise<T>;
  /** Discard local edits and continue from the server's version. */
  onReload(latest: T): void;
  /** Keep editing; saving again will conflict until the latest version is loaded. */
  onCancel(): void;
}

function show(value: unknown): ReactNode {
  if (value === null || value === undefined || value === '')
    return <span className="text-muted-foreground">(empty)</span>;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object')
    return <code className="text-xs break-all">{JSON.stringify(value)}</code>;
  return String(value);
}

const isEmpty = (value: unknown) => value === null || value === undefined || value === '';

/** Empty text, null and absent all read "(empty)": they are the same value to the operator. */
const same = (a: unknown, b: unknown): boolean =>
  (isEmpty(a) && isEmpty(b)) || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** "seatHeightMm" -> "Seat height mm", for a submitted field the caller did not label. */
const humanise = (key: string) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/^./, (first) => first.toUpperCase());

/**
 * `409 STALE_RESOURCE`: someone saved the record after it was opened. Nothing is overwritten:
 * the operator reloads, compares first, or goes back to their edits.
 */
export function VersionConflictDialog<T>({
  open,
  yours,
  fields,
  loadLatest,
  onReload,
  onCancel,
}: VersionConflictDialogProps<T>) {
  const [latest, setLatest] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const fetchLatest = async (): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const value = await loadLatest();
      setLatest(value);
      return value;
    } catch (cause) {
      setError(cause);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reload = async () => {
    const value = latest ?? (await fetchLatest());
    if (value) {
      setLatest(null);
      onReload(value);
    }
  };

  const cancel = () => {
    setLatest(null);
    setError(null);
    onCancel();
  };

  // Every submitted field the record also has is compared, labelled or not, so "not touched"
  // below is never said about a field nobody looked at.
  const listed = new Set<string>(fields.map((field) => field.key));
  const compared: readonly ConflictField<T>[] = latest
    ? [
        ...fields.filter((field) => field.key in yours),
        ...Object.keys(yours)
          .filter((key) => !listed.has(key) && key in (latest as object))
          .map((key) => ({ key: key as keyof T & string, label: humanise(key) })),
      ]
    : [];
  const differences = latest
    ? compared.filter((field) => !same(yours[field.key], latest[field.key]))
    : [];

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : cancel())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Someone else changed this record</DialogTitle>
          <DialogDescription>
            It was saved by someone else after you opened it. Your changes have not been saved and
            nothing was overwritten.
          </DialogDescription>
        </DialogHeader>

        {latest ? (
          differences.length > 0 ? (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Your values compared with the latest saved values
                </caption>
                <thead className="bg-muted/60 text-left text-xs text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-3 py-2">
                      Field
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Your change
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Saved by someone else
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {differences.map((field) => (
                    <tr key={field.key} className="border-t align-top">
                      <th scope="row" className="px-3 py-2 text-left font-medium">
                        {field.label}
                      </th>
                      <td className="px-3 py-2">
                        {field.format && !isEmpty(yours[field.key])
                          ? field.format(yours[field.key] as T[keyof T])
                          : show(yours[field.key])}
                      </td>
                      <td className="px-3 py-2">
                        {field.format && !isEmpty(latest[field.key])
                          ? field.format(latest[field.key])
                          : show(latest[field.key])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Alert tone="info">
              The fields you changed were not touched; other details of the record changed.
            </Alert>
          )
        ) : null}

        {error ? (
          <Alert tone="danger" title={describeError(error).title} live="assertive">
            {describeError(error).message}
          </Alert>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={cancel}>
            Cancel
          </Button>
          {latest ? null : (
            <Button variant="outline" onClick={() => void fetchLatest()} loading={loading}>
              Compare
            </Button>
          )}
          <Button onClick={() => void reload()} loading={loading && latest === null}>
            Reload latest
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
