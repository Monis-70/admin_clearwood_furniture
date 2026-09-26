import type { OnHoldDomain } from '@/components/patterns/on-hold-notice';

import type { VersionInfo } from './api';

export type IntegrationState = 'active' | 'on-hold' | 'infrastructure';

export interface IntegrationRow {
  id: string;
  name: string;
  state: IntegrationState;
  summary: string;
  /** Driver name as the API reports it, for administrators who need it. */
  technical: string;
  hold?: OnHoldDomain;
}

/**
 * What the API says about each outside service, in plain words. "Active" only ever reflects the
 * API's own driver report; the admin never switches an integration on.
 */
export function integrationsFrom(drivers: VersionInfo['drivers']): IntegrationRow[] {
  const rows: IntegrationRow[] = [];

  rows.push(
    drivers.payment === 'razorpay'
      ? {
          id: 'payments',
          name: 'Online payments',
          state: 'active',
          summary: 'Razorpay is connected on the API.',
          technical: 'payment: razorpay',
        }
      : {
          id: 'payments',
          name: 'Online payments',
          state: 'on-hold',
          summary: 'Cash on delivery only. The payment gateway is not enabled.',
          technical: `payment: ${drivers.payment}`,
          hold: 'payments',
        },
  );
  rows.push({
    id: 'refunds',
    name: 'Refunds',
    state: 'on-hold',
    summary: 'Not enabled in this release; refunds need the payment gateway.',
    technical: 'depends on payment',
    hold: 'refunds',
  });
  rows.push({
    id: 'returns',
    name: 'Customer returns',
    state: 'on-hold',
    summary: 'Not enabled in this release; customers cannot request returns.',
    technical: 'FEATURE_CUSTOMER_RETURNS',
    hold: 'returns',
  });

  const shipping = drivers.shipping;
  rows.push(
    shipping === 'shiprocket'
      ? {
          id: 'courier',
          name: 'Courier integration',
          state: 'active',
          summary: 'Shiprocket is connected on the API.',
          technical: 'shipping: shiprocket',
        }
      : {
          id: 'courier',
          name: 'Courier integration',
          state: 'on-hold',
          summary:
            'Shipments are recorded manually; courier booking and live tracking are not enabled.',
          technical: `shipping: ${shipping ?? 'not reported'}`,
          hold: 'shipping',
        },
  );
  rows.push(
    drivers.mail === 'smtp'
      ? {
          id: 'email',
          name: 'Email delivery',
          state: 'active',
          summary: 'Emails are sent through SMTP.',
          technical: 'mail: smtp',
        }
      : {
          id: 'email',
          name: 'Email delivery',
          state: 'on-hold',
          summary: 'Emails are recorded but not sent.',
          technical: `mail: ${drivers.mail}`,
          hold: 'email',
        },
  );
  rows.push(
    drivers.otp === 'log'
      ? {
          id: 'otp',
          name: 'SMS and WhatsApp codes',
          state: 'on-hold',
          summary: 'One-time codes are recorded but not delivered.',
          technical: 'otp: log',
          hold: 'otp',
        }
      : {
          id: 'otp',
          name: 'SMS and WhatsApp codes',
          state: 'active',
          summary: 'One-time codes are delivered.',
          technical: `otp: ${drivers.otp}`,
        },
  );

  rows.push({
    id: 'storage',
    name: 'Media storage',
    state: 'infrastructure',
    summary:
      drivers.storage === 's3'
        ? 'Files are stored in cloud object storage.'
        : 'Files are stored on the API server.',
    technical: `storage: ${drivers.storage}`,
  });
  rows.push({
    id: 'cache',
    name: 'Cache',
    state: 'infrastructure',
    summary: drivers.cache === 'redis' ? 'Shared cache (Redis).' : 'In-process cache only.',
    technical: `cache: ${drivers.cache}`,
  });
  rows.push({
    id: 'database',
    name: 'Database',
    state: 'infrastructure',
    summary: drivers.db === 'mysql' ? 'MySQL.' : 'SQLite (not for production).',
    technical: `db: ${drivers.db}`,
  });
  if (drivers.search) {
    rows.push({
      id: 'search',
      name: 'Search engine',
      state: 'infrastructure',
      summary:
        drivers.search === 'meili' ? 'Dedicated search engine.' : 'Search runs in the database.',
      technical: `search: ${drivers.search}`,
    });
  }
  return rows;
}
