import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { AuthGate } from '@/lib/auth/guards';
import { productDetail } from '@/tests/fixtures/catalog';
import { API, account, callsTo, guarded, ok, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/render';

import { catalogKeys } from '../api';

import { BulkActions } from './bulk-actions';

const chair = productDetail({ id: 'prd_chair', name: 'Anant Reading Chair' });
const table = productDetail({ id: 'prd_table', name: 'Trikon Nesting Tables' });

describe('BulkActions', () => {
  it('shows each refusal and refreshes the list only once the summary is closed', async () => {
    signInAs(account({ role: 'CATALOG_MANAGER' }));
    server.use(
      http.post(
        `${API}/admin/catalog/bulk`,
        guarded(
          () =>
            ok({
              action: 'PUBLISH',
              requested: 2,
              succeeded: 1,
              failed: 1,
              results: [
                { id: 'prd_chair', ok: true, code: null, message: null },
                {
                  id: 'prd_table',
                  ok: false,
                  code: 'PRODUCT_NOT_PUBLISHABLE',
                  message: 'Set a primary image',
                },
              ],
            }),
          { csrf: true },
        ),
      ),
    );
    const onDone = vi.fn();
    const { queryClient } = renderWithProviders(
      <AuthGate>
        <BulkActions selected={[chair, table]} onDone={onDone} />
      </AuthGate>,
    );
    const refresh = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();
    await user.selectOptions(
      await screen.findByLabelText('Action for the selected products'),
      'PUBLISH',
    );
    await user.click(screen.getByRole('button', { name: 'Apply to 2' }));
    const dialog = await screen.findByRole('dialog', { name: 'Publish: 2 products' });
    await user.click(within(dialog).getByRole('button', { name: 'Publish 2' }));

    const summary = await screen.findByRole('dialog', { name: '1 of 2 done' });
    const refused = within(summary).getByRole('list', { name: 'Products that were not changed' });
    expect(refused).toHaveTextContent('Trikon Nesting Tables');
    expect(refused).toHaveTextContent('Set a primary image');
    expect(callsTo('/api/v1/admin/catalog/bulk', 'POST')[0]!.body).toMatchObject({
      action: 'PUBLISH',
      ids: ['prd_chair', 'prd_table'],
    });
    const listRefreshes = () =>
      refresh.mock.calls.filter(([filters]) => filters?.queryKey?.[0] === catalogKeys.all[0]);
    expect(listRefreshes()).toHaveLength(0);

    await user.click(within(summary).getAllByRole('button', { name: 'Close' })[0]!);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(listRefreshes()).toHaveLength(1);
  });
});
