'use client';

import { Bookmark, BookmarkPlus, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSavedFilters } from '@/lib/local-history';
import { notifySuccess } from '@/lib/notify';

const SaveFilterDialog = dynamic(
  () => import('./save-filter-dialog').then((m) => m.SaveFilterDialog),
  { ssr: false },
);

/** The list's current filters as a query string, without paging. */
function currentFilterQuery(params: URLSearchParams): string {
  const next = new URLSearchParams(params.toString());
  next.delete('page');
  next.delete('id');
  next.sort();
  return next.toString();
}

/**
 * Named filter sets for one list, remembered on this device for the signed-in admin. Applying one
 * only changes the URL; the list then asks the API for exactly that filter.
 */
export function SavedFiltersMenu({ listId }: { listId: string }) {
  const { filters, save, remove, max } = useSavedFilters(listId);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [naming, setNaming] = useState(false);
  const query = currentFilterQuery(new URLSearchParams(params.toString()));
  const active = filters.find((filter) => filter.query === query);

  const apply = (value: string) => router.replace(value ? `${pathname}?${value}` : pathname);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Bookmark aria-hidden />
            <span className="max-w-32 truncate">
              {active ? (
                <>
                  <span className="sr-only">Saved filter: </span>
                  {active.name}
                </>
              ) : (
                'Saved filters'
              )}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Saved on this device</DropdownMenuLabel>
          {filters.length === 0 ? (
            <p className="px-2 pb-2 text-xs text-muted-foreground">
              Filter the list, then save it here to come back to it in one click.
            </p>
          ) : (
            filters.map((filter) => (
              <div key={filter.id} className="flex items-center gap-1">
                <DropdownMenuItem className="min-w-0 flex-1" onSelect={() => apply(filter.query)}>
                  <span className="truncate">{filter.name}</span>
                </DropdownMenuItem>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete saved filter ${filter.name}`}
                  onClick={() => remove(filter.id)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!query || Boolean(active)} onSelect={() => setNaming(true)}>
            <BookmarkPlus aria-hidden />
            {active ? 'These filters are saved' : 'Save current filters…'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {naming ? (
        <SaveFilterDialog
          open
          onOpenChange={setNaming}
          max={max}
          onSave={(name) => {
            save(name, query);
            setNaming(false);
            notifySuccess('Filters saved');
          }}
        />
      ) : null}
    </>
  );
}
