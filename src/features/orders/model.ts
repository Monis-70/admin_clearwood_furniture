import type { StatusRegistry } from '@/components/patterns/status-badge';
import { ApiError } from '@/lib/api/errors';

export const ORDER_STATUS: StatusRegistry<string> = {
  DRAFT: { label: 'Draft', tone: 'neutral', description: 'Not placed yet.' },
  PENDING_PAYMENT: { label: 'Awaiting payment', tone: 'warning', description: 'Placed, not paid.' },
  PAYMENT_FAILED: {
    label: 'Payment failed',
    tone: 'danger',
    description: 'The payment did not go through.',
  },
  CONFIRMED: { label: 'Confirmed', tone: 'info', description: 'Accepted; ready to prepare.' },
  PROCESSING: { label: 'Processing', tone: 'info', description: 'Being prepared or made.' },
  READY_TO_SHIP: {
    label: 'Ready to ship',
    tone: 'brand',
    description: 'Packed and waiting for the courier.',
  },
  SHIPPED: { label: 'Shipped', tone: 'brand', description: 'With the courier.' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'brand', description: 'Arriving today.' },
  DELIVERED: { label: 'Delivered', tone: 'success', description: 'Received by the customer.' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral', description: 'Stopped; stock returned.' },
  RETURN_REQUESTED: {
    label: 'Return requested',
    tone: 'warning',
    description: 'The customer asked to return it.',
  },
  RETURNED: { label: 'Returned', tone: 'neutral', description: 'Back with us.' },
  REFUNDED: { label: 'Refunded', tone: 'neutral', description: 'Money returned in full.' },
  PARTIALLY_REFUNDED: {
    label: 'Partly refunded',
    tone: 'neutral',
    description: 'Some money returned.',
  },
  EXPIRED: { label: 'Expired', tone: 'neutral', description: 'Never paid; closed automatically.' },
};

export const PAYMENT_STATUS: StatusRegistry<string> = {
  PENDING: { label: 'Unpaid', tone: 'warning', description: 'No payment received yet.' },
  AUTHORIZED: { label: 'Authorised', tone: 'info', description: 'Approved, not captured.' },
  CAPTURED: { label: 'Paid', tone: 'success', description: 'Money received.' },
  FAILED: { label: 'Failed', tone: 'danger', description: 'The payment failed.' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral', description: 'The payment was cancelled.' },
  REFUNDED: { label: 'Refunded', tone: 'neutral', description: 'Returned in full.' },
  PARTIALLY_REFUNDED: {
    label: 'Partly refunded',
    tone: 'neutral',
    description: 'Partly returned.',
  },
  EXPIRED: { label: 'Expired', tone: 'neutral', description: 'The payment window closed.' },
};

export const FULFILMENT_STATUS: Record<string, string> = {
  UNFULFILLED: 'Not shipped',
  PARTIALLY_FULFILLED: 'Partly shipped',
  FULFILLED: 'Shipped',
  CANCELLED: 'Cancelled',
};

export const SHIPMENT_STATUS: StatusRegistry<string> = {
  DRAFT: { label: 'Draft', tone: 'neutral', description: 'Created; nothing booked.' },
  READY: { label: 'Ready', tone: 'info', description: 'Packed.' },
  AWB_ASSIGNED: {
    label: 'Tracking number set',
    tone: 'info',
    description: 'Has a courier tracking number.',
  },
  PICKUP_SCHEDULED: {
    label: 'Pickup scheduled',
    tone: 'info',
    description: 'The courier will collect it.',
  },
  PICKED_UP: { label: 'Picked up', tone: 'brand', description: 'With the courier.' },
  IN_TRANSIT: { label: 'In transit', tone: 'brand', description: 'On its way.' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'brand', description: 'Arriving today.' },
  DELIVERED: { label: 'Delivered', tone: 'success', description: 'Received.' },
  UNDELIVERED: {
    label: 'Not delivered',
    tone: 'warning',
    description: 'A delivery attempt failed.',
  },
  RTO_INITIATED: { label: 'Returning', tone: 'warning', description: 'Coming back to us.' },
  RTO_DELIVERED: { label: 'Returned to us', tone: 'neutral', description: 'Back with us.' },
  CANCELLATION_REQUESTED: {
    label: 'Cancelling',
    tone: 'warning',
    description: 'Cancellation asked.',
  },
  CANCELLED: { label: 'Cancelled', tone: 'neutral', description: 'Stopped.' },
  LOST: { label: 'Lost', tone: 'danger', description: 'The courier lost it.' },
};

export const REFUND_REASON_LABELS: Record<string, string> = {
  CUSTOMER_REQUEST: 'Customer asked',
  OUT_OF_STOCK: 'Out of stock',
  DAMAGED: 'Damaged',
  WRONG_ITEM: 'Wrong item',
  LATE_DELIVERY: 'Late delivery',
  DUPLICATE_PAYMENT: 'Duplicate payment',
  ORDER_CANCELLED: 'Order cancelled',
  PRICING_ERROR: 'Pricing error',
  GOODWILL: 'Goodwill',
  OTHER: 'Other',
};

export const DOCUMENT_LABELS: Record<string, string> = {
  TAX_INVOICE: 'Tax invoice',
  CREDIT_NOTE: 'Credit note',
  PACKING_SLIP: 'Packing slip',
  SHIPPING_LABEL: 'Shipping label',
  MANIFEST: 'Manifest',
  POD: 'Proof of delivery',
};

/** `details.allowed` of a refused order or shipment transition, when the server sends it. */
export function allowedFrom(error: unknown): string[] | null {
  if (!(error instanceof ApiError)) return null;
  const allowed = (error.details as { allowed?: unknown } | null)?.allowed;
  return Array.isArray(allowed) ? allowed.filter((s): s is string => typeof s === 'string') : null;
}

export const viewHref = (id: string, tab?: string) =>
  `/orders/view?id=${encodeURIComponent(id)}${tab ? `&tab=${tab}` : ''}`;
