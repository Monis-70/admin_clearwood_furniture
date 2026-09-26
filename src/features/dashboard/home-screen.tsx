'use client';

import { ArrowRight, Construction } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo } from 'react';

import type { Permission } from '@shared/enums';

import { PageHeader } from '@/components/patterns/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/surface';
import { IS_PRODUCTION_ENV } from '@/config/env';
import { NAVIGATION, isBuilt, visibleNavigation } from '@/config/navigation';
import { useCurrentAdmin, useSession } from '@/lib/auth/session';
import { greetingFor } from '@/lib/format/datetime';
import { PERMISSION_GROUP_LABELS, PERMISSION_LABELS } from '@/lib/permissions/labels';
import { satisfies } from '@/lib/permissions/requirements';

import { WorkQueues } from './work-queues';

const NavIcon = dynamic(() => import('@/config/nav-icons').then((m) => m.NavIcon), {
  ssr: false,
});

/**
 * The dashboard: facts the session already carries, plus work queues read from real API lists
 * (each loads only when scrolled into view and only for admins allowed to open its list).
 */
export function HomeScreen() {
  const me = useCurrentAdmin();
  const { permissions } = useSession();
  const firstName = me.user.name.split(/\s+/)[0] ?? me.user.name;

  const areas = useMemo(
    () =>
      visibleNavigation(permissions)
        .flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })))
        .filter((item) => item.id !== 'dashboard'),
    [permissions],
  );

  const coverage = useMemo(() => {
    const totals = new Map<string, { held: number; total: number }>();
    for (const code of Object.keys(PERMISSION_LABELS) as Permission[]) {
      const group = code.split('.')[0] ?? 'other';
      const entry = totals.get(group) ?? { held: 0, total: 0 };
      entry.total += 1;
      if (permissions.has(code)) entry.held += 1;
      totals.set(group, entry);
    }
    return [...totals.entries()].filter(([, value]) => value.held > 0);
  }, [permissions]);

  const upcoming = useMemo(
    () =>
      NAVIGATION.flatMap((group) => group.items)
        .filter((item) => !isBuilt(item) && satisfies(item.requires, permissions))
        .sort((a, b) => a.phase - b.phase),
    [permissions],
  );

  return (
    <>
      <PageHeader
        title={`${greetingFor()}, ${firstName}`}
        description="The ClearWood admin: manage what customers see and buy, within what your role allows."
      />

      <WorkQueues />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Open an area</CardTitle>
            <CardDescription>Areas of the admin you can use now.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 sm:grid-cols-2">
              {areas.map((item) => {
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="group flex h-full items-start gap-3 rounded-md border p-4 transition-colors hover:border-input hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                        {item.icon ? <NavIcon name={item.icon} className="size-4" /> : null}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-center gap-1 font-medium">
                          {item.label}
                          <ArrowRight
                            aria-hidden
                            className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                          />
                        </span>
                        <span className="text-sm text-muted-foreground">{item.description}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your access</CardTitle>
            <CardDescription>
              What your role allows. Permissions are set by a Super Admin and checked by the server
              on every action.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-1.5">
              {me.user.roles.length > 0 ? (
                me.user.roles.map((role) => (
                  <Badge key={role.id} tone="info">
                    {role.name}
                  </Badge>
                ))
              ) : (
                <Badge tone="warning">No role assigned</Badge>
              )}
            </div>
            <dl className="flex flex-col divide-y rounded-md border text-sm">
              {coverage.map(([group, value]) => (
                <div key={group} className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt>{PERMISSION_GROUP_LABELS[group] ?? group}</dt>
                  <dd className="tabular text-muted-foreground">
                    {value.held === value.total
                      ? 'Full access'
                      : `${value.held} of ${value.total} permissions`}
                  </dd>
                </div>
              ))}
              {coverage.length === 0 ? (
                <div className="px-3 py-2 text-muted-foreground">
                  Your role has no permissions yet.
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>
      </div>

      {!IS_PRODUCTION_ENV && upcoming.length > 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Construction aria-hidden className="size-4 text-warning" />
              Being built
            </CardTitle>
            <CardDescription>
              Shown outside production only: areas your role will be able to open once their phase
              is delivered.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {upcoming.map((item) => (
                <li key={item.id}>
                  <Badge tone="outline">
                    {item.label}
                    <span className="text-muted-foreground">· phase {item.phase}</span>
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
