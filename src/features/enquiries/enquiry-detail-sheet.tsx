'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { KeyValueList } from '@/components/patterns/key-value-list';
import { ErrorState, SectionLoader } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { Alert } from '@/components/ui/alert';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatDateTime } from '@/lib/format/datetime';
import { useRecentItems } from '@/lib/local-history';
import { cachePolicy } from '@/lib/query/policies';

import { formatRupees } from '../catalog/model';

import { enquiriesApi, enquiryKeys } from './api';
import { ENQUIRY_STATUS, formLabel } from './model';

function EnquiryDetail({ id }: { id: string }) {
  const enquiry = useQuery({
    queryKey: enquiryKeys.detail(id),
    queryFn: ({ signal }) => enquiriesApi.get(id, signal),
    ...cachePolicy.detail,
  });
  const { record } = useRecentItems();
  const recorded = useRef<string | null>(null);
  useEffect(() => {
    if (!enquiry.data || recorded.current === enquiry.data.id) return;
    recorded.current = enquiry.data.id;
    // No customer name here: this label is kept in browser storage.
    record({
      key: `enquiry:${enquiry.data.id}`,
      kind: 'Enquiry',
      label: `${formLabel(enquiry.data.formKey)} enquiry, ${formatDateTime(enquiry.data.createdAt)}`,
      href: `/enquiries?id=${encodeURIComponent(enquiry.data.id)}`,
    });
  }, [enquiry.data, record]);

  if (enquiry.isPending || enquiry.error) {
    return (
      <div className="p-4">
        <SheetTitle className="sr-only">Enquiry</SheetTitle>
        <SheetDescription className="sr-only">Details of one enquiry</SheetDescription>
        {enquiry.isPending ? (
          <SectionLoader label="Loading enquiry…" />
        ) : (
          <ErrorState error={enquiry.error} onRetry={() => void enquiry.refetch()} compact />
        )}
      </div>
    );
  }
  const e = enquiry.data;
  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle className="flex flex-wrap items-center gap-2">
          {e.name}
          <StatusBadge status={e.status} registry={ENQUIRY_STATUS} />
        </SheetTitle>
        <SheetDescription>
          {formLabel(e.formKey)} · received {formatDateTime(e.createdAt)}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 p-4">
        <KeyValueList
          items={[
            {
              label: 'Email',
              value: e.email ? (
                <a className="text-primary hover:underline" href={`mailto:${e.email}`}>
                  {e.email}
                </a>
              ) : (
                '—'
              ),
            },
            {
              label: 'Phone',
              value: e.phone ? (
                <a
                  className="text-primary hover:underline"
                  href={`tel:${e.phone.replace(/\s/g, '')}`}
                >
                  {e.phone}
                </a>
              ) : (
                '—'
              ),
            },
            { label: 'City', value: [e.city, e.pincode].filter(Boolean).join(' · ') || '—' },
            { label: 'Company', value: e.companyName ?? '—' },
            { label: 'About', value: e.productName ?? e.categoryName ?? '—' },
            { label: 'Quantity', value: e.quantity ?? '—' },
            { label: 'Budget', value: e.budgetPaise === null ? '—' : formatRupees(e.budgetPaise) },
            { label: 'Assigned', value: e.assignedToId ? 'Assigned to a colleague' : 'Nobody yet' },
            { label: 'Source', value: e.source },
          ]}
        />
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold">Message</h3>
          <p className="rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap">
            {e.message ?? 'No message.'}
          </p>
        </div>
        {Object.keys(e.details).length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold">Form answers</h3>
            <KeyValueList
              items={Object.entries(e.details).map(([label, value]) => ({
                label,
                value: String(value),
              }))}
            />
          </div>
        ) : null}
        {e.adminNote ? (
          <div className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold">Internal note</h3>
            <p className="text-sm whitespace-pre-wrap">{e.adminNote}</p>
          </div>
        ) : null}
        <Alert tone="info" title="Replying and assigning">
          Changing the status, assigning a colleague and adding notes arrive in the Enquiries phase.
        </Alert>
      </div>
    </>
  );
}

export function EnquiryDetailSheet({ id, onClose }: { id: string; onClose(): void }) {
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <EnquiryDetail id={id} />
      </SheetContent>
    </Sheet>
  );
}
