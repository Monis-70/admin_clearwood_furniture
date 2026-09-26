'use client';

import {
  columnVisibilityFeature,
  rowSelectionFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ColumnVisibilityState,
  type RowData,
  type RowSelectionState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import type { PaginationMeta } from '@shared/types/api';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/surface';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePreference } from '@/lib/preferences';
import { cn } from '@/lib/utils';

import { ErrorState } from '../states';

import { DataTablePagination } from './data-table-pagination';
import type { SortOrder } from './use-list-params';

export interface DataTableColumnMeta {
  /** Header text; also used for the column menu and the mobile card labels. */
  label: string;
  /** Backend `sort` field; only columns the API can sort by get one. */
  sortKey?: string;
  align?: 'left' | 'right';
  /** Always visible (the column that identifies a row). */
  pinned?: boolean;
  /** How the column appears on small screens: the card title, a detail line, or not at all. */
  mobile?: 'title' | 'detail' | 'hidden';
  className?: string;
}

export const dataTableFeatures = tableFeatures({
  columnVisibilityFeature,
  rowSelectionFeature,
  columnMeta: {} as DataTableColumnMeta,
});

export type DataTableFeatures = typeof dataTableFeatures;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DataTableColumn<TData extends RowData> = ColumnDef<DataTableFeatures, TData, any>;

type QueryLike<TData> = {
  data: { items: TData[]; meta: PaginationMeta } | undefined;
  error: unknown;
  isPending: boolean;
  isFetching: boolean;
  isPlaceholderData?: boolean;
  refetch(): unknown;
};

interface DataTableProps<TData extends RowData> {
  /** Accessible name of the table ("Admin users"). */
  label: string;
  columns: readonly DataTableColumn<TData>[];
  query: QueryLike<TData>;
  getRowId(row: TData): string;
  sort?: {
    field: string | undefined;
    order: SortOrder;
    onChange(field: string | null, order: SortOrder): void;
  };
  onPageChange(page: number): void;
  onLimitChange(limit: number): void;
  /** Stable key for remembering hidden columns on this device. */
  preferenceKey?: string;
  /** Filters, search and primary actions above the table. */
  toolbar?: ReactNode;
  /** Shown when the list is empty without filters. */
  empty: ReactNode;
  /** Shown when filters or search matched nothing. */
  emptyFiltered?: ReactNode;
  filtered?: boolean;
  /** Enables the checkbox column and renders these actions for the selected rows. */
  bulkActions?: (selected: TData[], clear: () => void) => ReactNode;
  canSelect?: (row: TData) => boolean;
}

const isVisibilityState = (value: unknown): value is ColumnVisibilityState =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every((v) => typeof v === 'boolean');

/** Native checkbox for row selection (supports the "some selected" state without extra code). */
function SelectBox({
  label,
  checked,
  indeterminate = false,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange(checked: boolean): void;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      ref={(node) => {
        if (node) node.indeterminate = indeterminate;
      }}
      onChange={(event) => onChange(event.target.checked)}
      className="size-4 cursor-pointer rounded-[4px] accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

/**
 * The one table of the admin. Data is always server-paginated, sorted and filtered: this
 * component only renders the current page. Selection covers the visible page only; there is no
 * "select all pages" because bulk endpoints take explicit ids.
 */
export function DataTable<TData extends RowData>({
  label,
  columns,
  query,
  getRowId,
  sort,
  onPageChange,
  onLimitChange,
  preferenceKey,
  toolbar,
  empty,
  emptyFiltered,
  filtered,
  bulkActions,
  canSelect,
}: DataTableProps<TData>) {
  const [columnVisibility, setColumnVisibility] = usePreference<ColumnVisibilityState>(
    `table:${preferenceKey ?? label}:columns`,
    {},
    isVisibilityState,
  );
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const items = query.data?.items;
  const data = useMemo(() => items ?? [], [items]);
  const selectable = Boolean(bulkActions);

  const allColumns = useMemo<DataTableColumn<TData>[]>(() => {
    if (!selectable) return [...columns];
    const select: DataTableColumn<TData> = {
      id: '__select',
      meta: { label: 'Select', pinned: true, mobile: 'hidden' },
      header: ({ table }) => (
        <SelectBox
          label="Select all rows on this page"
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={!table.getIsAllPageRowsSelected() && table.getIsSomePageRowsSelected()}
          onChange={(value) => table.toggleAllPageRowsSelected(value)}
        />
      ),
      cell: ({ row }) => (
        <SelectBox
          label={`Select row ${row.index + 1}`}
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={(value) => row.toggleSelected(value)}
        />
      ),
    };
    return [select, ...columns];
  }, [columns, selectable]);

  const table = useTable({
    features: dataTableFeatures,
    columns: allColumns,
    data,
    getRowId: (row: TData) => getRowId(row),
    state: { columnVisibility, rowSelection },
    onColumnVisibilityChange: (updater) =>
      setColumnVisibility(typeof updater === 'function' ? updater(columnVisibility) : updater),
    onRowSelectionChange: setRowSelection,
    enableRowSelection: canSelect ? (row) => canSelect(row.original) : true,
  });

  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);
  const clearSelection = () => setRowSelection({});
  const hideable = table.getAllLeafColumns().filter((column) => !column.columnDef.meta?.pinned);
  const meta = query.data?.meta;
  const busy = query.isFetching && !query.isPending;

  const headerFor = (
    columnMeta: DataTableColumnMeta | undefined,
    content: ReactNode,
  ): ReactNode => {
    if (!sort || !columnMeta?.sortKey) return content;
    const active = sort.field === columnMeta.sortKey;
    const Icon = !active ? ArrowUpDown : sort.order === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        className="-mx-1 inline-flex items-center gap-1 rounded-sm px-1 uppercase hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() =>
          sort.onChange(columnMeta.sortKey!, active && sort.order === 'asc' ? 'desc' : 'asc')
        }
      >
        {content}
        <Icon aria-hidden className={cn('size-3.5', !active && 'opacity-50')} />
        <span className="sr-only">
          {active ? `, sorted ${sort.order === 'asc' ? 'ascending' : 'descending'}` : ', sortable'}
        </span>
      </button>
    );
  };

  let body: ReactNode;
  if (query.isPending) {
    body = <DataTableSkeleton columns={Math.min(allColumns.length, 6)} />;
  } else if (query.error && !query.data) {
    body = (
      <div className="p-4">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} compact />
      </div>
    );
  } else if (data.length === 0) {
    body = <div className="p-4">{filtered && emptyFiltered ? emptyFiltered : empty}</div>;
  } else {
    const visible = table.getVisibleLeafColumns();
    const titleColumn =
      visible.find((column) => column.columnDef.meta?.mobile === 'title') ??
      visible.find((c) => c.id !== '__select');
    body = (
      <>
        <div className="hidden overflow-x-auto md:block">
          <Table
            aria-label={label}
            aria-busy={busy || undefined}
            className={cn(busy && 'opacity-70 transition-opacity')}
          >
            <TableHeader className="sticky top-0 z-10">
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id} className="hover:bg-transparent">
                  {group.headers.map((header) => {
                    const columnMeta = header.column.columnDef.meta;
                    const active = sort && columnMeta?.sortKey && sort.field === columnMeta.sortKey;
                    return (
                      <TableHead
                        key={header.id}
                        scope="col"
                        aria-sort={
                          active ? (sort.order === 'asc' ? 'ascending' : 'descending') : undefined
                        }
                        className={cn(
                          columnMeta?.align === 'right' && 'text-right',
                          columnMeta?.className,
                        )}
                      >
                        {header.isPlaceholder
                          ? null
                          : headerFor(columnMeta, <table.FlexRender header={header} />)}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}>
                  {row.getVisibleCells().map((cell) => {
                    const columnMeta = cell.column.columnDef.meta;
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          columnMeta?.align === 'right' && 'text-right',
                          columnMeta?.className,
                        )}
                      >
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <ul aria-label={label} className="flex flex-col divide-y md:hidden">
          {table.getRowModel().rows.map((row) => {
            const cells = row.getVisibleCells();
            const title = cells.find((cell) => cell.column.id === titleColumn?.id);
            const selectCell = cells.find((cell) => cell.column.id === '__select');
            const details = cells.filter(
              (cell) =>
                cell !== title &&
                cell !== selectCell &&
                cell.column.columnDef.meta?.mobile !== 'hidden',
            );
            return (
              <li
                key={row.id}
                className="flex gap-3 px-3 py-3"
                data-state={row.getIsSelected() ? 'selected' : undefined}
              >
                {selectCell ? (
                  <div className="pt-0.5">{<table.FlexRender cell={selectCell} />}</div>
                ) : null}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {title ? (
                    <div className="font-medium">{<table.FlexRender cell={title} />}</div>
                  ) : null}
                  <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
                    {details.map((cell) => (
                      <div key={cell.id} className="contents">
                        <dt className="text-muted-foreground">
                          {cell.column.columnDef.meta?.label}
                        </dt>
                        <dd className="min-w-0">{<table.FlexRender cell={cell} />}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return (
    <section aria-label={label} className="rounded-lg border bg-card shadow-card">
      <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
        <div className="flex items-center gap-2">
          {busy ? <Spinner aria-label="Updating" className="text-muted-foreground" /> : null}
          {hideable.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3 aria-hidden />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hideable.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(value === true)}
                    onSelect={(event) => event.preventDefault()}
                  >
                    {column.columnDef.meta?.label ?? column.id}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {selectable && selectedRows.length > 0 ? (
        <div
          role="region"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-3 border-b bg-secondary/60 px-3 py-2 text-sm"
        >
          <span className="font-medium">{selectedRows.length} selected on this page</span>
          <div className="flex flex-wrap items-center gap-2">
            {bulkActions?.(selectedRows, clearSelection)}
          </div>
          <Button variant="ghost" size="sm" onClick={clearSelection} className="ml-auto">
            Clear selection
          </Button>
        </div>
      ) : null}

      {body}

      {meta && data.length > 0 ? (
        <DataTablePagination
          meta={meta}
          busy={busy}
          onPageChange={(page) => {
            clearSelection();
            onPageChange(page);
          }}
          onLimitChange={(limit) => {
            clearSelection();
            onLimitChange(limit);
          }}
        />
      ) : null}
    </section>
  );
}

export function DataTableSkeleton({ columns = 5, rows = 8 }: { columns?: number; rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col divide-y">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-4 px-3 py-3">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton key={column} className={cn('h-4', column === 0 ? 'w-1/4' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}
