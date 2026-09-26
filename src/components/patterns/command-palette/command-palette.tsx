'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Clock,
  FolderTree,
  Inbox,
  KeyRound,
  LogOut,
  Package,
  Plus,
  Search,
  UserRound,
  UserPlus,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import type { Permission } from '@shared/enums';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/surface';
import { Spinner } from '@/components/ui/spinner';
import { visibleNavigation } from '@/config/navigation';
import { adminUsersApi } from '@/features/admin-users/api';
import { catalogApi, catalogKeys } from '@/features/catalog/api';
import { enquiriesApi } from '@/features/enquiries/api';
import { useDebouncedValue } from '@/hooks/use-browser';
import { endpoints } from '@/lib/api/endpoints';
import { loginHref } from '@/lib/auth/redirects';
import { useSession } from '@/lib/auth/session';
import { isSafeHref, useRecentItems } from '@/lib/local-history';
import { notifyError } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';
import { cn } from '@/lib/utils';

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  href?: string;
  run?: () => void | Promise<void>;
}

const MIN_SEARCH = 2;
const PER_GROUP = 5;

function includes(text: string | undefined, term: string): boolean {
  return Boolean(text && text.toLowerCase().includes(term));
}

/** Consecutive items of one group, keeping each item's position in the flat keyboard order. */
function groupsOf(items: readonly PaletteItem[]) {
  const groups: { name: string; slug: string; entries: { item: PaletteItem; index: number }[] }[] =
    [];
  items.forEach((item, index) => {
    const last = groups[groups.length - 1];
    if (last && last.name === item.group) last.entries.push({ item, index });
    else
      groups.push({
        name: item.group,
        slug: item.group.toLowerCase().replace(/[^a-z]+/g, '-'),
        entries: [{ item, index }],
      });
  });
  return groups;
}

