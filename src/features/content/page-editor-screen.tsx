'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarClock, Eye, EyeOff, LayoutTemplate, Plus, Send } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import type { BlockType } from '@shared/enums';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { PageHeader } from '@/components/patterns/page-header';
import {
  EmptyState,
  ErrorState,
  PermissionNotice,
  SectionLoader,
} from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { endpoints } from '@/lib/api/endpoints';
import { formatDateTime } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';
import { cn } from '@/lib/utils';

import {
  contentApi,
  contentKeys,
  type BlockTypeInfo,
  type CmsPage,
  type PageBlock,
  type PublishBlocker,
} from './api';
import { dateTimeLocal, fromDateTimeLocal } from './dialogs/datetime';
import { ReorderList, RowActions } from './kit';
import {
  DEVICE_LABELS,
  PAGE_STATUS,
  PAGE_TYPE_LABELS,
  blockerText,
  publishBlockers,
  reorderBody,
  windowLabel,
} from './model';

const BlockDialog = dynamic(() => import('./dialogs/block-dialog').then((m) => m.BlockDialog), {
  ssr: false,
});
const PageSettingsForm = dynamic(
  () => import('./dialogs/page-settings-form').then((m) => m.PageSettingsForm),
  { ssr: false, loading: () => <SectionLoader label="Loading settings…" /> },
);
const PageHistory = dynamic(() => import('./page-extra-tabs').then((m) => m.PageHistory), {
  ssr: false,
});
const PagePreview = dynamic(() => import('./page-extra-tabs').then((m) => m.PagePreview), {
  ssr: false,
});
const PageSeo = dynamic(() => import('./page-extra-tabs').then((m) => m.PageSeo), { ssr: false });

