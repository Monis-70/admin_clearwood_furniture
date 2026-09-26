import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { AuthGate } from '@/lib/auth/guards';
import { API, account, callsTo, errorBody, guarded, ok, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { navigation } from '@/tests/navigation';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { AttributesScreen } from './attributes-screen';

interface Row {
  id: string;
  code: string;
  name: string;
  groupId: string | null;
  inputType: string;
  version: number;
  values: { id: string; code: string; label: string; position: number }[];
  [key: string]: unknown;
}

function attribute(id: string, name: string, overrides: Partial<Row> = {}): Row {
  return {
    id,
    code: name.toUpperCase().replace(/\W+/g, '_'),
    name,
    groupId: 'grp_material',
    inputType: 'SELECT',
    dataType: 'STRING',
    unit: null,
    isVariantDefining: false,
    isFilterable: true,
    isSearchable: false,
    isRequired: false,
    isComparable: false,
    showInSwatch: false,
    position: 1,
    helpText: null,
    isActive: true,
    version: 1,
    values: [],
    ...overrides,
  };
}

const idFrom = (request: Request) => new URL(request.url).pathname.split('/').at(-2) ?? '';
const lastSegment = (request: Request) => new URL(request.url).pathname.split('/').at(-1) ?? '';

/** An in-memory attribute API, so a create is followed by the real detail read. */
function serve(initial: Row[]) {
  const rows = [...initial];
  const meta = () => ({
    page: 1,
    limit: 25,
    total: rows.length,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  server.use(
    http.get(
      `${API}/admin/catalog/attribute-groups`,
      guarded(() =>
        ok([
          { id: 'grp_material', name: 'Material', code: 'MATERIAL', position: 1, isActive: true },
        ]),
      ),
    ),
    http.get(
      `${API}/admin/catalog/attributes`,
      guarded(() => ok(rows, 200, meta())),
    ),
    http.get(
      `${API}/admin/catalog/attributes/:id`,
      guarded((_a, request) => {
        const row = rows.find((r) => r.id === lastSegment(request));
        return row ? ok(row) : errorBody(404, 'NOT_FOUND', 'Attribute not found');
      }),
    ),
    http.post(
      `${API}/admin/catalog/attributes`,
      guarded(
        async (_a, request) => {
          const body = (await request.clone().json()) as Partial<Row>;
          const row = attribute('att_new', String(body.name), { ...body, id: 'att_new' });
          rows.push(row);
          return ok(row, 201);
        },
        { csrf: true },
      ),
    ),
    http.post(
      `${API}/admin/catalog/attributes/:id/values`,
      guarded(
        async (_a, request) => {
          const body = (await request.clone().json()) as { code: string; label: string };
          const row = rows.find((r) => r.id === idFrom(request))!;
          const value = {
            id: `val_${body.code.toLowerCase()}`,
            attributeId: row.id,
            description: null,
            colorHex: null,
            swatchMediaId: null,
            numericValue: null,
            isActive: true,
            version: 1,
            position: row.values.length,
            ...body,
          };
          row.values = [...row.values, value];
          return ok(value, 201);
        },
        { csrf: true },
      ),
    ),
    http.delete(
      `${API}/admin/catalog/attributes/:id`,
      guarded(
        () =>
          errorBody(409, 'ATTRIBUTE_IN_USE', 'This attribute is still referenced', {
            products: 3,
          }),
        { csrf: true },
      ),
    ),
  );
}

function renderScreen(role: 'SUPER_ADMIN' | 'ORDER_MANAGER' = 'SUPER_ADMIN', search = '') {
  signInAs(account({ role }));
  navigation.reset('/catalog/attributes', search);
  return renderWithProviders(
    <AuthGate>
      <AttributesScreen />
    </AuthGate>,
  );
}

describe('AttributesScreen', () => {
  it('lists attributes with their group, input and how they are used', async () => {
    serve([
      attribute('att_wood', 'Wood type', { isRequired: true }),
      attribute('att_colour', 'Fabric colour', {
        groupId: null,
        inputType: 'SWATCH_COLOR',
        isVariantDefining: true,
      }),
    ]);
    const { container } = renderScreen();
    const table = await screen.findByRole('table', { name: 'Attributes' });
    const wood = within(table).getByText('Wood type').closest('tr')!;
    expect(within(wood).getByText('Material')).toBeInTheDocument();
    expect(within(wood).getByText('Pick one')).toBeInTheDocument();
    expect(within(wood).getByText('Required')).toBeInTheDocument();
    const colour = within(table).getByText('Fabric colour').closest('tr')!;
    expect(within(colour).getByText('Colour swatch')).toBeInTheDocument();
    expect(within(colour).getByText('Variant option')).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('creates an attribute, then adds its first value to the one the API returned', async () => {
    serve([attribute('att_wood', 'Wood type')]);
    renderScreen();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New attribute' }));
    const sheet = await screen.findByRole('dialog', { name: 'New attribute' });
    await user.type(within(sheet).getByRole('textbox', { name: /^Name/ }), 'Seat depth');
    await user.type(within(sheet).getByRole('textbox', { name: /^Code/ }), 'SEAT_DEPTH');
    await user.click(within(sheet).getByRole('button', { name: 'Create attribute' }));

    const created = await screen.findByRole('dialog', { name: 'Seat depth' });
    expect(callsTo('/api/v1/admin/catalog/attributes', 'POST')[0]!.body).toMatchObject({
      name: 'Seat depth',
      code: 'SEAT_DEPTH',
      inputType: 'SELECT',
      groupId: null,
    });
    await user.type(within(created).getByLabelText('New value'), 'Solid oak');
    expect(within(created).getByLabelText('Code', { selector: '#value-code' })).toHaveValue(
      'SOLID_OAK',
    );
    await user.click(within(created).getByRole('button', { name: 'Add value' }));
    expect(await within(created).findByText('Solid oak')).toBeInTheDocument();
    expect(
      callsTo('/api/v1/admin/catalog/attributes/att_new/values', 'POST')[0]!.body,
    ).toMatchObject({ label: 'Solid oak', code: 'SOLID_OAK', position: 0 });
  });

  it('refuses a code that is not UPPER_SNAKE_CASE before sending anything', async () => {
    serve([]);
    renderScreen('SUPER_ADMIN', 'id=new');
    const user = userEvent.setup();
    const sheet = await screen.findByRole('dialog', { name: 'New attribute' });
    await user.type(within(sheet).getByRole('textbox', { name: /^Name/ }), 'Seat depth');
    await user.type(within(sheet).getByRole('textbox', { name: /^Code/ }), 'seat depth');
    await user.click(within(sheet).getByRole('button', { name: 'Create attribute' }));
    expect(
      await within(sheet).findByText('Use UPPER_SNAKE_CASE, e.g. SEAT_MATERIAL'),
    ).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/catalog/attributes', 'POST')).toHaveLength(0);
  });

  it('keeps the delete dialog open with the reason when the API refuses it', async () => {
    serve([attribute('att_wood', 'Wood type')]);
    renderScreen();
    const user = userEvent.setup();
    const table = await screen.findByRole('table', { name: 'Attributes' });
    await user.click(within(table).getByRole('button', { name: 'Actions for Wood type' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete…' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Wood type?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete attribute' }));
    expect(await within(dialog).findByText('Still in use')).toBeInTheDocument();
    expect(within(dialog).getByText('This attribute is still referenced')).toBeInTheDocument();
    await waitFor(() =>
      expect(callsTo('/api/v1/admin/catalog/attributes/att_wood', 'DELETE')).toHaveLength(1),
    );
  });

  it('explains the missing permission to a role without catalog.attribute.read', async () => {
    serve([attribute('att_wood', 'Wood type')]);
    renderScreen('ORDER_MANAGER');
    expect(
      await screen.findByRole('heading', { name: "You don't have access to attributes" }),
    ).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/catalog/attributes')).toHaveLength(0);
    expect(callsTo('/api/v1/admin/catalog/attribute-groups')).toHaveLength(0);
  });
});
