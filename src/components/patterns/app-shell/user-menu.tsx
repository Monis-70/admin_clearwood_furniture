'use client';

import { Activity, ChevronDown, LogOut, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { loginHref } from '@/lib/auth/redirects';
import { useCurrentAdmin, useSession } from '@/lib/auth/session';
import { notifyError } from '@/lib/notify';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? `${parts[0]![0]}${parts[parts.length - 1]![0]}`
      : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

export function UserMenu() {
  const me = useCurrentAdmin();
  const { signOut } = useSession();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const roleNames = me.user.roles.map((role) => role.name).join(', ') || 'No role';

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace(loginHref({ reason: 'signed-out' }));
    } catch (error) {
      notifyError(error, 'Could not sign out');
      setSigningOut(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2 px-2"
          aria-label={`Account menu for ${me.user.name}`}
        >
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground"
          >
            {initials(me.user.name)}
          </span>
          {/* Only once the sidebar takes over the brand and menu button, or the bar overflows. */}
          <span className="hidden max-w-40 flex-col items-start leading-tight lg:flex">
            <span className="truncate text-sm font-medium">{me.user.name}</span>
            <span className="truncate text-xs text-muted-foreground">{roleNames}</span>
          </span>
          <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5 text-foreground">
          <span className="text-sm font-semibold">{me.user.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {me.user.email}
          </span>
          <span className="text-xs font-normal text-muted-foreground">{roleNames}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserRound aria-hidden />
            My account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/system/status">
            <Activity aria-hidden />
            Status & integrations
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void handleSignOut();
          }}
          disabled={signingOut}
        >
          <LogOut aria-hidden />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
