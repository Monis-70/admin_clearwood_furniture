'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, MonitorSmartphone } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { SessionDto } from '@shared/types/auth';

import { KeyValueList } from '@/components/patterns/key-value-list';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { PageHeader } from '@/components/patterns/page-header';
import { ErrorState, SectionLoader } from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@/components/ui/surface';
import { loginHref } from '@/lib/auth/redirects';
import { useCurrentAdmin, useSession } from '@/lib/auth/session';
import { formatDateTime, formatRelative } from '@/lib/format/datetime';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cachePolicy } from '@/lib/query/policies';

import { accountApi, accountKeys } from './api';

/** A readable device name from the browser's user agent (no fingerprinting, display only). */
export function describeDevice(session: Pick<SessionDto, 'deviceLabel' | 'userAgent'>): string {
  if (session.deviceLabel) return session.deviceLabel;
  const ua = session.userAgent ?? '';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'A browser';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : null;
  return os ? `${browser} on ${os}` : browser;
}

// The password form (Zod + React Hook Form) loads right after the page, not with it.
const PasswordCard = dynamic(() => import('./password-card').then((m) => m.PasswordCard), {
  ssr: false,
  loading: () => (
    <Card>
      <CardHeader>
        <CardTitle>Change your password</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-9 w-full max-w-md" />
        <Skeleton className="h-9 w-full max-w-md" />
        <Skeleton className="h-9 w-full max-w-md" />
      </CardContent>
    </Card>
  ),
});

function SessionsCard() {
  const { signOut } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [ending, setEnding] = useState<SessionDto | null>(null);
  const [everywhere, setEverywhere] = useState(false);
  const sessions = useQuery({
    queryKey: accountKeys.sessions(),
    queryFn: ({ signal }) => accountApi.sessions(signal),
    ...cachePolicy.detail,
  });
  const end = useMutation({ mutationFn: accountApi.endSession });

  const leave = async () => {
    try {
      await signOut();
    } catch (error) {
      notifyError(error, 'Could not finish signing out');
    }
    router.replace(loginHref({ reason: 'signed-out' }));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Where you are signed in</CardTitle>
          <CardDescription>
            End a session you don&apos;t recognise. Each session ends on its own at the time shown
            if it is not used again.
          </CardDescription>
        </div>
        <Button variant="outline" onClick={() => setEverywhere(true)}>
          <LogOut aria-hidden />
          Sign out everywhere
        </Button>
      </CardHeader>
      <CardContent>
        {sessions.isPending ? (
          <SectionLoader label="Loading sessions…" />
        ) : sessions.error ? (
          <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} compact />
        ) : (
          <ul className="flex flex-col divide-y rounded-md border">
            {sessions.data.map((session) => (
              <li
                key={session.id}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <MonitorSmartphone
                    aria-hidden
                    className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                  />
                  <div className="flex flex-col gap-0.5 text-sm">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {describeDevice(session)}
                      {session.isCurrent ? <Badge tone="success">This device</Badge> : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {session.ip ?? 'Unknown address'} · signed in{' '}
                      {formatRelative(session.createdAt)}
                      {session.lastUsedAt
                        ? ` · last used ${formatRelative(session.lastUsedAt)}`
                        : ''}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Ends {formatDateTime(session.expiresAt)} unless used again
                    </span>
                  </div>
                </div>
                {session.isCurrent ? (
                  <Button variant="ghost" size="sm" onClick={() => void leave()}>
                    Sign out
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setEnding(session)}>
                    End session
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {ending ? (
        <LazyConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setEnding(null))}
          title="End this session?"
          description={
            <p>
              {describeDevice(ending)} is signed out at its next click and has to sign in again.
            </p>
          }
          confirmLabel="End session"
          level="destructive"
          onConfirm={async () => {
            await end.mutateAsync(ending.id);
            await queryClient.invalidateQueries({ queryKey: accountKeys.sessions() });
            notifySuccess('Session ended');
          }}
        />
      ) : null}
      {everywhere ? (
        <LazyConfirmDialog
          open
          onOpenChange={setEverywhere}
          title="Sign out everywhere?"
          description={
            <p>
              Every session ends, including this one. You will need to sign in again on each device.
            </p>
          }
          confirmLabel="Sign out everywhere"
          level="destructive"
          onConfirm={async () => {
            await accountApi.signOutEverywhere();
            await leave();
          }}
        />
      ) : null}
    </Card>
  );
}

export function AccountScreen() {
  const me = useCurrentAdmin();
  return (
    <>
      <PageHeader
        title="My account"
        description="Your profile, your password and the devices you are signed in on."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Ask a Super Admin to change your name, email or roles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <KeyValueList
              items={[
                { label: 'Name', value: me.user.name },
                { label: 'Email', value: me.user.email },
                { label: 'Mobile', value: me.user.phone ?? '—' },
                {
                  label: 'Roles',
                  value: (
                    <span className="flex flex-wrap gap-1">
                      {me.user.roles.map((role) => (
                        <Badge key={role.id} tone="info">
                          {role.name}
                        </Badge>
                      ))}
                    </span>
                  ),
                },
                { label: 'Permissions', value: `${me.permissions.length}` },
                {
                  label: 'Last sign-in',
                  value: me.user.lastLoginAt ? formatDateTime(me.user.lastLoginAt) : '—',
                },
              ]}
            />
          </CardContent>
        </Card>
        <PasswordCard />
      </div>
      <div className="mt-6">
        <SessionsCard />
      </div>
    </>
  );
}
