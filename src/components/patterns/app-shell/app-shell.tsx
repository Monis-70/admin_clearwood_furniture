'use client';

import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { OfflineBanner } from '@/components/patterns/offline-banner';
import { PaletteTrigger } from '@/components/patterns/command-palette/palette-trigger';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { APP_ENV, IS_PRODUCTION_ENV } from '@/config/env';
import { isBoolean, usePreference } from '@/lib/preferences';
import { cn } from '@/lib/utils';

import { BrandMark } from './brand';
import { SidebarNav } from './sidebar-nav';
import { UserMenu } from './user-menu';

const MobileNav = dynamic(() => import('./mobile-nav').then((m) => m.MobileNav), { ssr: false });
// Invisible until a session is about to end, so it never competes with the page for bandwidth.
const SessionExpiryNotice = dynamic(
  () => import('./session-expiry').then((m) => m.SessionExpiryNotice),
  { ssr: false },
);

function EnvironmentBadge() {
  if (IS_PRODUCTION_ENV) return null;
  return (
    <Badge tone="warning" className="uppercase" title="This is not the production admin">
      {/* Abbreviated on the narrowest phones: at full length it pushes the top bar off-screen. */}
      <span aria-hidden className="sm:hidden">
        {APP_ENV.slice(0, 3)}
      </span>
      <span className="hidden sm:inline">{APP_ENV}</span>
      <span className="sr-only sm:hidden">{APP_ENV}</span>
    </Badge>
  );
}

/**
 * Desktop: sidebar (240 px, collapsible to 64 px) + top bar + content. Below 1024 px the sidebar
 * becomes a drawer. The content column caps at 1440 px so tables stay readable on wide screens.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = usePreference('sidebar-collapsed', false, isBoolean);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerUsed, setDrawerUsed] = useState(false);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-card px-3 py-2 text-sm font-medium shadow-overlay focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>

      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div
          className={cn(
            'flex h-14 items-center border-b border-sidebar-border px-4',
            collapsed && 'justify-center px-0',
          )}
        >
          <Link
            href="/"
            className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <BrandMark collapsed={collapsed} />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav collapsed={collapsed} />
        </div>
        <div
          className={cn('border-t border-sidebar-border p-3', collapsed && 'flex justify-center')}
        >
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'sm'}
            className={cn('text-muted-foreground', !collapsed && 'w-full justify-start')}
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
            {collapsed ? null : 'Collapse'}
          </Button>
        </div>
      </aside>

      {drawerUsed ? <MobileNav open={drawerOpen} onOpenChange={setDrawerOpen} /> : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <SessionExpiryNotice />
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => {
              setDrawerUsed(true);
              setDrawerOpen(true);
            }}
            aria-label="Open navigation"
          >
            <Menu aria-hidden />
          </Button>
          <Link href="/" className="lg:hidden" aria-label="ClearWood Admin home">
            <BrandMark collapsed className="sm:hidden" />
            <BrandMark className="hidden sm:flex" />
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <PaletteTrigger />
            <EnvironmentBadge />
            <UserMenu />
          </div>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
