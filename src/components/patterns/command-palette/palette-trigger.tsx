'use client';

import { Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/surface';
import { NAVIGATION, isActive } from '@/config/navigation';
import { useRecentItems } from '@/lib/local-history';

// The palette and its searches load on first use, so pages that never open it don't pay for it.
const CommandPalette = dynamic(() => import('./command-palette').then((m) => m.CommandPalette), {
  ssr: false,
});

const noSubscription = () => () => undefined;
const isApple = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Remembers the last pages opened from the navigation, for "Recently viewed". */
function useRecordDestinations() {
  const pathname = usePathname();
  const { record } = useRecentItems();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    const item = NAVIGATION.flatMap((group) => group.items).find(
      (entry) => entry.href !== '/' && isActive(entry, pathname),
    );
    if (item)
      record({ key: `page:${item.href}`, kind: 'Page', label: item.label, href: item.href });
  }, [pathname, record]);
}

export function PaletteTrigger() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const apple = useSyncExternalStore(noSubscription, isApple, () => false);
  useRecordDestinations();

  useEffect(() => {
    const otherDialogOpen = () =>
      document.querySelector(
        '[role="dialog"][data-state="open"]:not([data-command-palette]), [role="alertdialog"][data-state="open"]',
      ) !== null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        clearTimeout(retry);
        if (otherDialogOpen()) {
          // Another dialog owns focus and the screen; the palette would open underneath it. One
          // that is just closing (Escape, then Ctrl+K) gets a moment to go first.
          retry = setTimeout(() => {
            if (otherDialogOpen()) return;
            setLoaded(true);
            setOpen(true);
          }, 250);
          return;
        }
        setLoaded(true);
        setOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(retry);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const shortcut = apple ? '⌘K' : 'Ctrl K';
  return (
    <>
      <Button
        variant="outline"
        className="h-9 w-9 justify-center gap-2 px-0 text-muted-foreground sm:w-64 sm:justify-start sm:px-3"
        onClick={() => {
          setLoaded(true);
          setOpen(true);
        }}
        aria-label={`Search the admin (${shortcut})`}
        aria-keyshortcuts={apple ? 'Meta+K' : 'Control+K'}
      >
        <Search aria-hidden />
        <span className="hidden flex-1 text-left sm:inline">Search or jump to…</span>
        <Kbd className="hidden sm:inline-flex">{shortcut}</Kbd>
      </Button>
      {loaded ? <CommandPalette open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