const e = endpoints.content;
const TABS = [
  { id: 'blocks', label: 'Blocks' },
  { id: 'settings', label: 'Settings & SEO' },
  { id: 'seo', label: 'Search preview' },
  { id: 'preview', label: 'Preview' },
  { id: 'history', label: 'History' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function PageEditorScreen() {
  const { canCall } = usePermissions();
  const id = useSearchParams().get('id');
  if (!canCall(e.page)) return <PermissionNotice area="pages" all={['cms.page.read']} />;
  if (!id)
    return (
      <EmptyState
        icon={LayoutTemplate}
        title="No page chosen"
        action={
          <Button asChild variant="outline">
            <Link href="/content/pages">Back to pages</Link>
          </Button>
        }
      />
    );
  return <PageEditor id={id} />;
}

function PageEditor({ id }: { id: string }) {
  const { canCall } = usePermissions();
  const router = useRouter();
  const search = useSearchParams();
  const queryClient = useQueryClient();
  const tab = (TABS.find((t) => t.id === search.get('tab'))?.id ?? 'blocks') as Tab;
  const [blockers, setBlockers] = useState<PublishBlocker[] | null>(null);
  const [confirming, setConfirming] = useState<'publish' | 'unpublish' | 'delete' | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const page = useQuery({
    queryKey: contentKeys.page(id),
    queryFn: ({ signal }) => contentApi.page(id, signal),
    ...cachePolicy.detail,
  });
  const setPage = (next: CmsPage) => {
    queryClient.setQueryData(contentKeys.page(id), next);
    void queryClient.invalidateQueries({ queryKey: [...contentKeys.all, 'pages'] });
    void queryClient.invalidateQueries({ queryKey: contentKeys.revisions(id) });
  };
  const goTo = (next: Tab) =>
    router.replace(
      `/content/pages/edit?id=${encodeURIComponent(id)}${next === 'blocks' ? '' : `&tab=${next}`}`,
      {
        scroll: false,
      },
    );

  if (page.isPending) return <SectionLoader label="Loading page…" />;
  if (page.error) return <ErrorState error={page.error} onRetry={() => void page.refetch()} />;
  const p = page.data;
  const canUpdate = canCall(e.updatePage);
  const live = p.status === 'PUBLISHED' || p.status === 'SCHEDULED';

  return (
    <>
      <Link
        href="/content/pages"
        className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Pages
      </Link>
      <PageHeader
        title={p.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">/{p.slug}</span>
            <StatusBadge status={p.status} registry={PAGE_STATUS} />
            <span>{PAGE_TYPE_LABELS[p.type] ?? p.type}</span>
            {p.isSystem ? <Badge tone="neutral">System</Badge> : null}
            {p.status === 'SCHEDULED' && p.scheduledAt ? (
              <span>
                Publishes {formatDateTime(p.scheduledAt)}
                {p.expiresAt ? `, until ${formatDateTime(p.expiresAt)}` : ''}
              </span>
            ) : null}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canCall(e.publishPage) && p.status !== 'PUBLISHED' ? (
              <Button onClick={() => setConfirming('publish')}>
                <Send aria-hidden />
                Publish
              </Button>
            ) : null}
            {canCall(e.schedulePage) ? (
              <Button variant="outline" onClick={() => setScheduling(true)}>
                <CalendarClock aria-hidden />
                Schedule
              </Button>
            ) : null}
            {canCall(e.unpublishPage) && live ? (
              <Button variant="outline" onClick={() => setConfirming('unpublish')}>
                <EyeOff aria-hidden />
                Unpublish
              </Button>
            ) : null}
            {canCall(e.removePage) && !p.isSystem ? (
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() => setConfirming('delete')}
              >
                Delete
              </Button>
            ) : null}
          </div>
        }
      />
      {blockers ? (
        <Alert tone="danger" title="The page cannot be published yet" className="mb-4">
          <ul className="list-disc pl-5">
            {blockers.map((b, i) => {
              const block = p.blocks.find((x) => x.id === b.blockId);
              return (
                <li key={i}>
                  {block
                    ? `${blockLabel(block.type)} (block ${p.blocks.indexOf(block) + 1}): `
                    : ''}
                  {blockerText(b)}
                  {b.detail ? ` ${b.detail}` : ''}
                </li>
              );
            })}
          </ul>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setBlockers(null)}>
            Dismiss
          </Button>
        </Alert>
      ) : null}
      <div role="tablist" aria-label="Page editor" className="mb-4 flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm',
              tab === t.id
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            onClick={() => goTo(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>
        {tab === 'blocks' ? <Blocks page={p} onPage={setPage} /> : null}
        {tab === 'settings' ? (
          <PageSettingsForm page={p} readOnly={!canUpdate} onSaved={setPage} />
        ) : null}
        {tab === 'seo' ? <PageSeo page={p} /> : null}
        {tab === 'preview' ? <PagePreview page={p} /> : null}
        {tab === 'history' ? <PageHistory page={p} onRestored={setPage} /> : null}
      </div>
      {confirming === 'publish' ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setConfirming(null))}
          title={`Publish "${p.title}"?`}
          description={`/${p.slug} goes live on the storefront now. The server checks every block first.`}
          confirmLabel="Publish now"
          onConfirm={async () => {
            setBlockers(null);
            try {
              setPage(await contentApi.publishPage(p.id));
              notifySuccess('Page published');
            } catch (error) {
              const found = publishBlockers(error);
              if (!found) throw error;
              setBlockers(found);
            }
          }}
        />
      ) : null}
      {confirming === 'unpublish' ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setConfirming(null))}
          title={`Unpublish "${p.title}"?`}
          description={`/${p.slug} stops working for customers at once and the page returns to draft. Menu links to it will break.`}
          confirmLabel="Unpublish"
          level="destructive"
          onConfirm={async () => {
            setPage(await contentApi.unpublishPage(p.id));
            notifySuccess('Page unpublished');
          }}
        />
      ) : null}
      {confirming === 'delete' ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setConfirming(null))}
          title={`Delete "${p.title}"?`}
          description={`/${p.slug} stops working on the storefront. Menu links to it will break.`}
          confirmLabel="Delete page"
          level="destructive"
          onConfirm={async () => {
            await contentApi.removePage(p.id);
            void queryClient.invalidateQueries({ queryKey: [...contentKeys.all, 'pages'] });
            notifySuccess('Page deleted');
            router.replace('/content/pages');
          }}
        />
      ) : null}
      {scheduling ? (
        <ScheduleDialog
          page={p}
          onClose={() => setScheduling(false)}
          onScheduled={(next) => {
            setPage(next);
            setScheduling(false);
          }}
          onBlocked={(found) => {
            setBlockers(found);
            setScheduling(false);
          }}
        />
      ) : null}
    </>
  );
}

