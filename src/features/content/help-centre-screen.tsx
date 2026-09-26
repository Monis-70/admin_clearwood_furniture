'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, FolderPlus, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { formatRelative } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';
import { cn } from '@/lib/utils';

import { contentApi, contentKeys, type HelpArticleRow, type HelpCategoryNode } from './api';
import { ReorderList, RowActions } from './kit';
import { CONTENT_STATUS_LABELS, flattenHelp, reorderBody } from './model';

const HelpCategoryDialog = dynamic(
  () => import('./dialogs/help-dialogs').then((m) => m.HelpCategoryDialog),
  { ssr: false },
);
const HelpArticleDialog = dynamic(
  () => import('./dialogs/help-dialogs').then((m) => m.HelpArticleDialog),
  { ssr: false },
);

const e = endpoints.content;
const HREF = '/content/help-centre';

export function HelpCentreScreen() {
  const { canCall } = usePermissions();
  if (!canCall(e.helpArticles))
    return <PermissionNotice area="the help centre" all={['cms.page.read']} />;
  return <HelpCentre />;
}

function HelpCentre() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const router = useRouter();
  const articleParam = useSearchParams().get('article');
  const [category, setCategory] = useState('');
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<HelpArticleRow | null>(null);
  const [editingCategory, setEditingCategory] = useState<HelpCategoryNode | 'new' | null>(null);
  const [removingCategory, setRemovingCategory] = useState<HelpCategoryNode | null>(null);
  const tree = useQuery({
    queryKey: contentKeys.helpCategories(),
    queryFn: ({ signal }) => contentApi.helpCategories(signal),
    ...cachePolicy.list,
  });
  const articles = useQuery({
    queryKey: contentKeys.helpArticles(),
    queryFn: ({ signal }) => contentApi.helpArticles(signal),
    ...cachePolicy.list,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: contentKeys.helpCategories() });
    void queryClient.invalidateQueries({ queryKey: contentKeys.helpArticles() });
  };
  const openArticle = (id: string | null) =>
    router.replace(id ? `${HREF}?article=${encodeURIComponent(id)}` : HREF, { scroll: false });

  if (tree.isPending || articles.isPending) return <SectionLoader label="Loading help centre…" />;
  if (tree.error || articles.error)
    return (
      <ErrorState
        error={tree.error ?? articles.error}
        onRetry={() => {
          void tree.refetch();
          void articles.refetch();
        }}
      />
    );

  const flat = flattenHelp(tree.data);
  const nameOf = (id: string) => flat.find((c) => c.id === id)?.name ?? 'Unknown category';
  const shown = articles.data
    .filter((a) => !category || a.helpCategoryId === category)
    .sort((a, b) => a.position - b.position);
  const count = (id: string) => articles.data.filter((a) => a.helpCategoryId === id).length;
  const editing =
    articleParam && articleParam !== 'new'
      ? (articles.data.find((a) => a.id === articleParam) ?? null)
      : null;

  return (
    <>
      <PageHeader
        title="Help centre"
        description="Self-service articles for customers, grouped into categories."
        actions={
          canCall(e.createHelpArticle) ? (
            <Button onClick={() => setCreating(true)} disabled={flat.length === 0}>
              <Plus aria-hidden />
              New article
            </Button>
          ) : null
        }
      />
      {articleParam && articleParam !== 'new' && !editing ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          That article was not found; it may have been deleted.
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <nav aria-label="Help categories" className="flex flex-col gap-2">
          <ul className="flex flex-col gap-0.5">
            <li>
              <button
                type="button"
                aria-current={category === '' ? 'true' : undefined}
                onClick={() => setCategory('')}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
                  category === '' && 'bg-accent font-medium',
                )}
              >
                All articles
                <span className="tabular text-xs text-muted-foreground">
                  {articles.data.length}
                </span>
              </button>
            </li>
            {flat.map((c) => (
              <li key={c.id} className="flex items-center gap-1">
                <button
                  type="button"
                  aria-current={category === c.id ? 'true' : undefined}
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    'flex flex-1 items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
                    category === c.id && 'bg-accent font-medium',
                  )}
                  style={{ paddingLeft: `${0.5 + c.level}rem` }}
                >
                  <span className="flex items-center gap-1.5">
                    {c.name}
                    {c.isActive ? null : <Badge tone="neutral">Hidden</Badge>}
                  </span>
                  <span className="tabular text-xs text-muted-foreground">{count(c.id)}</span>
                </button>
                <RowActions
                  label={c.name}
                  onEdit={canCall(e.updateHelpCategory) ? () => setEditingCategory(c) : undefined}
                  onDelete={
                    canCall(e.removeHelpCategory) ? () => setRemovingCategory(c) : undefined
                  }
                />
              </li>
            ))}
          </ul>
          {canCall(e.createHelpCategory) ? (
            <Button variant="outline" size="sm" onClick={() => setEditingCategory('new')}>
              <FolderPlus aria-hidden />
              New category
            </Button>
          ) : null}
        </nav>
        <section aria-label="Articles" className="min-w-0">
          <ReorderList
            items={shown}
            label="Articles"
            canReorder={canCall(e.reorderHelpArticles)}
            onSave={async (ids) => {
              await contentApi.reorderHelpArticles(reorderBody(ids));
              refresh();
            }}
            render={(a) => (
              <div className="flex flex-col gap-1">
                <span className="font-medium">{a.title}</span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge tone={a.status === 'PUBLISHED' ? 'success' : 'neutral'}>
                    {CONTENT_STATUS_LABELS[a.status] ?? a.status}
                  </Badge>
                  {category ? null : <span>{nameOf(a.helpCategoryId)}</span>}
                  <span className="font-mono">/{a.slug}</span>
                  <span>{a.viewCount} views</span>
                  <span>Updated {formatRelative(a.updatedAt)}</span>
                </span>
              </div>
            )}
            actions={(a) => (
              <RowActions
                label={a.title}
                onEdit={canCall(e.updateHelpArticle) ? () => openArticle(a.id) : undefined}
                onDelete={canCall(e.removeHelpArticle) ? () => setRemoving(a) : undefined}
              />
            )}
            empty={
              <EmptyState
                icon={BookOpen}
                title="No articles here yet"
                description={flat.length === 0 ? 'Create a category first.' : undefined}
                compact
              />
            }
          />
        </section>
      </div>
      {creating || editing ? (
        <HelpArticleDialog
          row={creating ? null : editing}
          tree={tree.data}
          articles={articles.data}
          defaultCategoryId={category || undefined}
          onClose={() => (creating ? setCreating(false) : openArticle(null))}
          onSaved={() => {
            refresh();
            if (creating) setCreating(false);
            else openArticle(null);
          }}
        />
      ) : null}
      {editingCategory ? (
        <HelpCategoryDialog
          row={editingCategory === 'new' ? null : editingCategory}
          tree={tree.data}
          onClose={() => setEditingCategory(null)}
          onSaved={() => {
            refresh();
            setEditingCategory(null);
          }}
        />
      ) : null}
      {removing ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setRemoving(null))}
          title={`Delete "${removing.title}"?`}
          description="Customers following a link to it will not find it any more."
          confirmLabel="Delete article"
          level="destructive"
          onConfirm={async () => {
            await contentApi.removeHelpArticle(removing.id);
            refresh();
            notifySuccess('Article deleted');
          }}
        />
      ) : null}
      {removingCategory ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setRemovingCategory(null))}
          title={`Delete the category "${removingCategory.name}"?`}
          description={
            count(removingCategory.id) > 0
              ? `It still has ${count(removingCategory.id)} articles: the server refuses until they are moved or deleted.`
              : 'The category is empty.'
          }
          confirmLabel="Delete category"
          level="destructive"
          onConfirm={async () => {
            await contentApi.removeHelpCategory(removingCategory.id);
            if (category === removingCategory.id) setCategory('');
            refresh();
            notifySuccess('Category deleted');
          }}
        />
      ) : null}
    </>
  );
}
