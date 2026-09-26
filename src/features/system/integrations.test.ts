import { describe, expect, it } from 'vitest';

import { integrationsFrom } from './integrations';

const drivers = {
  db: 'mysql',
  cache: 'redis',
  storage: 'local',
  mail: 'log',
  payment: 'mock',
  shipping: 'manual',
  otp: 'log',
  search: 'sql',
} as const;

describe('integrationsFrom', () => {
  it('reports the release configuration as on hold, in plain words', () => {
    const rows = Object.fromEntries(integrationsFrom(drivers).map((row) => [row.id, row]));
    expect(rows.payments).toMatchObject({ state: 'on-hold', hold: 'payments' });
    expect(rows.payments!.summary).toContain('Cash on delivery only');
    expect(rows.refunds!.state).toBe('on-hold');
    expect(rows.returns!.state).toBe('on-hold');
    expect(rows.courier).toMatchObject({ state: 'on-hold', technical: 'shipping: manual' });
    expect(rows.email).toMatchObject({ state: 'on-hold', technical: 'mail: log' });
    expect(rows.otp!.state).toBe('on-hold');
    expect(rows.storage!.state).toBe('infrastructure');
  });

  it('only reports "active" when the API says so, and refunds/returns stay on hold regardless', () => {
    const rows = Object.fromEntries(
      integrationsFrom({
        ...drivers,
        payment: 'razorpay',
        mail: 'smtp',
        shipping: 'shiprocket',
        otp: 'sms',
      }).map((row) => [row.id, row.state]),
    );
    expect(rows).toMatchObject({
      payments: 'active',
      email: 'active',
      courier: 'active',
      otp: 'active',
      refunds: 'on-hold',
      returns: 'on-hold',
    });
  });

  it('copes with an API that does not report shipping or search', () => {
    const rows = integrationsFrom({ ...drivers, shipping: undefined, search: undefined });
    expect(rows.find((row) => row.id === 'courier')?.technical).toBe('shipping: not reported');
    expect(rows.find((row) => row.id === 'search')).toBeUndefined();
  });
});
