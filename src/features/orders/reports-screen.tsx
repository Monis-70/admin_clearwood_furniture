'use client';

import { useMutation } from '@tanstack/react-query';
import { FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';

import type { Permission } from '@shared/enums';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { PageHeader } from '@/components/patterns/page-header';
import { PermissionNotice } from '@/components/patterns/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/surface';
import { ordersRoutes } from '@/lib/api/routes/orders';
import { formatNumber } from '@/lib/format/datetime';
import { useSession } from '@/lib/auth/session';
import { usePermissions } from '@/lib/permissions/use-permissions';

import { formatRupees } from '../catalog/model';

import { ordersApi, saveDownload } from './api';

/** Report kinds and the permission the API checks for each (report.routes REPORT_PERMISSIONS). */
const REPORTS: { kind: string; label: string; description: string; permission: Permission }[] = [
  {
    kind: 'SALES_SUMMARY',
    label: 'Sales summary',
    description: 'Orders, revenue, discounts and delivery charges by day.',
    permission: 'order.order.export',
  },
  {
    kind: 'GST_HSN_SUMMARY',
    label: 'GST by HSN code',
    description: 'Taxable value and CGST/SGST/IGST per HSN code, for returns.',
    permission: 'order.order.export',
  },
  {
    kind: 'TOP_PRODUCTS',
    label: 'Top products',
    description: 'Best sellers by units and revenue.',
    permission: 'order.order.export',
  },
  {
    kind: 'INVENTORY_MOVEMENT',
    label: 'Inventory movement',
    description: 'Stock received, sold, adjusted and reserved.',
    permission: 'catalog.inventory.read',
  },
  {
    kind: 'REFUND_SUMMARY',
    label: 'Refunds',
    description: 'Refund requests and amounts (refunds are on hold, so usually empty).',
    permission: 'order.refund.read',
  },
  {
    kind: 'SPLIT_PAYOUT',
    label: 'Payout split',
    description: 'Online payment payouts (payments are on hold, so usually empty).',
    permission: 'payment.split.read',
  },
];

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

export function ReportsScreen() {
  const { canCall } = usePermissions();
  const { permissions } = useSession();
  const available = REPORTS.filter((r) => permissions.has(r.permission));
  const [kind, setKind] = useState(available[0]?.kind ?? '');
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [problem, setProblem] = useState<string | null>(null);
  const range = () => {
    setProblem(null);
    if (!from || !to) return (setProblem('Choose both dates.'), null);
    if (from > to) return (setProblem('"From" must not be after "To".'), null);
    if (Date.parse(to) - Date.parse(from) > 366 * 86_400_000)
      return (setProblem('A report can cover at most 366 days.'), null);
    return {
      kind,
      from: new Date(`${from}T00:00:00`).toISOString(),
      to: new Date(`${to}T23:59:59`).toISOString(),
    };
  };
  const csv = useMutation({
    mutationFn: async (query: { kind: string; from: string; to: string }) =>
      saveDownload(ordersApi.reportCsv(query), `${query.kind}_${from}_${to}.csv`),
  });
  const totals = useMutation({ mutationFn: ordersApi.reportTotals });

  if (!canCall(ordersRoutes.report) || available.length === 0)
    return (
      <PermissionNotice area="reports" any={['order.order.export', 'catalog.inventory.read']} />
    );
  const chosen = REPORTS.find((r) => r.kind === kind);

  return (
    <>
      <PageHeader
        title="Reports"
        description="Download sales, GST and stock figures as CSV for a period of up to a year."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet aria-hidden className="size-4" />
            Choose a report
          </CardTitle>
          <CardDescription>{chosen?.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FormAlert error={csv.error ?? totals.error} messages={problem ? [problem] : []} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="report-kind">Report</Label>
              <NativeSelect
                id="report-kind"
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  totals.reset();
                }}
              >
                {available.map((r) => (
                  <option key={r.kind} value={r.kind}>
                    {r.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="report-from">From</Label>
              <Input
                id="report-from"
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="report-to">To</Label>
              <Input
                id="report-to"
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={csv.isPending}
              onClick={() => {
                const q = range();
                if (q) csv.mutate(q);
              }}
            >
              Download CSV
            </Button>
            <Button
              variant="outline"
              loading={totals.isPending}
              onClick={() => {
                const q = range();
                if (q) totals.mutate(q);
              }}
            >
              Show totals
            </Button>
          </div>
          {totals.data ? (
            <dl
              className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[14rem_1fr]"
              aria-label="Report totals"
            >
              <dt className="text-muted-foreground">Rows</dt>
              <dd className="tabular">{formatNumber(totals.data.rowCount)}</dd>
              {Object.entries(totals.data.totals).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="tabular">
                    {/Paise$/.test(k) ? formatRupees(v) : formatNumber(v)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
