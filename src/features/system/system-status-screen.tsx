'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';

import { KeyValueList } from '@/components/patterns/key-value-list';
import { ON_HOLD_COPY } from '@/components/patterns/on-hold-notice';
import { PageHeader } from '@/components/patterns/page-header';
import { StatusBadge, type StatusRegistry } from '@/components/patterns/status-badge';
import { ErrorState } from '@/components/patterns/states';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@/components/ui/surface';
import { formatDateTime, formatDuration } from '@/lib/format/datetime';
import { cachePolicy } from '@/lib/query/policies';

import { systemApi, systemKeys, type DependencyStatus, type ReadinessInfo } from './api';
import { integrationsFrom, type IntegrationState } from './integrations';

const MaintenancePanel = dynamic(
  () => import('./maintenance-panel').then((m) => m.MaintenancePanel),
  {
    ssr: false,
  },
);

const READINESS: StatusRegistry<ReadinessInfo['status']> = {
  ready: { label: 'Ready', tone: 'success', description: 'Database and cache are answering.' },
  degraded: {
    label: 'Degraded',
    tone: 'warning',
    description: 'The cache is down; everything still works from the database, a little slower.',
  },
  unavailable: {
    label: 'Unavailable',
    tone: 'danger',
    description: 'The database is not answering.',
  },
};

const DEPENDENCY: StatusRegistry<DependencyStatus['status']> = {
  up: { label: 'Up', tone: 'success' },
  down: { label: 'Down', tone: 'danger' },
};

const INTEGRATION: StatusRegistry<IntegrationState> = {
  active: { label: 'Active', tone: 'success', description: 'Connected and working on the API.' },
  'on-hold': {
    label: 'On hold',
    tone: 'warning',
    description: 'Deliberately not enabled in this release.',
  },
  infrastructure: {
    label: 'Infrastructure',
    tone: 'neutral',
    description: 'Part of how the API runs.',
  },
};

const ENVIRONMENTS: Record<string, string> = {
  production: 'Production',
  development: 'Development',
  test: 'Test',
};

function LinesSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

export function SystemStatusScreen() {
  const version = useQuery({
    queryKey: systemKeys.version(),
    queryFn: ({ signal }) => systemApi.version(signal),
    ...cachePolicy.config,
  });
  const health = useQuery({
    queryKey: systemKeys.health(),
    queryFn: ({ signal }) => systemApi.health(signal),
    ...cachePolicy.probe,
  });
  const readiness = useQuery({
    queryKey: systemKeys.readiness(),
    queryFn: ({ signal }) => systemApi.readiness(signal),
    ...cachePolicy.probe,
  });

  const refreshing = version.isFetching || health.isFetching || readiness.isFetching;
  const refresh = () => {
    void health.refetch();
    void readiness.refetch();
    void version.refetch();
  };

  const integrations = version.data ? integrationsFrom(version.data.drivers) : [];

  return (
    <>
      <PageHeader
        title="Status & integrations"
        description="Whether the ClearWood API is healthy, and which outside services are switched on. Checked when you open this page."
        actions={
          <Button variant="outline" onClick={refresh} loading={refreshing}>
            {refreshing ? null : <RefreshCw aria-hidden />}
            Check again
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>API health</CardTitle>
            <CardDescription>The server process, the database and the cache.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {health.isPending ? (
              <LinesSkeleton lines={2} />
            ) : health.error ? (
              <ErrorState
                error={health.error}
                onRetry={() => void health.refetch()}
                compact
                title="The API is not responding"
              />
            ) : (
              <KeyValueList
                items={[
                  { label: 'API server', value: <StatusBadge status="up" registry={DEPENDENCY} /> },
                  {
                    label: 'Running for',
                    value: formatDuration(health.data.uptime),
                    hint: `Checked ${formatDateTime(health.data.timestamp)}`,
                  },
                ]}
              />
            )}
            {readiness.isPending ? (
              <LinesSkeleton lines={3} />
            ) : readiness.error ? (
              <ErrorState
                error={readiness.error}
                onRetry={() => void readiness.refetch()}
                compact
                title="Readiness could not be checked"
              />
            ) : (
              <KeyValueList
                items={[
                  {
                    label: 'Overall',
                    value: <StatusBadge status={readiness.data.status} registry={READINESS} />,
                  },
                  {
                    label: 'Database',
                    value: (
                      <StatusBadge
                        status={readiness.data.dependencies.database.status}
                        registry={DEPENDENCY}
                      />
                    ),
                    hint: `${readiness.data.dependencies.database.latencyMs} ms`,
                  },
                  {
                    label: 'Cache',
                    value: (
                      <StatusBadge
                        status={readiness.data.dependencies.cache.status}
                        registry={DEPENDENCY}
                      />
                    ),
                    hint: `${readiness.data.dependencies.cache.latencyMs} ms`,
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Build</CardTitle>
            <CardDescription>Which version of the API this admin is talking to.</CardDescription>
          </CardHeader>
          <CardContent>
            {version.isPending ? (
              <LinesSkeleton lines={3} />
            ) : version.error ? (
              <ErrorState error={version.error} onRetry={() => void version.refetch()} compact />
            ) : (
              <KeyValueList
                items={[
                  { label: 'Application', value: version.data.name },
                  {
                    label: 'API version',
                    value: <span className="font-mono">{version.data.version}</span>,
                  },
                  {
                    label: 'Environment',
                    value: ENVIRONMENTS[version.data.env] ?? version.data.env,
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>
            Outside services as the API reports them. Anything on hold is deliberately switched off
            for this release, and the admin shows no actions for it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {version.isPending ? (
            <LinesSkeleton lines={6} />
          ) : version.error ? (
            <ErrorState error={version.error} onRetry={() => void version.refetch()} compact />
          ) : (
            <ul className="flex flex-col divide-y">
              {integrations.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4"
                >
                  <div className="flex min-w-48 items-center gap-2 font-medium">{row.name}</div>
                  <div className="w-32 shrink-0">
                    <StatusBadge status={row.state} registry={INTEGRATION} />
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-sm">{row.summary}</span>
                    {row.hold ? (
                      <span className="text-sm text-muted-foreground">
                        Still works: {ON_HOLD_COPY[row.hold].stillWorks}
                      </span>
                    ) : null}
                    <span className="font-mono text-xs text-muted-foreground">{row.technical}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <MaintenancePanel />
    </>
  );
}
