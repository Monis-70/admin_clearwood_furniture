import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { ROOT, API, errorBody, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { SystemStatusScreen } from './system-status-screen';

describe('SystemStatusScreen', () => {
  it('shows API health, build and integrations in plain language', async () => {
    signInAs();
    const { container } = renderWithProviders(<SystemStatusScreen />);
    expect(await screen.findByText('1 d 2 h')).toBeInTheDocument();
    expect(await screen.findByText('Ready')).toBeInTheDocument();
    expect(await screen.findByText('ClearWood Furnitures')).toBeInTheDocument();

    const integrations = screen.getByRole('heading', { name: 'Integrations' }).closest('section')!;
    const payments = within(integrations).getByText('Online payments').closest('li')!;
    expect(within(payments).getByText('On hold')).toBeInTheDocument();
    expect(
      within(payments).getByText('Cash on delivery only. The payment gateway is not enabled.'),
    ).toBeInTheDocument();
    expect(within(payments).getByText('payment: mock')).toBeInTheDocument();
    expect(
      within(payments).getByText('Still works: Orders with cash on delivery work normally.'),
    ).toBeInTheDocument();

    const refunds = within(integrations).getByText('Refunds').closest('li')!;
    expect(within(refunds).getByText('On hold')).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('shows the per-dependency report when the database is down (503)', async () => {
    server.use(
      http.get(`${ROOT}/ready`, () =>
        errorBody(503, 'SERVICE_UNAVAILABLE', 'Not ready', {
          status: 'unavailable',
          timestamp: '2026-09-25T09:30:00.000Z',
          dependencies: {
            database: { status: 'down', driver: 'mysql', latencyMs: 2000, error: 'timeout' },
            cache: { status: 'up', driver: 'redis', latencyMs: 1 },
          },
        }),
      ),
    );
    renderWithProviders(<SystemStatusScreen />);
    expect(await screen.findByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Down')).toBeInTheDocument();
  });

  it('shows a retryable error when the API cannot be reached', async () => {
    server.use(
      http.get(`${ROOT}/health`, () => HttpResponse.error()),
      http.get(`${API}/version`, () => HttpResponse.error()),
    );
    renderWithProviders(<SystemStatusScreen />);
    expect(await screen.findByText('The API is not responding')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Try again' }).length).toBeGreaterThan(0);
  });
});
