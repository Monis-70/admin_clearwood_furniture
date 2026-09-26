'use client';

import { useState, type ReactNode } from 'react';

import type { AdminOrderDetailDto } from '@shared/types/order';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { OnHoldNotice } from '@/components/patterns/on-hold-notice';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { notifySuccess } from '@/lib/notify';

import { ordersApi } from './api';
import { ORDER_STATUS, REFUND_REASON_LABELS, allowedFrom } from './model';

function Frame({
  title,
  description,
  busy,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  description: ReactNode;
  busy: boolean;
  onClose(): void;
  children: ReactNode;
  footer: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open onOpenChange={(open) => (open || busy ? undefined : onClose())}>
      <DialogContent
        className={`max-h-[92dvh] overflow-y-auto ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Move an order to another status; the server's state machine decides what is allowed. */
export function OrderStatusDialog({
  order,
  onClose,
  onDone,
}: {
  order: AdminOrderDetailDto;
  onClose(): void;
  onDone(): void;
}) {
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [visible, setVisible] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [allowed, setAllowed] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      await ordersApi.setStatus(order.id, {
        status,
        ...(note.trim() ? { note: note.trim() } : {}),
        isCustomerVisible: visible,
      });
      notifySuccess(`Order ${order.orderNumber} is now ${ORDER_STATUS[status]?.label ?? status}`);
      onDone();
    } catch (e) {
      setAllowed(allowedFrom(e));
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame
      title={`Change the status of ${order.orderNumber}`}
      description={`Now: ${ORDER_STATUS[order.status]?.label ?? order.status}. The server allows only the next steps of the order's life and records who changed it.`}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={busy} disabled={!status}>
            Change status
          </Button>
        </>
      }
    >
      <FormAlert error={error} />
      {allowed ? (
        <p className="text-sm">
          From {ORDER_STATUS[order.status]?.label ?? order.status} the order can move to:{' '}
          {allowed.length
            ? allowed.map((s) => ORDER_STATUS[s]?.label ?? s).join(', ')
            : 'nothing (it is final)'}
          .
        </p>
      ) : null}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="order-status">New status</Label>
          <NativeSelect
            id="order-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Choose…</option>
            {Object.entries(ORDER_STATUS)
              .filter(([value]) => value !== order.status && value !== 'DRAFT')
              .map(([value, def]) => (
                <option key={value} value={value}>
                  {def.label}: {def.description}
                </option>
              ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            Cancelling has its own button (it returns stock and records the reason). Confirming an
            unpaid order is refused unless it is cash on delivery.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="order-note">Note (optional)</Label>
          <Textarea
            id="order-note"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
          />
          Show this step and note to the customer
        </label>
      </div>
    </Frame>
  );
}

/** Cancel an order: stock is released; a paid order gets a refund request (refunds are on hold). */
export function CancelOrderDialog({
  order,
  onClose,
  onDone,
}: {
  order: AdminOrderDetailDto;
  onClose(): void;
  onDone(): void;
}) {
  const [reason, setReason] = useState('CUSTOMER_REQUEST');
  const [note, setNote] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const paid = order.paidPaise > 0;
  const run = async () => {
    setError(null);
    setBusy(true);
    try {
      await ordersApi.cancel(order.id, { reason, ...(note.trim() ? { note: note.trim() } : {}) });
      notifySuccess(`Order ${order.orderNumber} cancelled`);
      onDone();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame
      title={`Cancel ${order.orderNumber}?`}
      description="The order stops, its stock is released and the customer is told. This cannot be undone."
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Keep the order
          </Button>
          <Button
            variant="destructive"
            onClick={() => void run()}
            loading={busy}
            disabled={typed.trim() !== order.orderNumber}
          >
            Cancel order
          </Button>
        </>
      }
    >
      <FormAlert error={error} />
      {paid ? <OnHoldNotice domain="refunds" /> : null}
      {paid ? (
        <p className="text-sm">
          This order has payments recorded. Cancelling creates a refund request; with refunds on
          hold, the money is not returned automatically.
        </p>
      ) : null}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cancel-reason">Reason</Label>
          <NativeSelect
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {Object.entries(REFUND_REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cancel-note">Note (optional)</Label>
          <Textarea
            id="cancel-note"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cancel-confirm">Type {order.orderNumber} to confirm</Label>
          <Input
            id="cancel-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>
    </Frame>
  );
}

/**
 * A manual shipment for some or all items still to ship. Courier booking is on hold, so the
 * shipment is recorded by hand and tracked with the tracking number the courier gives.
 */
export function CreateShipmentDialog({
  order,
  onClose,
  onDone,
}: {
  order: AdminOrderDetailDto;
  onClose(): void;
  onDone(shipmentNumber: string): void;
}) {
  const keyFor = useIdempotencyKey();
  const lines = order.order.items.map((item) => ({
    item,
    open: Math.max(0, item.qty - item.fulfilledQty - item.cancelledQty),
  }));
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.item.id, String(l.open)])),
  );
  const [pkg, setPkg] = useState({
    weightGrams: '',
    lengthMm: '',
    widthMm: '',
    heightMm: '',
    packageCount: '',
  });
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setProblem(null);
    setError(null);
    const items: { orderItemId: string; qty: number }[] = [];
    for (const l of lines) {
      const raw = (qty[l.item.id] ?? '').trim();
      if (!raw || raw === '0') continue;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1)
        return setProblem(`${l.item.productName}: a whole number of items.`);
      items.push({ orderItemId: l.item.id, qty: n });
    }
    if (items.length === 0) return setProblem('Choose at least one item to ship.');
    const packageBody: Record<string, number> = {};
    for (const [k, v] of Object.entries(pkg)) {
      if (!v.trim()) continue;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1)
        return setProblem('Package sizes are whole numbers above zero.');
      packageBody[k] = n;
    }
    const body = {
      manual: true,
      items,
      ...(Object.keys(packageBody).length ? { package: packageBody } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    setBusy(true);
    try {
      const shipment = await ordersApi.createShipment(order.orderNumber, body, keyFor(body));
      notifySuccess(`Shipment ${shipment.shipmentNumber} created`);
      onDone(shipment.shipmentNumber);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame
      wide
      title={`Ship items from ${order.orderNumber}`}
      description="Creates a manual shipment. Add the courier's tracking number on the shipment afterwards."
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void run()} loading={busy}>
            Create shipment
          </Button>
        </>
      }
    >
      <OnHoldNotice domain="shipping" />
      <FormAlert error={error} messages={problem ? [problem] : []} />
      <table className="w-full text-sm">
        <caption className="sr-only">Items to ship</caption>
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1 font-medium">Item</th>
            <th className="py-1 text-right font-medium">Still to ship</th>
            <th className="py-1 text-right font-medium">In this shipment</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.item.id} className="border-t">
              <td className="py-1.5">
                {l.item.productName}
                <span className="block text-xs text-muted-foreground">
                  {[l.item.variantName, l.item.sku].filter(Boolean).join(' · ')}
                </span>
              </td>
              <td className="tabular py-1.5 text-right">{l.open}</td>
              <td className="py-1.5 text-right">
                <Input
                  aria-label={`Quantity of ${l.item.productName} to ship`}
                  inputMode="numeric"
                  className="ml-auto w-20 text-right"
                  value={qty[l.item.id] ?? ''}
                  onChange={(e) => setQty((q) => ({ ...q, [l.item.id]: e.target.value }))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <fieldset className="grid gap-3 rounded-md border p-3 sm:grid-cols-5">
        <legend className="px-1 text-sm font-medium">Package (optional)</legend>
        {(
          [
            ['weightGrams', 'Weight (g)'],
            ['lengthMm', 'Length (mm)'],
            ['widthMm', 'Width (mm)'],
            ['heightMm', 'Height (mm)'],
            ['packageCount', 'Boxes'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="flex flex-col gap-1">
            <Label htmlFor={`pkg-${key}`} className="text-xs">
              {label}
            </Label>
            <Input
              id={`pkg-${key}`}
              inputMode="numeric"
              value={pkg[key]}
              onChange={(e) => setPkg((p) => ({ ...p, [key]: e.target.value }))}
            />
          </div>
        ))}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="shipment-note">Note (optional)</Label>
        <Textarea
          id="shipment-note"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Frame>
  );
}
