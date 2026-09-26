'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ChevronRight, FolderTree, MoreHorizontal, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { AdminCategoryDto } from '@shared/types/catalogAdmin';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { FilterSelect } from '@/components/patterns/data-table/filter-select';
import { SearchInput } from '@/components/patterns/data-table/search-input';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { PageHeader } from '@/components/patterns/page-header';
import {
  EmptyState,
  ErrorState,
  PermissionNotice,
  SectionLoader,
} from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { catalogRoutes } from '@/lib/api/routes/catalog';
import { categoriesRoutes } from '@/lib/api/routes/categories';
import { formatCount, formatNumber, formatRelative } from '@/lib/format/datetime';
import { notifyError, notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';
import { cn } from '@/lib/utils';

import { catalogApi, catalogKeys } from '../api';
import { categoriesApi, taxonomyKeys } from '../taxonomy/api';

import { KIND_LABELS, buildTree, filterTree, type CategoryNode } from './model';

const CategoryEditor = dynamic(() => import('./category-editor').then((m) => m.CategoryEditor), {
  ssr: false,
});
const CategoryDialogs = dynamic(() => import('./category-dialogs').then((m) => m.CategoryDialogs), {
  ssr: false,
});

export type CategoryDialog =
  | { kind: 'create'; parentId: string | null }
  | { kind: 'move'; category: AdminCategoryDto }
  | { kind: 'delete'; category: AdminCategoryDto };

const VIEWS = [
  { id: 'tree', label: 'Tree' },
  { id: 'list', label: 'Search list' },
  { id: 'trash', label: 'Including deleted' },
] as const;

export function CategoriesScreen() {
  const { canCall } = usePermissions();
  if (!canCall(catalogRoutes.categoryTree)) {
    return <PermissionNotice area="categories" all={['catalog.category.read']} />;
  }
  return <Categories />;
}

function Categories() {
  const { canCall } = usePermissions();
  const params = useListParams<'view' | 'id' | 'isActive' | 'new'>({
    filters: ['view', 'id', 'isActive', 'new'],
    defaultSort: 'name',
    defaultOrder: 'asc',
  });
  const view =
    params.filters.view === 'list' || params.filters.view === 'trash'
      ? params.filters.view
      : 'tree';
  const [dialog, setDialog] = useState<CategoryDialog | null>(null);
  const linkedCreate: CategoryDialog | null =
    params.filters.new === '1' && canCall(categoriesRoutes.create)
      ? { kind: 'create', parentId: null }
      : null;
  const activeDialog = dialog ?? linkedCreate;
  const closeDialog = () => {
    setDialog(null);
    if (params.filters.new) params.setFilter('new', null);
  };
  const tree = useQuery({
    queryKey: catalogKeys.categoryTree(),
    queryFn: ({ signal }) => catalogApi.categoryTree(signal),
    ...cachePolicy.reference,
  });
  const open = (id: string) => params.setFilter('id', id);

  return (
    <>
      <PageHeader
        title="Categories"
        description="The category tree customers browse. Names and structure are your data: rename, move and nest them freely."
        actions={
          canCall(categoriesRoutes.create) ? (
            <Button onClick={() => setDialog({ kind: 'create', parentId: null })}>
              <Plus aria-hidden />
              New category
            </Button>
          ) : undefined
        }
      />
      <nav aria-label="Category views" className="mb-4 flex gap-1 border-b">
        {VIEWS.map((item) => (
          <Link
            key={item.id}
            href={
              item.id === 'tree' ? '/catalog/categories' : `/catalog/categories?view=${item.id}`
            }
            aria-current={view === item.id ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
              view === item.id
                ? 'border-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {view === 'tree' ? (
        <TreeView tree={tree} onOpen={open} onDialog={setDialog} />
      ) : (
        <ListView trash={view === 'trash'} params={params} onOpen={open} />
      )}
      {params.filters.id ? (
        <CategoryEditor
          id={params.filters.id}
          categories={tree.data ?? []}
          onClose={() => params.setFilter('id', null)}
          onDialog={setDialog}
        />
      ) : null}
      {activeDialog ? (
        <CategoryDialogs
          dialog={activeDialog}
          categories={tree.data ?? []}
          onClose={closeDialog}
          onCreated={(category) => open(category.id)}
          onDeleted={() => params.setFilter('id', null)}
        />
      ) : null}
    </>
  );
}

function TreeView({
  tree,
  onOpen,
  onDialog,
}: {
  tree: ReturnType<typeof useQuery<AdminCategoryDto[]>>;
  onOpen(id: string): void;
  onDialog(dialog: CategoryDialog): void;
}) {
  const [term, setTerm] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const roots = useMemo(() => (tree.data ? buildTree(tree.data) : []), [tree.data]);
  const visible = useMemo(() => filterTree(roots, term.trim()), [roots, term]);
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="rounded-lg border bg-card p-3 shadow-card" aria-label="Category tree">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Label htmlFor="category-search" className="sr-only">
          Find a category
        </Label>
        <Input
          id="category-search"
          type="search"
          placeholder="Find a category"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          className="sm:w-72"
        />
        <span className="text-sm text-muted-foreground">
          {tree.data
            ? `${formatCount(tree.data.length, 'category', 'categories')} · ${formatNumber(roots.length)} top level`
            : null}
        </span>
        <div className="flex gap-2 sm:ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded(new Set(tree.data?.map((c) => c.id)))}
          >
            Expand all
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExpanded(new Set())}>
            Collapse all
          </Button>
        </div>
      </div>
      {tree.isPending ? (
        <SectionLoader label="Loading categories…" />
      ) : tree.error ? (
        <ErrorState error={tree.error} onRetry={() => void tree.refetch()} compact />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title={term ? 'No category matches' : 'No categories yet'}
          compact
        />
      ) : (
        <ul aria-label="Categories" className="flex flex-col">
          {visible.map((node, index) => (
            <TreeItem
              key={node.id}
              node={node}
              siblings={visible}
              index={index}
              expanded={expanded}
              toggle={toggle}
              forceOpen={Boolean(term.trim())}
              onOpen={onOpen}
              onDialog={onDialog}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function TreeItem({
  node,
  siblings,
  index,
  expanded,
  toggle,
  forceOpen,
  onOpen,
  onDialog,
}: {
  node: CategoryNode;
  siblings: CategoryNode[];
  index: number;
  expanded: Set<string>;
  toggle(id: string): void;
  forceOpen: boolean;
  onOpen(id: string): void;
  onDialog(dialog: CategoryDialog): void;
}) {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const isOpen = forceOpen || expanded.has(node.id);
  const hasChildren = node.children.length > 0;

  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: catalogKeys.categoryTree() });
  const reorder = useMutation({
    mutationFn: (by: -1 | 1) => {
      const next = [...siblings];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item!);
      return categoriesApi.reorder(
        next.map((category, position) => ({ id: category.id, position })),
      );
    },
    onSuccess: refresh,
    onError: (error) => notifyError(error, 'Could not reorder'),
  });
  const setActive = useMutation({
    mutationFn: () => categoriesApi.bulk([node.id], node.isActive ? 'DEACTIVATE' : 'ACTIVATE'),
    onSuccess: () => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: taxonomyKeys.categories });
      notifySuccess(node.isActive ? `${node.name} deactivated` : `${node.name} activated`);
    },
    onError: (error) => notifyError(error, 'Could not change the category'),
  });
  const can = {
    reorder: canCall(categoriesRoutes.reorder),
    move: canCall(categoriesRoutes.move),
    create: canCall(categoriesRoutes.create),
    toggle: canCall(categoriesRoutes.bulk),
    remove: canCall(categoriesRoutes.remove),
  };

  return (
    <li>
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40">
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => toggle(node.id)}
            aria-expanded={isOpen}
            aria-label={`${node.name}: ${node.children.length} subcategories`}
          >
            <ChevronRight
              aria-hidden
              className={cn('transition-transform', isOpen && 'rotate-90')}
            />
          </Button>
        ) : (
          <span className="size-7 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          onClick={() => onOpen(node.id)}
          className={cn(
            'rounded-sm text-left font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            !node.isActive && 'text-muted-foreground',
          )}
        >
          {node.name}
        </button>
        <span className="hidden font-mono text-xs text-muted-foreground md:inline">
          /{node.path}
        </span>
        <span className="ml-auto flex flex-wrap items-center justify-end gap-1">
          {KIND_LABELS[node.kind] ? <Badge tone="info">{KIND_LABELS[node.kind]}</Badge> : null}
          {node.isActive ? null : <Badge tone="warning">Inactive</Badge>}
          {node.showInMenu ? null : <Badge tone="neutral">Not in menu</Badge>}
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {formatCount(node.productCountCache, 'product')}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${node.name}`}>
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onOpen(node.id)}>Open</DropdownMenuItem>
              {can.create ? (
                <DropdownMenuItem onSelect={() => onDialog({ kind: 'create', parentId: node.id })}>
                  Add subcategory
                </DropdownMenuItem>
              ) : null}
              {can.reorder ? (
                <>
                  <DropdownMenuItem disabled={index === 0} onSelect={() => reorder.mutate(-1)}>
                    <ArrowUp aria-hidden />
                    Move up
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={index === siblings.length - 1}
                    onSelect={() => reorder.mutate(1)}
                  >
                    <ArrowDown aria-hidden />
                    Move down
                  </DropdownMenuItem>
                </>
              ) : null}
              {can.move ? (
                <DropdownMenuItem onSelect={() => onDialog({ kind: 'move', category: node })}>
                  Move to another parent…
                </DropdownMenuItem>
              ) : null}
              {can.toggle ? (
                <DropdownMenuItem onSelect={() => setActive.mutate()}>
                  {node.isActive ? 'Deactivate' : 'Activate'}
                </DropdownMenuItem>
              ) : null}
              {can.remove ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => onDialog({ kind: 'delete', category: node })}
                  >
                    Delete…
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>
      {hasChildren && isOpen ? (
        <ul className="ml-5 border-l pl-2">
          {node.children.map((child, childIndex) => (
            <TreeItem
              key={child.id}
              node={child}
              siblings={node.children}
              index={childIndex}
              expanded={expanded}
              toggle={toggle}
              forceOpen={forceOpen}
              onOpen={onOpen}
              onDialog={onDialog}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function ListView({
  trash,
  params,
  onOpen,
}: {
  trash: boolean;
  params: ReturnType<typeof useListParams<'view' | 'id' | 'isActive'>>;
  onOpen(id: string): void;
}) {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const query = {
    page: params.page,
    limit: params.limit,
    sort: params.sort,
    order: params.order,
    ...(params.q ? { q: params.q } : {}),
    ...(params.filters.isActive ? { isActive: params.filters.isActive === 'true' } : {}),
    ...(trash ? { includeDeleted: true } : {}),
  };
  const list = useQuery({
    queryKey: taxonomyKeys.categoryList(query),
    queryFn: ({ signal }) => categoriesApi.list(query, signal),
    ...cachePolicy.list,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: taxonomyKeys.categories });
    void queryClient.invalidateQueries({ queryKey: catalogKeys.categoryTree() });
  };

  const columns: DataTableColumn<AdminCategoryDto>[] = [
    {
      id: 'name',
      meta: { label: 'Category', sortKey: 'name', pinned: true, mobile: 'title' },
      header: 'Category',
      cell: ({ row }) => (
        <span className="flex flex-col">
          <button
            type="button"
            className="w-fit text-left font-medium hover:underline"
            onClick={() => onOpen(row.original.id)}
          >
            {row.original.name}
          </button>
          <span className="font-mono text-xs text-muted-foreground">/{row.original.path}</span>
        </span>
      ),
    },
    {
      id: 'status',
      meta: { label: 'Status', mobile: 'detail' },
      header: 'Status',
      cell: ({ row }) =>
        row.original.deletedAt ? (
          <Badge tone="danger">Deleted {formatRelative(row.original.deletedAt)}</Badge>
        ) : row.original.isActive ? (
          <Badge tone="success">Active</Badge>
        ) : (
          <Badge tone="warning">Inactive</Badge>
        ),
    },
    {
      id: 'products',
      meta: { label: 'Products', align: 'right', mobile: 'detail' },
      header: 'Products',
      cell: ({ row }) => (
        <span className="tabular">{formatNumber(row.original.productCountCache)}</span>
      ),
    },
    {
      id: 'children',
      meta: { label: 'Subcategories', align: 'right', mobile: 'detail' },
      header: 'Subcategories',
      cell: ({ row }) => <span className="tabular">{formatNumber(row.original.childCount)}</span>,
    },
    {
      id: 'updatedAt',
      meta: { label: 'Updated', sortKey: 'updatedAt', mobile: 'hidden' },
      header: 'Updated',
      cell: ({ row }) => formatRelative(row.original.updatedAt),
    },
    ...(trash && canCall(categoriesRoutes.restore)
      ? [
          {
            id: 'restore',
            meta: { label: 'Restore', align: 'right' as const, mobile: 'detail' as const },
            header: () => <span className="sr-only">Restore</span>,
            cell: ({ row }: { row: { original: AdminCategoryDto } }) =>
              row.original.deletedAt ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await categoriesApi.restore(row.original.id);
                      refresh();
                      notifySuccess(`${row.original.name} restored`);
                    } catch (error) {
                      notifyError(error, 'Could not restore');
                    }
                  }}
                >
                  Restore<span className="sr-only"> {row.original.name}</span>
                </Button>
              ) : null,
          } satisfies DataTableColumn<AdminCategoryDto>,
        ]
      : []),
  ];

  return (
    <DataTable
      label={trash ? 'Categories including deleted' : 'Categories'}
      columns={columns}
      query={list}
      getRowId={(row) => row.id}
      sort={{ field: params.sort, order: params.order, onChange: params.setSort }}
      onPageChange={params.setPage}
      onLimitChange={params.setLimit}
      preferenceKey={trash ? 'categories-trash' : 'categories-list'}
      filtered={Boolean(params.q || params.filters.isActive)}
      bulkActions={
        !trash && canCall(categoriesRoutes.bulk)
          ? (selected, clear) => (
              <div className="flex gap-2">
                {(['ACTIVATE', 'DEACTIVATE'] as const).map((action) => (
                  <Button
                    key={action}
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const result = await categoriesApi.bulk(
                          selected.map((c) => c.id),
                          action,
                        );
                        refresh();
                        clear();
                        notifySuccess(
                          `${result.updated} of ${formatCount(result.requested, 'category', 'categories')} ${action === 'ACTIVATE' ? 'activated' : 'deactivated'}`,
                        );
                      } catch (error) {
                        notifyError(error, 'Could not update the categories');
                      }
                    }}
                  >
                    {action === 'ACTIVATE' ? 'Activate' : 'Deactivate'} {selected.length}
                  </Button>
                ))}
              </div>
            )
          : undefined
      }
      toolbar={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            value={params.q}
            onSearch={params.setSearch}
            label="Search categories"
            minLength={1}
          />
          {trash ? null : (
            <FilterSelect
              label="Status"
              value={params.filters.isActive}
              options={[
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
              onChange={(value) => params.setFilter('isActive', value)}
            />
          )}
        </div>
      }
      empty={
        <EmptyState
          icon={FolderTree}
          title={trash ? 'Nothing was deleted recently' : 'No categories yet'}
          description={trash ? 'Deleted categories appear here and can be restored.' : undefined}
        />
      }
      emptyFiltered={
        <EmptyState
          title="No category matches"
          description="Try a different word, or clear the filters to see the whole tree."
          action={
            <Button variant="outline" onClick={params.clearAll}>
              Clear filters
            </Button>
          }
        />
      }
    />
  );
}
