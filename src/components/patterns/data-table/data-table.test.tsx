import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { PaginationMeta } from '@shared/types/api';

import { ApiError } from '@/lib/api/errors';
import { expectNoA11yViolations } from '@/tests/render';

import { EmptyState } from '../states';

import { DataTable, type DataTableColumn } from './data-table';

interface Row {
  id: string;
  name: string;
  status: string;
}

const columns: DataTableColumn<Row>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    meta: { label: 'Name', sortKey: 'name', pinned: true, mobile: 'title' },
  },
  { id: 'status', accessorKey: 'status', header: 'Status', meta: { label: 'Status' } },
  { id: 'id', accessorKey: 'id', header: 'Reference', meta: { label: 'Reference' } },
];

const meta = (overrides: Partial<PaginationMeta> = {}): PaginationMeta => ({
  page: 1,
  limit: 25,
  total: 2,
  totalPages: 1,
  hasNext: false,
  ...overrides,
});

const rows: Row[] = [
  { id: 'r1', name: 'Kabir Sofa', status: 'Live' },
  { id: 'r2', name: 'Aria Bed', status: 'Draft' },
];

function query(overrides: Partial<Parameters<typeof DataTable<Row>>[0]['query']> = {}) {
  return {
    data: { items: rows, meta: meta() },
    error: null,
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

function renderTable(props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) {
  const handlers = { onPageChange: vi.fn(), onLimitChange: vi.fn(), onSort: vi.fn() };
  const utils = render(
    <DataTable<Row>
      label="Products"
      columns={columns}
      query={query()}
      getRowId={(row) => row.id}
      sort={{ field: undefined, order: 'asc', onChange: handlers.onSort }}
      onPageChange={handlers.onPageChange}
      onLimitChange={handlers.onLimitChange}
      empty={<EmptyState title="No products yet" />}
      emptyFiltered={<EmptyState title="No products match" />}
      {...props}
    />,
  );
  return { ...utils, ...handlers };
}

describe('DataTable', () => {
  it('renders the current page as an accessible table and mobile list', async () => {
    const { container } = renderTable();
    const table = screen.getByRole('table', { name: 'Products' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByRole('cell', { name: 'Kabir Sofa' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Products' })).toBeInTheDocument();
    expect(screen.getByText('Showing 1–2 of 2')).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('shows a skeleton on first load and the error state with retry', async () => {
    const { rerender } = render(
      <DataTable<Row>
        label="Products"
        columns={columns}
        query={query({ data: undefined, isPending: true })}
        getRowId={(r) => r.id}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
        empty={null}
      />,
    );
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();

    const refetch = vi.fn();
    const error = new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'x',
      requestId: 'req-12345678',
      method: 'GET',
      path: '/admin/catalog/products',
    });
    rerender(
      <DataTable<Row>
        label="Products"
        columns={columns}
        query={query({ data: undefined, error, refetch })}
        getRowId={(r) => r.id}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
        empty={null}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Cannot reach the server');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('distinguishes an empty list from a search with no results', () => {
    const { rerender } = renderTable({
      query: query({ data: { items: [], meta: meta({ total: 0 }) } }),
    });
    expect(screen.getByText('No products yet')).toBeInTheDocument();
    rerender(
      <DataTable<Row>
        label="Products"
        columns={columns}
        query={query({ data: { items: [], meta: meta({ total: 0 }) } })}
        getRowId={(r) => r.id}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
        empty={<EmptyState title="No products yet" />}
        emptyFiltered={<EmptyState title="No products match" />}
        filtered
      />,
    );
    expect(screen.getByText('No products match')).toBeInTheDocument();
  });

  it('asks the server to sort, only by sortable columns, and exposes aria-sort', async () => {
    const { onSort, rerender } = renderTable();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Name/ }));
    expect(onSort).toHaveBeenCalledWith('name', 'asc');
    expect(screen.queryByRole('button', { name: /Status/ })).not.toBeInTheDocument();

    rerender(
      <DataTable<Row>
        label="Products"
        columns={columns}
        query={query()}
        getRowId={(r) => r.id}
        sort={{ field: 'name', order: 'asc', onChange: onSort }}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
        empty={null}
      />,
    );
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await user.click(screen.getByRole('button', { name: /Name/ }));
    expect(onSort).toHaveBeenLastCalledWith('name', 'desc');
  });

  it('pages through the API meta', async () => {
    const { onPageChange } = renderTable({
      query: query({
        data: { items: rows, meta: meta({ total: 60, totalPages: 3, hasNext: true }) },
      }),
    });
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('selects rows on the current page and offers bulk actions for them', async () => {
    const bulk = vi.fn();
    renderTable({
      bulkActions: (selected) => (
        <button type="button" onClick={() => bulk(selected.map((r) => r.id))}>
          Archive
        </button>
      ),
    });
    const user = userEvent.setup();
    const table = screen.getByRole('table', { name: 'Products' });
    await user.click(within(table).getByRole('checkbox', { name: 'Select all rows on this page' }));
    const region = screen.getByRole('region', { name: 'Bulk actions' });
    expect(region).toHaveTextContent('2 selected on this page');
    await user.click(within(region).getByRole('button', { name: 'Archive' }));
    expect(bulk).toHaveBeenCalledWith(['r1', 'r2']);
    await user.click(within(region).getByRole('button', { name: 'Clear selection' }));
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument();
  });

  it('hides columns on request and remembers it', async () => {
    renderTable({ preferenceKey: 'products' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Columns' }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Reference' }));
    await user.keyboard('{Escape}');
    expect(
      within(screen.getByRole('table')).queryByRole('columnheader', { name: 'Reference' }),
    ).not.toBeInTheDocument();
    expect(window.localStorage.getItem('cw-admin:pref:table:products:columns')).toBe(
      '{"id":false}',
    );
  });
});
