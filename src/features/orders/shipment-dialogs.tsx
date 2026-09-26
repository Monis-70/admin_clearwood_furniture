'use client';

import { useState, type ReactNode } from 'react';

import type { NdrRecordDto, ShipmentDto } from '@shared/types/fulfilment';

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
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { notifySuccess } from '@/lib/notify';

import { shipmentsApi } from './api';
import { SHIPMENT_STATUS, allowedFrom } from './model';

function Frame({
  title,
  description,
  busy,
  onClose,
  children,
  footer,
}: {
  title: string;
  description: ReactNode;
  busy: boolean;
  onClose(): void;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => (open || busy ? undefined : onClose())}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
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

function useAction() {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, run };
}

/** Record the courier's tracking number for a manual shipment. */
export function AwbDialog({
  shipment,
  onClose,
  onDone,
}: {
  shipment: ShipmentDto;
  onClose(): void;
  onDone(): void;
}) {
  const keyFor = useIdempotencyKey();
  const [awb, setAwb] = useState(shipment.awbNumber ?? '');
  const [courier, setCourier] = useState(shipment.providerCourierName ?? '');
  const { error, busy, run } = useAction();
  const valid = awb.trim().length >= 3 && courier.trim().length >= 2;
  return (
    <Frame
      title={`Tracking number for ${shipment.shipmentNumber}`}
      description="Enter the courier and the tracking (AWB) number they gave. Courier booking is on hold, so it is recorded by hand."
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            loading={busy}
            onClick={() =>
              void run(async () => {
                const body = { manualAwb: awb.trim(), manualCourierName: courier.trim() };
                await shipmentsApi.assignAwb(shipment.shipmentNumber, body, keyFor(body));
                notifySuccess('Tracking number saved');
                onDone();
              })
            }
          >
            Save tracking number
          </Button>
        </>
      }
    >
      <FormAlert error={error} />
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="awb-courier">Courier</Label>
          <Input
            id="awb-courier"
            value={courier}
            maxLength={80}
            onChange={(e) => setCourier(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="awb-number">Tracking (AWB) number</Label>
          <Input
            id="awb-number"
            value={awb}
            maxLength={60}
            onChange={(e) => setAwb(e.target.value)}
          />
        </div>
      </div>
    </Frame>
  );
}

/** Record where a manual shipment is; the server keeps the order in step (e.g. delivered). */
export function ShipmentStatusDialog({
  shipment,
  onClose,
  onDone,
}: {
  shipment: ShipmentDto;
  onClose(): void;
  onDone(): void;
}) {
  const [status, setStatus] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [visible, setVisible] = useState(true);
  const [allowed, setAllowed] = useState<string[] | null>(null);
  const { error, busy, run } = useAction();
  return (
    <Frame
      title={`Update ${shipment.shipmentNumber}`}
      description={`Now: ${SHIPMENT_STATUS[shipment.status]?.label ?? shipment.status}. The server refuses steps that do not follow on.`}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={!status}
            loading={busy}
            onClick={() =>
              void run(async () => {
                try {
                  await shipmentsApi.setStatus(shipment.shipmentNumber, {
                    status,
                    ...(description.trim() ? { description: description.trim() } : {}),
                    ...(location.trim() ? { location: location.trim() } : {}),
                    isCustomerVisible: visible,
                  });
                } catch (e) {
                  setAllowed(allowedFrom(e));
                  throw e;
                }
                notifySuccess('Shipment updated');
                onDone();
              })
            }
          >
            Save update
          </Button>
        </>
      }
    >
      <FormAlert error={error} />
      {allowed ? (
        <p className="text-sm">
          Allowed from here:{' '}
          {allowed.length
            ? allowed.map((s) => SHIPMENT_STATUS[s]?.label ?? s).join(', ')
            : 'nothing'}
          .
        </p>
      ) : null}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shipment-status">New status</Label>
          <NativeSelect
            id="shipment-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Choose…</option>
            {Object.entries(SHIPMENT_STATUS)
              .filter(
                ([value]) =>
                  value !== shipment.status && value !== 'DRAFT' && value !== 'CANCELLED',
              )
              .map(([value, def]) => (
                <option key={value} value={value}>
                  {def.label}
                </option>
              ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shipment-description">What happened (optional)</Label>
          <Textarea
            id="shipment-description"
            rows={2}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shipment-location">Where (optional)</Label>
          <Input
            id="shipment-location"
            maxLength={120}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
          />
          Show this update to the customer
        </label>
      </div>
    </Frame>
  );
}

export function CancelShipmentDialog({
  shipment,
  onClose,
  onDone,
}: {
  shipment: ShipmentDto;
  onClose(): void;
  onDone(): void;
}) {
  const [reason, setReason] = useState('');
  const [force, setForce] = useState(false);
  const { error, busy, run } = useAction();
  return (
    <Frame
      title={`Cancel ${shipment.shipmentNumber}?`}
      description="Its items go back to “still to ship” on the order. After pickup, cancelling only records a request."
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Keep it
          </Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3}
            loading={busy}
            onClick={() =>
              void run(async () => {
                await shipmentsApi.cancel(shipment.shipmentNumber, {
                  reason: reason.trim(),
                  force,
                });
                notifySuccess('Shipment cancelled');
                onDone();
              })
            }
          >
            Cancel shipment
          </Button>
        </>
      }
    >
      <FormAlert error={error} />
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cancel-shipment-reason">Reason</Label>
          <Textarea
            id="cancel-shipment-reason"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-primary"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
          />
          <span>
            Cancel here even if the courier does not confirm
            <span className="block text-xs text-muted-foreground">
              Only when you have arranged it with the courier yourself.
            </span>
          </span>
        </label>
      </div>
    </Frame>
  );
}

const NDR_ACTIONS: Record<string, { label: string; note: string }> = {
  CONTACT_BUYER: {
    label: 'Contact the customer',
    note: 'Records that the team will call the customer.',
  },
  FAKE_ATTEMPT: {
    label: 'Report a fake attempt',
    note: 'The courier claimed an attempt that did not happen.',
  },
  REATTEMPT: {
    label: 'Ask for another delivery attempt',
    note: 'Needs the courier integration for courier-booked shipments.',
  },
  RETURN: {
    label: 'Return it to us',
    note: 'Needs the courier integration for courier-booked shipments.',
  },
};

export function NdrActionDialog({
  ndr,
  onClose,
  onDone,
}: {
  ndr: NdrRecordDto;
  onClose(): void;
  onDone(): void;
}) {
  const [action, setAction] = useState('CONTACT_BUYER');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const { error, busy, run } = useAction();
  return (
    <Frame
      title={`Delivery problem on ${ndr.shipmentNumber}`}
      description={`${ndr.reason} (attempt ${ndr.attemptCount}).`}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            loading={busy}
            onClick={() =>
              void run(async () => {
                await shipmentsApi.ndrAction(ndr.id, {
                  action,
                  ...(note.trim() ? { note: note.trim() } : {}),
                  ...(action === 'REATTEMPT' && date
                    ? { reattemptDate: new Date(date).toISOString() }
                    : {}),
                });
                notifySuccess('Action recorded');
                onDone();
              })
            }
          >
            Record action
          </Button>
        </>
      }
    >
      <FormAlert error={error} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">What to do</legend>
        {Object.entries(NDR_ACTIONS).map(([value, def]) => (
          <label key={value} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="ndr-action"
              className="mt-0.5 size-4 accent-primary"
              checked={action === value}
              onChange={() => setAction(value)}
            />
            <span>
              {def.label}
              <span className="block text-xs text-muted-foreground">{def.note}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {action === 'REATTEMPT' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ndr-date">Try again on</Label>
          <Input
            id="ndr-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-48"
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ndr-note">Note (optional)</Label>
        <Textarea
          id="ndr-note"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Frame>
  );
}
