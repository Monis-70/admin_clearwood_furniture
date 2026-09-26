import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { AuthGate } from '@/lib/auth/guards';
import { API, account, callsTo, guarded, ok, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { navigation } from '@/tests/navigation';
import { renderWithProviders } from '@/tests/render';

import { EnquiriesScreen } from './enquiries-screen';

const V1 = '/api/v1/admin';
const meta = (n: number) => ({
  page: 1,
  limit: 25,
  total: n,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
});

const summary = {
  id: 'enq_1',
  formKey: 'bulk-order',
  status: 'NEW',
  name: 'Meera Iyer',
  email: 'meera@example.test',
  phone: null,
  city: 'Bengaluru',
  categoryId: null,
  categoryName: null,
  productId: null,
  assignedToId: 'adm_2',
  createdAt: '2026-09-25T04:00:00.000Z',
};
const detail = {
  ...summary,
  pincode: '560001',
  companyName: null,
  message: 'Forty chairs for a cafe.',
  quantity: 40,
  budgetPaise: null,
  productName: null,
  customerId: null,
  source: 'WEB',
  details: {},
  adminNote: null,
  version: 2,
  updatedAt: '2026-09-25T04:00:00.000Z',
};

function render(role: 'CONTENT_MANAGER' | 'ORDER_MANAGER') {
  server.use(
    http.get(
      `${API}/admin/enquiries`,
      guarded(() => ok([summary], 200, meta(1))),
    ),
    http.get(
      `${API}/admin/enquiries/enq_1`,
      guarded(() => ok(detail)),
    ),
    http.get(
      `${API}/admin/enquiries/assignees`,
      guarded(() =>
        ok([
          { id: 'adm_2', name: 'Priya Nair' },
          { id: 'adm_3', name: 'Arjun Rao' },
        ]),
      ),
    ),
    http.patch(
      `${API}/admin/enquiries/enq_1`,
      guarded(() => ok({ ...detail, status: 'CONTACTED', assignedToId: 'adm_3', version: 3 }), {
        csrf: true,
      }),
    ),
  );
  signInAs(account({ role }));
  navigation.reset('/enquiries', 'id=enq_1');
  return renderWithProviders(
    <AuthGate>
      <EnquiriesScreen />
    </AuthGate>,
  );
}

describe('Enquiry follow-up', () => {
  it('moves an enquiry on and reassigns it, sending only what changed with the version', async () => {
    const user = userEvent.setup();
    render('CONTENT_MANAGER');

    const table = await screen.findByRole('table', { name: 'Enquiries' });
    expect(await within(table).findByText('Priya Nair')).toBeInTheDocument();

    const sheet = await screen.findByRole('dialog');
    const status = await within(sheet).findByLabelText('Status');
    await user.selectOptions(status, 'CONTACTED');
    await user.selectOptions(within(sheet).getByLabelText('Assigned to'), 'adm_3');
    await user.click(within(sheet).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(callsTo(`${V1}/enquiries/enq_1`, 'PATCH')).toHaveLength(1));
    expect(callsTo(`${V1}/enquiries/enq_1`, 'PATCH')[0]!.body).toEqual({
      version: 2,
      status: 'CONTACTED',
      assignedToId: 'adm_3',
    });
  });

  it('shows the follow-up read-only to roles that can only read enquiries', async () => {
    render('ORDER_MANAGER');
    const sheet = await screen.findByRole('dialog');
    expect(
      await within(sheet).findByText(/Updating enquiries needs the lead.enquiry.update permission/),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByText(/Assigning needs the lead.enquiry.assign permission/),
    ).toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(callsTo(`${V1}/enquiries/assignees`, 'GET')).toHaveLength(0);
  });
});
