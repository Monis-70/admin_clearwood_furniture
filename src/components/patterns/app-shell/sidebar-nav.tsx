'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/overlay';
import { isActive, visibleNavigation } from '@/config/navigation';
import { useSession } from '@/lib/auth/session';
import { cn } from '@/lib/utils';

/** Icons are decoration (every entry has a text label), so they load after the page. */
const NavIcon = dynamic(() => import('@/config/nav-icons').then((m) => m.NavIcon), {
  ssr: false,
  loading: () => <span aria-hidden className="size-4 shrink-0" />,
});

interface SidebarNavProps {
  collapsed?: boolean;
  /** Called after a link is chosen (closes the mobile drawer). */
  onNavigate?: () => void;
}

/** Only entries this admin may open are listed; the API still checks every request. */
export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const { permissions } = useSession();
  const pathname = usePathname() ?? '/';
  const groups = useMemo(() => visibleNavigation(permissions), [permissions]);

  return (
    <nav aria-label="Main" className="flex flex-col gap-5 px-3 py-4">
      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-1">
          {group.label && !collapsed ? (
            <h2 className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-sidebar-muted uppercase">
              {group.label}
            </h2>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(item, pathname);
              const link = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  className={cn(
                    'relative flex h-9 items-center gap-3 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground',
                    active &&
                      'bg-sidebar-accent text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-brand',
                    collapsed && 'justify-center px-0',
                  )}
                >
                  {item.icon ? <NavIcon name={item.icon} className="size-4 shrink-0" /> : null}
                  {collapsed ? null : <span className="truncate">{item.label}</span>}
                </Link>
              );
              return (
                <li key={item.id}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
