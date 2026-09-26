import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { API, ok } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/render';

import { PathCheck } from './path-check';

describe('PathCheck', () => {
  it("states the storefront resolver's answer for an old address and for an unknown one", async () => {
    const asked: string[] = [];
    server.use(
      http.get(`${API}/catalog/resolve`, ({ request }) => {
        const path = new URL(request.url).searchParams.get('path') ?? '';
        asked.push(path);
        return ok(
          path === '/products/old-sofa'
            ? {
                type: 'REDIRECT',
                path,
                entity: { id: 'p1', slug: 'new-sofa', name: 'New Sofa', type: 'PRODUCT' },
                redirectTo: '/products/new-sofa',
                statusCode: 301,
              }
            : { type: 'NOT_FOUND', path, entity: null, redirectTo: null, statusCode: 404 },
        );
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<PathCheck id="test" />);

    const field = screen.getByLabelText('Check an address');
    expect(asked).toHaveLength(0);
    await user.type(field, '/products/old-sofa');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(
      await screen.findByText(/Forwards \(301\) to \/products\/new-sofa: New Sofa\./),
    ).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, '/products/gone');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText(/page not found/)).toBeInTheDocument();
    expect(asked).toEqual(['/products/old-sofa', '/products/gone']);
  });
});
