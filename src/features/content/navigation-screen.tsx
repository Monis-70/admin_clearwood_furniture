'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ListTree, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { PageHeader } from '@/components/patterns/page-header';
import {
  EmptyState,
  ErrorState,
  PermissionNotice,
  SectionLoader,
} from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { endpoints } from '@/lib/api/endpoints';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { contentApi, contentKeys, type MenuItemRow } from './api';
import { ReorderList, RowActions } from './kit';
import { ITEM_TYPE_LABELS, reorderBody } from './model';

const MenuItemDialog = dynamic(
  () => import('./dialogs/menu-item-dialog').then((m) => m.MenuItemDialog),
  { ssr: false },
);

const e = endpoints.content;
const HREF = '/content/navigation';
const MAX_DEPTH = 3;

type Node = MenuItemRow & { children: Node[]; depth: number };

function buildTree(items: readonly MenuItemRow[]): Node[] {
  const byParent = new Map<string | null, MenuItemRow[]>();
  const ids = new Set(items.map((i) => i.id));
  for (const item of items) {
    const key = item.parentId && ids.has(item.parentId) ? item.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), item]);
  }
  const walk = (parent: string | null, depth: number): Node[] =>
    (byParent.get(parent) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((item) => ({ ...item, depth, children: walk(item.id, depth + 1) }));
  return walk(null, 0);
}

const flatten = (nodes: readonly Node[]): Node[] =>
  nodes.flatMap((n) => [n, ...flatten(n.children)]);

export function NavigationScreen() {
  const { canCall } = usePermissions();
  if (!canCall(e.menus))
    return <PermissionNotice area="navigation menus" all={['cms.navigation.read']} />;
  return <Navigation />;
}

function Navigation() {
  const router = useRouter();
  const menuParam = useSearchParams().get('menu');
  const menus = useQuery({
    queryKey: contentKeys.menus(),
    queryFn: ({ signal }) => contentApi.menus(signal),
    ...cachePolicy.list,
  });
  if (menus.isPending) return <SectionLoader label="Loading menus…" />;
  if (menus.error) return <ErrorState error={menus.error} onRetry={() => void menus.refetch()} />;
  const key = menuParam ?? menus.data[0]?.key ?? null;
  return (
    <>
      <PageHeader
        title="Navigation menus"
        description="The storefront header, footer and top-bar links. Changes are live as soon as they are saved."
        actions={
          menus.data.length > 1 ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="menu-key" className="text-xs">
                Menu
              </Label>
              <NativeSelect
                id="menu-key"
                size="sm"
                value={key ?? ''}
                onChange={(ev) =>
                  router.replace(`${HREF}?menu=${encodeURIComponent(ev.target.value)}`, {
                    scroll: false,
                  })
                }
              >
                {menus.data.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null
        }
      />
      {key ? (
        <Menu key={key} menuKey={key} />
      ) : (
        <EmptyState icon={ListTree} title="No menus" description="Menus are created by the seed." />
      )}
    </>
  );
}

function Menu({ menuKey }: { menuKey: string }) {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<{
    row: MenuItemRow | null;
    parentId: string | null;
  } | null>(null);
  const [removing, setRemoving] = useState<Node | null>(null);
  const menu = useQuery({
    queryKey: contentKeys.menu(menuKey),
    queryFn: ({ signal }) => contentApi.menu(menuKey, signal),
    ...cachePolicy.list,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: contentKeys.menu(menuKey) });
  const canAdd = canCall(e.addMenuItem);
  const canEdit = canCall(e.updateMenuItem);

  if (menu.isPending) return <SectionLoader label="Loading menu…" />;
  if (menu.error) return <ErrorState error={menu.error} onRetry={() => void menu.refetch()} />;

  const tree = buildTree(menu.data.items);
  const parents = flatten(tree)
    .filter((n) => n.depth < MAX_DEPTH - 1)
    .map((n) => ({ value: n.id, label: `${'— '.repeat(n.depth)}${n.label}` }));

  const renderLevel = (nodes: Node[], label: string) => (
    <ReorderList
      items={nodes}
      label={label}
      canReorder={canEdit}
      onSave={async (ids) => {
        await contentApi.reorderMenu(menuKey, reorderBody(ids));
        refresh();
      }}
      render={(node) => (
        <div className="flex flex-col gap-2">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{node.label}</span>
            <Badge tone="outline">{ITEM_TYPE_LABELS[node.type] ?? node.type}</Badge>
            {node.url ? (
              <span className="font-mono text-xs text-muted-foreground">{node.url}</span>
            ) : null}
            {node.leadFormKey ? (
              <span className="font-mono text-xs text-muted-foreground">{node.leadFormKey}</span>
            ) : null}
            {node.badgeText ? <Badge tone="info">{node.badgeText}</Badge> : null}
            {node.isActive ? null : <Badge tone="neutral">Hidden</Badge>}
          </span>
          {node.children.length > 0 ? renderLevel(node.children, `Inside ${node.label}`) : null}
        </div>
      )}
      actions={(node) => (
        <RowActions
          label={node.label}
          onEdit={canEdit ? () => setEditing({ row: node, parentId: node.parentId }) : undefined}
          onDelete={canEdit ? () => setRemoving(node) : undefined}
          extra={
            canAdd && node.depth < MAX_DEPTH - 1 ? (
              <DropdownMenuItem onSelect={() => setEditing({ row: null, parentId: node.id })}>
                Add sub-item
              </DropdownMenuItem>
            ) : null
          }
        />
      )}
    />
  );

  return (
    <section aria-label={menu.data.name} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{menu.data.name}</h2>
        {canAdd ? (
          <Button onClick={() => setEditing({ row: null, parentId: null })}>
            <Plus aria-hidden />
            Add item
          </Button>
        ) : null}
      </div>
      {tree.length === 0 ? (
        <EmptyState icon={ListTree} title="This menu is empty" compact />
      ) : (
        renderLevel(tree, `${menu.data.name} items`)
      )}
      {editing ? (
        <MenuItemDialog
          menuKey={menuKey}
          row={editing.row}
          parentId={editing.parentId}
          parents={parents}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            setEditing(null);
          }}
        />
      ) : null}
      {removing ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setRemoving(null))}
          title={`Remove "${removing.label}" from the menu?`}
          description={
            removing.children.length > 0
              ? `It has ${removing.children.length} sub-items: move or remove them first (the server refuses otherwise).`
              : 'The link disappears from the storefront at once.'
          }
          confirmLabel="Remove item"
          level="destructive"
          onConfirm={async () => {
            await contentApi.removeMenuItem(removing.id);
            refresh();
            notifySuccess('Menu item removed');
          }}
        />
      ) : null}
    </section>
  );
}