function blockLabel(type: string, types?: readonly BlockTypeInfo[]) {
  return types?.find((t) => t.type === type)?.label ?? type.replace(/_/g, ' ').toLowerCase();
}

/** A short line describing what a block shows, from its stored settings. */
function summary(block: PageBlock): string {
  const c = block.config;
  const text = [c.title, c.headline, c.label].find((v) => typeof v === 'string' && v.trim());
  const lists = Object.entries(c)
    .filter(([, v]) => Array.isArray(v) && v.length > 0)
    .map(
      ([k, v]) =>
        `${(v as unknown[]).length} ${k
          .replace(/Ids$/, 's')
          .replace(/([A-Z])/g, ' $1')
          .toLowerCase()}`,
    );
  return [text as string | undefined, ...lists].filter(Boolean).join(' · ');
}

function Blocks({ page, onPage }: { page: CmsPage; onPage(page: CmsPage): void }) {
  const { canCall } = usePermissions();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ block: PageBlock | null; type: BlockType } | null>(null);
  const [removing, setRemoving] = useState<PageBlock | null>(null);
  const queryClient = useQueryClient();
  const types = useQuery({
    queryKey: contentKeys.blockTypes(),
    queryFn: ({ signal }) => contentApi.blockTypes(signal),
    ...cachePolicy.reference,
  });
  const canEdit = canCall(e.updateBlock);
  const blocks = [...page.blocks].sort((a, b) => a.position - b.position);

  return (
    <section aria-label="Blocks" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          The page shows these blocks from top to bottom. Changes to a published page are live when
          saved.
        </p>
        {canCall(e.addBlock) ? (
          <Button onClick={() => setAdding(true)} disabled={!types.data}>
            <Plus aria-hidden />
            Add block
          </Button>
        ) : null}
      </div>
      <ReorderList
        items={blocks}
        label="Page blocks"
        canReorder={canCall(e.reorderBlocks)}
        onSave={async (ids) => {
          await contentApi.reorderBlocks(page.id, reorderBody(ids));
          await queryClient.invalidateQueries({ queryKey: contentKeys.page(page.id) });
        }}
        render={(block) => (
          <div className="flex flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{blockLabel(block.type, types.data)}</span>
              {block.isActive ? null : <Badge tone="neutral">Hidden</Badge>}
              {block.deviceVisibility !== 'ALL' ? (
                <Badge tone="outline">
                  {DEVICE_LABELS[block.deviceVisibility] ?? block.deviceVisibility}
                </Badge>
              ) : null}
              {block.startsAt || block.endsAt ? (
                <Badge tone="info">
                  {windowLabel(block.startsAt, block.endsAt, formatDateTime)}
                </Badge>
              ) : null}
            </span>
            {summary(block) ? (
              <span className="text-xs text-muted-foreground">{summary(block)}</span>
            ) : null}
          </div>
        )}
        actions={(block) => (
          <RowActions
            label={blockLabel(block.type, types.data)}
            onEdit={canEdit ? () => setEditing({ block, type: block.type }) : undefined}
            onDelete={canCall(e.removeBlock) ? () => setRemoving(block) : undefined}
          />
        )}
        empty={
          <EmptyState
            icon={LayoutTemplate}
            title="No blocks yet"
            description="Add a block to start building the page. A page needs at least one to be published."
          />
        }
      />
      {adding && types.data ? (
        <AddBlockDialog
          types={types.data}
          blocks={blocks}
          onClose={() => setAdding(false)}
          onChoose={(type) => {
            setAdding(false);
            setEditing({ block: null, type });
          }}
        />
      ) : null}
      {editing ? (
        <BlockDialog
          page={page}
          block={editing.block}
          type={editing.type}
          info={types.data?.find((t) => t.type === editing.type)}
          onClose={() => setEditing(null)}
          onSaved={(next) => {
            onPage(next);
            setEditing(null);
          }}
        />
      ) : null}
      {removing ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setRemoving(null))}
          title={`Remove this ${blockLabel(removing.type, types.data).toLowerCase()}?`}
          description={
            page.status === 'PUBLISHED'
              ? 'It disappears from the live page at once. The page history keeps a copy.'
              : 'The page history keeps a copy.'
          }
          confirmLabel="Remove block"
          level="destructive"
          onConfirm={async () => {
            onPage(await contentApi.removeBlock(page.id, removing.id));
            notifySuccess('Block removed');
          }}
        />
      ) : null}
    </section>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  HERO: 'Top of page',
  COMMERCE: 'Products and collections',
  CONTENT: 'Text and images',
  SOCIAL: 'Social and forms',
  LAYOUT: 'Layout',
};