/** Backend search per area, each only when the admin may read it; requests are cancelled on change. */
function useRemoteResults(term: string) {
  const { canCall } = usePermissions();
  const enabled = term.length >= MIN_SEARCH;
  const list = { page: 1, limit: PER_GROUP, order: 'desc' as const };

  const products = useQuery({
    queryKey: ['palette', 'products', term],
    queryFn: ({ signal }) => catalogApi.products({ ...list, q: term }, signal),
    enabled: enabled && canCall(endpoints.catalog.products),
    ...cachePolicy.list,
    placeholderData: undefined,
  });
  const users = useQuery({
    queryKey: ['palette', 'admin-users', term],
    queryFn: ({ signal }) => adminUsersApi.list({ ...list, search: term }, signal),
    enabled: enabled && canCall(endpoints.users.list),
    ...cachePolicy.list,
    placeholderData: undefined,
  });
  const enquiries = useQuery({
    queryKey: ['palette', 'enquiries', term],
    queryFn: ({ signal }) => enquiriesApi.list({ ...list, q: term }, signal),
    enabled: enabled && canCall(endpoints.enquiries.list),
    ...cachePolicy.list,
    placeholderData: undefined,
  });
  // The tree is shared reference data: one cached request serves every category search.
  const categories = useQuery({
    queryKey: catalogKeys.categoryTree(),
    queryFn: ({ signal }) => catalogApi.categoryTree(signal),
    enabled: enabled && canCall(endpoints.catalog.categoryTree),
    ...cachePolicy.reference,
  });

  const items: PaletteItem[] = [];
  if (enabled) {
    for (const row of products.data?.items ?? []) {
      items.push({
        id: `product:${row.id}`,
        group: 'Products',
        label: row.name,
        hint: row.sku,
        icon: Package,
        href: `/catalog/products?q=${encodeURIComponent(row.sku)}`,
      });
    }
    const needle = term.toLowerCase();
    for (const row of (categories.data ?? [])
      .filter((c) => includes(c.name, needle))
      .slice(0, PER_GROUP)) {
      items.push({
        id: `category:${row.id}`,
        group: 'Categories',
        label: row.name,
        hint: `/${row.path}`,
        icon: FolderTree,
        href: '/catalog/categories',
      });
    }
    for (const row of users.data?.items ?? []) {
      items.push({
        id: `admin:${row.id}`,
        group: 'Admin users',
        label: row.name,
        hint: row.email,
        icon: UserRound,
        href: `/system/users?id=${encodeURIComponent(row.id)}&q=${encodeURIComponent(row.email)}`,
      });
    }
    for (const row of enquiries.data?.items ?? []) {
      items.push({
        id: `enquiry:${row.id}`,
        group: 'Enquiries',
        label: row.name,
        hint: row.city ?? row.formKey,
        icon: Inbox,
        href: `/enquiries?id=${encodeURIComponent(row.id)}`,
      });
    }
  }
  const loading =
    enabled && [products, users, enquiries, categories].some((q) => q.isFetching && q.isPending);
  return { items, loading };
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-command-palette
        className="top-[12vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        {open ? <PaletteBody close={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PaletteBody({ close }: { close(): void }) {
  const router = useRouter();
  const { permissions, signOut } = useSession();
  const { canAll } = usePermissions();
  const { items: recent } = useRecentItems();
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const term = useDebouncedValue(text.trim(), 250);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const remote = useRemoteResults(term);

  const local = useMemo<PaletteItem[]>(() => {
    const needle = text.trim().toLowerCase();
    const pages: PaletteItem[] = visibleNavigation(permissions)
      .flatMap((group) => group.items.map((item) => ({ item, group: group.label })))
      .map(({ item, group }) => ({
        id: `page:${item.id}`,
        group: 'Go to',
        label: item.label,
        hint: group ?? undefined,
        icon: item.icon ?? ArrowRight,
        href: item.href,
      }));
    pages.push({
      id: 'page:account',
      group: 'Go to',
      label: 'My account',
      icon: UserRound,
      href: '/account',
    });

    const actions: PaletteItem[] = [];
    if (canAll(['system.user.read', 'system.user.create'])) {
      actions.push({
        id: 'action:add-admin',
        group: 'Actions',
        label: 'Add an admin',
        icon: UserPlus,
        href: '/system/users?new=1',
      });
    }
    if (canAll(['system.role.create', 'system.role.read'])) {
      actions.push({
        id: 'action:new-role',
        group: 'Actions',
        label: 'Create a role',
        icon: Plus,
        href: '/system/roles?new=1',
      });
    }
    // Catalog shortcuts: each needs exactly what its destination checks, nothing is inferred.
    const catalog: [Permission[], Omit<PaletteItem, 'group'>][] = [
      [
        ['catalog.product.create'],
        {
          id: 'action:new-product',
          label: 'Create a product',
          icon: Plus,
          href: '/catalog/products/new',
        },
      ],
      [
        ['catalog.category.read', 'catalog.category.create'],
        {
          id: 'action:new-category',
          label: 'Create a category',
          icon: FolderTree,
          href: '/catalog/categories?new=1',
        },
      ],
      [
        ['catalog.collection.create'],
        {
          id: 'action:new-collection',
          label: 'Create a collection',
          icon: Plus,
          href: '/catalog/collections/new',
        },
      ],
      [
        ['catalog.product.read'],
        {
          id: 'action:drafts',
          label: 'Open draft products',
          icon: Package,
          href: '/catalog/products?status=DRAFT',
        },
      ],
      [
        ['catalog.product.read'],
        {
          id: 'action:incomplete',
          label: 'Open incomplete products',
          icon: Package,
          href: '/catalog/products?completenessMax=50',
        },
      ],
      [
        ['catalog.product.read'],
        {
          id: 'action:no-images',
          label: 'Open products without images',
          icon: Package,
          href: '/catalog/products?hasMedia=false',
        },
      ],
      [
        ['catalog.inventory.read'],
        {
          id: 'action:low-stock',
          label: 'Open low-stock variants',
          icon: Warehouse,
          href: '/catalog/inventory',
        },
      ],
    ];
    for (const [needs, item] of catalog) {
      if (canAll(needs)) actions.push({ ...item, group: 'Actions' });
    }
    actions.push({
      id: 'action:password',
      group: 'Actions',
      label: 'Change my password',
      icon: KeyRound,
      href: '/account',
    });
    actions.push({
      id: 'action:sign-out',
      group: 'Actions',
      label: 'Sign out',
      icon: LogOut,
      run: async () => {
        try {
          await signOut();
          router.replace(loginHref({ reason: 'signed-out' }));
        } catch (error) {
          notifyError(error, 'Could not sign out');
        }
      },
    });

    if (!needle) {
      const recentItems: PaletteItem[] = recent.slice(0, 6).map((item) => ({
        id: `recent:${item.key}`,
        group: 'Recently viewed',
        label: item.label,
        hint: item.kind,
        icon: Clock,
        href: item.href,
      }));
      return [...recentItems, ...pages.slice(0, 8), ...actions];
    }
    const match = (item: PaletteItem) =>
      includes(item.label, needle) || includes(item.hint, needle);
    return [...pages.filter(match), ...actions.filter(match)];
  }, [text, permissions, canAll, recent, router, signOut]);

  const items = [...local, ...remote.items];
  const current = Math.min(active, Math.max(items.length - 1, 0));

  const choose = async (item: PaletteItem | undefined) => {
    if (!item) return;
    close();
    if (item.run) await item.run();
    else if (item.href && isSafeHref(item.href)) router.push(item.href);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const next = (current + delta + items.length) % Math.max(items.length, 1);
      setActive(next);
      listRef.current
        ?.querySelector(`[data-index="${next}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      void choose(items[current]);
    }
  };

  return (
    <>
      <DialogTitle className="sr-only">Search the admin</DialogTitle>
      <DialogDescription className="sr-only">
        Type to find pages, actions and records. Use the arrow keys to move and Enter to open.
      </DialogDescription>
      <div className="flex items-center gap-2 border-b pr-12 pl-3">
        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <input
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={items[current] ? `${listId}-${current}` : undefined}
          aria-label="Search pages, actions and records"
          autoFocus
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search pages, products, admins, enquiries…"
          className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {remote.loading ? (
          <Spinner aria-label="Searching" className="text-muted-foreground" />
        ) : null}
      </div>
      {items.length === 0 ? (
        <p
          id={listId}
          role="status"
          className="px-3 py-8 text-center text-sm text-muted-foreground"
        >
          {term.length > 0 && term.length < MIN_SEARCH
            ? `Type at least ${MIN_SEARCH} characters to search records.`
            : remote.loading
              ? 'Searching…'
              : 'Nothing found. Try another word.'}
        </p>
      ) : null}
      <ul
        ref={listRef}
        id={items.length === 0 ? undefined : listId}
        role="listbox"
        aria-label="Results"
        hidden={items.length === 0}
        className="max-h-[60vh] overflow-y-auto p-2"
      >
        {items.length === 0
          ? null
          : groupsOf(items).map((group) => (
              <li key={group.name} role="group" aria-labelledby={`${listId}-g-${group.slug}`}>
                <div
                  id={`${listId}-g-${group.slug}`}
                  role="presentation"
                  className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground"
                >
                  {group.name}
                </div>
                {group.entries.map(({ item, index }) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={index === current}
                      data-index={index}
                      onMouseMove={() => setActive(index)}
                      onClick={() => void choose(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void choose(item);
                      }}
                      tabIndex={-1}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm',
                        index === current && 'bg-secondary',
                      )}
                    >
                      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.hint ? (
                        <span className="max-w-[40%] truncate text-xs text-muted-foreground">
                          {item.hint}
                        </span>
                      ) : null}
                      {index === current ? (
                        <ArrowRight aria-hidden className="size-3.5 text-muted-foreground" />
                      ) : null}
                    </div>
                  );
                })}
              </li>
            ))}
      </ul>
      <div className="flex items-center gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
        <span>
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> to move
        </span>
        <span>
          <Kbd>Enter</Kbd> to open
        </span>
        <span>
          <Kbd>Esc</Kbd> to close
        </span>
      </div>
    </>
  );
}
