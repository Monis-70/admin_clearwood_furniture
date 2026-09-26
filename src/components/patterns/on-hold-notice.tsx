import { PauseCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

export type OnHoldDomain = 'payments' | 'refunds' | 'returns' | 'shipping' | 'email' | 'otp';

/** Fixed copy for integrations that are deliberately inactive in this release. */
export const ON_HOLD_COPY: Readonly<
  Record<OnHoldDomain, { title: string; body: string; stillWorks: string }>
> = {
  payments: {
    title: 'Online payments are not enabled',
    body: 'The payment gateway (Razorpay) is on hold. Customers can only choose cash on delivery.',
    stillWorks: 'Orders with cash on delivery work normally.',
  },
  refunds: {
    title: 'Refunds are not enabled',
    body: 'Refunds need the online payment gateway, which is on hold. The admin does not issue refunds.',
    stillWorks: 'Order details and history remain available.',
  },
  returns: {
    title: 'Customer returns are not enabled',
    body: 'The returns feature is switched off, so customers cannot request returns and no return appears here.',
    stillWorks: 'Orders, shipments and delivery exceptions work normally.',
  },
  shipping: {
    title: 'Courier integration is not enabled',
    body: 'Shipments are handled manually. Courier booking, pickup and live tracking (Shiprocket) are on hold.',
    stillWorks: 'Manual shipments with tracking numbers work normally.',
  },
  email: {
    title: 'Email delivery is not enabled',
    body: 'Emails are recorded but not sent, so password-reset and invitation emails never arrive.',
    stillWorks: 'Admins receive a temporary password from whoever creates or resets their account.',
  },
  otp: {
    title: 'SMS and WhatsApp codes are not enabled',
    body: 'One-time codes are recorded but not delivered.',
    stillWorks: 'Admin sign-in uses email and password only.',
  },
};

export function OnHoldNotice({ domain, className }: { domain: OnHoldDomain; className?: string }) {
  const copy = ON_HOLD_COPY[domain];
  return (
    <div
      className={cn(
        'flex gap-3 rounded-md border border-warning/25 bg-warning-bg px-4 py-3 text-sm',
        className,
      )}
    >
      <PauseCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-warning">{copy.title}</p>
        <p className="text-foreground/90">{copy.body}</p>
        <p className="text-muted-foreground">{copy.stillWorks}</p>
      </div>
    </div>
  );
}
