import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { VersionConflictDialog, type ConflictField } from './version-conflict-dialog';

interface Brand {
  name: string;
  slug: string;
  isActive: boolean;
  version: number;
}

const fields: ConflictField<Brand>[] = [
  { key: 'name', label: 'Name' },
  { key: 'slug', label: 'URL slug' },
  { key: 'isActive', label: 'Active' },
];

const latest: Brand = {
  name: 'Sheesham House',
  slug: 'sheesham-house',
  isActive: false,
  version: 4,
};

describe('VersionConflictDialog', () => {
  it('explains the conflict and compares only what differs', async () => {
    render(
      <VersionConflictDialog<Brand>
        open
        yours={{ name: 'Sheesham Home', slug: 'sheesham-house', isActive: true }}
        fields={fields}
        loadLatest={() => Promise.resolve(latest)}
        onReload={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('dialog', { name: 'Someone else changed this record' }),
    ).toHaveTextContent('nothing was overwritten');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Compare' }));
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(within(table).getByRole('rowheader', { name: 'Name' })).toBeInTheDocument();
    expect(within(table).getByText('Sheesham Home')).toBeInTheDocument();
    expect(within(table).getByText('No')).toBeInTheDocument();
    expect(within(table).queryByRole('rowheader', { name: 'URL slug' })).not.toBeInTheDocument();
  });

  it('treats empty text and null as the same value', async () => {
    render(
      <VersionConflictDialog<Brand & { note: string | null }>
        open
        yours={{ name: 'Sheesham House', note: '' }}
        fields={[
          { key: 'name', label: 'Name' },
          { key: 'note', label: 'Note' },
        ]}
        loadLatest={() => Promise.resolve({ ...latest, note: null })}
        onReload={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Compare' }));
    expect(await screen.findByText(/The fields you changed were not touched/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('compares every submitted field, even one the caller did not label', async () => {
    render(
      <VersionConflictDialog<Brand & { seatHeightMm: number }>
        open
        yours={{ name: 'Sheesham House', seatHeightMm: 450 }}
        fields={[{ key: 'name', label: 'Name' }]}
        loadLatest={() => Promise.resolve({ ...latest, seatHeightMm: 430 })}
        onReload={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Compare' }));
    const table = await screen.findByRole('table');
    expect(within(table).getByRole('rowheader', { name: 'Seat height mm' })).toBeInTheDocument();
    expect(within(table).getByText('450')).toBeInTheDocument();
    expect(screen.queryByText(/were not touched/)).not.toBeInTheDocument();
  });

  it('reloads with the latest server version', async () => {
    const onReload = vi.fn();
    render(
      <VersionConflictDialog<Brand>
        open
        yours={{ name: 'x' }}
        fields={fields}
        loadLatest={() => Promise.resolve(latest)}
        onReload={onReload}
        onCancel={vi.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reload latest' }));
    await waitFor(() => expect(onReload).toHaveBeenCalledWith(latest));
  });

  it('lets the operator go back to their edits', async () => {
    const onCancel = vi.fn();
    render(
      <VersionConflictDialog<Brand>
        open
        yours={{}}
        fields={fields}
        loadLatest={() => Promise.resolve(latest)}
        onReload={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
