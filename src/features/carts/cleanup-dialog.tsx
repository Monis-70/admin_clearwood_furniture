'use client';

import { useState } from 'react';

import type { CartCleanupReportDto } from '@shared/types/cart';

import { FormAlert } from '@/components/patterns/form/form-alert';
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
import { formatNumber } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';

import { cartsApi, type CleanupInput } from './api';

const FIELDS = [
  {
    key: 'abandonAfterHours',
    label: 'Mark carts abandoned after (hours of no activity)',
    max: 8_760,
  },
  { key: 'expireGuestAfterDays', label: 'Expire guest carts after (days)', max: 3_650 },
  {
    key: 'expireCustomerAfterDays',
    label: 'Expire signed-in customer carts after (days)',
    max: 3_650,
  },
] as const;

/**
 * Runs the cart clean-up the scheduler also runs. Carts are marked, not deleted, but an expired
 * cart cannot be brought back, so the admin confirms explicitly.
 */
export function CleanupDialog({ onClose, onDone }: { onClose(): void; onDone(): void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<CartCleanupReportDto | null>(null);

  const run = async () => {
    setProblem(null);
    setError(null);
    const body: CleanupInput = {};
    for (const f of FIELDS) {
      const raw = (values[f.key] ?? '').trim();
      if (!raw) continue;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > f.max)
        return setProblem(`${f.label}: a whole number from 1 to ${formatNumber(f.max)}.`);
      body[f.key] = n;
    }
    setRunning(true);
    try {
      const result = await cartsApi.cleanup(body);
      setReport(result);
      notifySuccess('Cart clean-up finished');
      onDone();
    } catch (e) {
      setError(e);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open || running ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Clean up old carts</DialogTitle>
          <DialogDescription>
            Quiet carts are marked abandoned, and old ones expire. Nothing is deleted, but an
            expired cart cannot be restored. Leave a field empty to use the server&apos;s default.
          </DialogDescription>
        </DialogHeader>
        <FormAlert error={error} messages={problem ? [problem] : []} />
        {report ? (
          <p role="status" className="rounded-md border p-3 text-sm">
            {formatNumber(report.abandoned)} carts marked abandoned, {formatNumber(report.expired)}{' '}
            expired.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="flex flex-col gap-1.5">
                <Label htmlFor={`cleanup-${f.key}`}>{f.label}</Label>
                <Input
                  id={`cleanup-${f.key}`}
                  inputMode="numeric"
                  placeholder="Server default"
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="max-w-40"
                />
              </div>
            ))}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              I understand expired carts cannot be restored.
            </label>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={running}>
            {report ? 'Close' : 'Cancel'}
          </Button>
          {report ? null : (
            <Button
              variant="destructive"
              disabled={!agreed}
              loading={running}
              onClick={() => void run()}
            >
              Run clean-up
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