function AddBlockDialog({
  types,
  blocks,
  onClose,
  onChoose,
}: {
  types: readonly BlockTypeInfo[];
  blocks: readonly PageBlock[];
  onClose(): void;
  onChoose(type: BlockType): void;
}) {
  const used = (type: string) => blocks.filter((b) => b.type === type).length;
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add a block</DialogTitle>
          <DialogDescription>It is added at the end; move it afterwards.</DialogDescription>
        </DialogHeader>
        {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
          const inCategory = types.filter((t) => t.category === category);
          if (inCategory.length === 0) return null;
          return (
            <section key={category} aria-label={label} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{label}</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {inCategory.map((t) => {
                  const full = t.maxPerPage !== null && used(t.type) >= t.maxPerPage;
                  return (
                    <li key={t.type}>
                      <button
                        type="button"
                        disabled={full}
                        onClick={() => onChoose(t.type)}
                        className="flex h-full w-full flex-col gap-0.5 rounded-md border p-3 text-left hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="font-medium">{t.label}</span>
                        <span className="text-xs text-muted-foreground">{t.description}</span>
                        {full ? (
                          <span className="text-xs text-muted-foreground">
                            Already {t.maxPerPage} on this page (the most allowed).
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({
  page,
  onClose,
  onScheduled,
  onBlocked,
}: {
  page: CmsPage;
  onClose(): void;
  onScheduled(page: CmsPage): void;
  onBlocked(blockers: PublishBlocker[]): void;
}) {
  const [from, setFrom] = useState(dateTimeLocal(page.scheduledAt));
  const [until, setUntil] = useState(dateTimeLocal(page.expiresAt));
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setProblem(null);
    setError(null);
    const scheduledAt = fromDateTimeLocal(from);
    const expiresAt = fromDateTimeLocal(until);
    if (!scheduledAt) return setProblem('Choose when the page goes live.');
    if (expiresAt && expiresAt <= scheduledAt)
      return setProblem('"Take down at" must be after "Go live at".');
    setSaving(true);
    try {
      onScheduled(await contentApi.schedulePage(page.id, { scheduledAt, expiresAt }));
      notifySuccess('Page scheduled');
    } catch (err) {
      const found = publishBlockers(err);
      if (found) onBlocked(found);
      else setError(err);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule &quot;{page.title}&quot;</DialogTitle>
          <DialogDescription>
            The page goes live by itself at that time, and can be taken down automatically. The
            server checks every block now.
          </DialogDescription>
        </DialogHeader>
        <FormAlert error={error} messages={problem ? [problem] : []} />
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schedule-from">Go live at</Label>
            <Input
              id="schedule-from"
              type="datetime-local"
              value={from}
              onChange={(ev) => setFrom(ev.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schedule-until">Take down at (optional)</Label>
            <Input
              id="schedule-until"
              type="datetime-local"
              value={until}
              onChange={(ev) => setUntil(ev.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={saving}>
            <Eye aria-hidden />
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
