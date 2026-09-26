'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleHelp, FolderPlus, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { PageHeader } from '@/components/patterns/page-header';
import {
  EmptyState,
  ErrorState,
  PermissionNotice,
  SectionLoader,
} from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { endpoints } from '@/lib/api/endpoints';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';
import { cn } from '@/lib/utils';

import { contentApi, contentKeys, type FaqCategoryRow, type FaqRow } from './api';
import { ReorderList, RowActions } from './kit';
import { FAQ_VISIBILITY_LABELS, reorderBody } from './model';

const FaqDialog = dynamic(() => import('./dialogs/faq-dialogs').then((m) => m.FaqDialog), {
  ssr: false,
});
const FaqCategoryDialog = dynamic(
  () => import('./dialogs/faq-dialogs').then((m) => m.FaqCategoryDialog),
  { ssr: false },
);

const e = endpoints.content;
const NONE = '__none';

export function FaqsScreen() {
  const { canCall } = usePermissions();
  if (!canCall(e.faqs)) return <PermissionNotice area="FAQs" all={['cms.faq.read']} />;
  return <Faqs />;
}

function Faqs() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const [group, setGroup] = useState<string>('');
  const [editing, setEditing] = useState<FaqRow | 'new' | null>(null);
  const [removing, setRemoving] = useState<FaqRow | null>(null);
  const [editingGroup, setEditingGroup] = useState<FaqCategoryRow | 'new' | null>(null);
  const [removingGroup, setRemovingGroup] = useState<FaqCategoryRow | null>(null);
  const faqs = useQuery({
    queryKey: contentKeys.faqs(),
    queryFn: ({ signal }) => contentApi.faqs(signal),
    ...cachePolicy.list,
  });
  const groups = useQuery({
    queryKey: contentKeys.faqCategories(),
    queryFn: ({ signal }) => contentApi.faqCategories(signal),
    ...cachePolicy.list,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: contentKeys.faqs() });
    void queryClient.invalidateQueries({ queryKey: contentKeys.faqCategories() });
  };

  if (faqs.isPending || groups.isPending) return <SectionLoader label="Loading FAQs…" />;
  if (faqs.error || groups.error)
    return (
      <ErrorState
        error={faqs.error ?? groups.error}
        onRetry={() => {
          void faqs.refetch();
          void groups.refetch();
        }}
      />
    );

  const sortedGroups = [...groups.data].sort((a, b) => a.position - b.position);
  const known = new Set(sortedGroups.map((g) => g.id));
  const inGroup = (faq: FaqRow) =>
    group === ''
      ? true
      : group === NONE
        ? !faq.faqCategoryId || !known.has(faq.faqCategoryId)
        : faq.faqCategoryId === group;
  const shown = faqs.data.filter(inGroup).sort((a, b) => a.position - b.position);
  const count = (id: string) => faqs.data.filter((f) => f.faqCategoryId === id).length;
  const groupName = (id: string | null) => sortedGroups.find((g) => g.id === id)?.name;

  return (
    <>
      <PageHeader
        title="FAQs"
        description="Questions and answers for the storefront FAQ page, product pages and FAQ blocks."
        actions={
          canCall(e.createFaq) ? (
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden />
              New question
            </Button>
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <nav aria-label="Question groups" className="flex flex-col gap-2">
          <ul className="flex flex-col gap-0.5">
            {[
              { id: '', name: 'All questions', n: faqs.data.length },
              ...sortedGroups.map((g) => ({ id: g.id, name: g.name, n: count(g.id) })),
              {
                id: NONE,
                name: 'Not in a group',
                n: faqs.data.filter((f) => !f.faqCategoryId || !known.has(f.faqCategoryId)).length,
              },
            ].map((g) => {
              const row = sortedGroups.find((c) => c.id === g.id);
              return (
                <li key={g.id || 'all'} className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-current={group === g.id ? 'true' : undefined}
                    onClick={() => setGroup(g.id)}
                    className={cn(
                      'flex flex-1 items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
                      group === g.id && 'bg-accent font-medium',
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      {g.name}
                      {row && !row.isActive ? <Badge tone="neutral">Hidden</Badge> : null}
                    </span>
                    <span className="tabular text-xs text-muted-foreground">{g.n}</span>
                  </button>
                  {row ? (
                    <RowActions
                      label={row.name}
                      onEdit={canCall(e.updateFaqCategory) ? () => setEditingGroup(row) : undefined}
                      onDelete={
                        canCall(e.removeFaqCategory) ? () => setRemovingGroup(row) : undefined
                      }
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
          {canCall(e.createFaqCategory) ? (
            <Button variant="outline" size="sm" onClick={() => setEditingGroup('new')}>
              <FolderPlus aria-hidden />
              New group
            </Button>
          ) : null}
        </nav>
        <section aria-label="Questions" className="min-w-0">
          <ReorderList
            items={shown}
            label="Questions"
            canReorder={canCall(e.reorderFaqs)}
            onSave={async (ids) => {
              await contentApi.reorderFaqs(reorderBody(ids));
              refresh();
            }}
            render={(faq) => (
              <div className="flex flex-col gap-1">
                <span className="font-medium">{faq.question}</span>
                <span className="line-clamp-2 text-sm text-muted-foreground">{faq.answer}</span>
                <span className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {group === '' && groupName(faq.faqCategoryId) ? (
                    <span>{groupName(faq.faqCategoryId)}</span>
                  ) : null}
                  <span>{FAQ_VISIBILITY_LABELS[faq.visibility] ?? faq.visibility}</span>
                  {faq.isActive ? null : <Badge tone="neutral">Hidden</Badge>}
                  <span>
                    Helpful {faq.helpfulYes} · not helpful {faq.helpfulNo}
                  </span>
                </span>
              </div>
            )}
            actions={(faq) => (
              <RowActions
                label={faq.question}
                onEdit={canCall(e.updateFaq) ? () => setEditing(faq) : undefined}
                onDelete={canCall(e.removeFaq) ? () => setRemoving(faq) : undefined}
              />
            )}
            empty={<EmptyState icon={CircleHelp} title="No questions here yet" compact />}
          />
        </section>
      </div>
      {editing ? (
        <FaqDialog
          row={editing === 'new' ? null : editing}
          categories={sortedGroups}
          defaultCategoryId={group && group !== NONE ? group : undefined}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            setEditing(null);
          }}
        />
      ) : null}
      {editingGroup ? (
        <FaqCategoryDialog
          row={editingGroup === 'new' ? null : editingGroup}
          onClose={() => setEditingGroup(null)}
          onSaved={() => {
            refresh();
            setEditingGroup(null);
          }}
        />
      ) : null}
      {removing ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setRemoving(null))}
          title="Delete this question?"
          description={`"${removing.question}" disappears from the storefront.`}
          confirmLabel="Delete question"
          level="destructive"
          onConfirm={async () => {
            await contentApi.removeFaq(removing.id);
            refresh();
            notifySuccess('Question deleted');
          }}
        />
      ) : null}
      {removingGroup ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setRemovingGroup(null))}
          title={`Delete the group "${removingGroup.name}"?`}
          description={
            count(removingGroup.id) > 0
              ? `Its ${count(removingGroup.id)} questions are kept but no longer grouped. Move them first if they belong elsewhere.`
              : 'The group is empty.'
          }
          confirmLabel="Delete group"
          level="destructive"
          onConfirm={async () => {
            await contentApi.removeFaqCategory(removingGroup.id);
            if (group === removingGroup.id) setGroup('');
            refresh();
            notifySuccess('Group deleted');
          }}
        />
      ) : null}
    </>
  );
}
