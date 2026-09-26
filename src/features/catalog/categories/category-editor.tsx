'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { z } from 'zod';

import type { AdminCategoryDto } from '@shared/types/catalogAdmin';

import { EmptyState, ErrorState, SectionLoader } from '@/components/patterns/states';
import { Workbench, type WorkbenchIssue } from '@/components/patterns/workbench';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { auditRoutes } from '@/lib/api/routes/audit';
import { categoriesRoutes } from '@/lib/api/routes/categories';
import { hasCode } from '@/lib/api/errors';
import { formatCount, formatDate, formatNumber, formatRelative } from '@/lib/format/datetime';
import { notifyError, notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { catalogKeys } from '../api';
import {
  CheckField,
  EditorForm,
  FieldGrid,
  FormSection,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
  intInput,
  optionalInt,
  optionalText,
  requiredText,
  textInput,
} from '../form-kit';
import { categoryTrail, useAttributeOptions } from '../lookups';
import { PUBLICATION } from '../model';
import { StatusBadge } from '@/components/patterns/status-badge';
import { categoriesApi, taxonomyKeys } from '../taxonomy/api';

import type { CategoryDialog } from './categories-screen';
import { KIND_OPTIONS } from './model';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LEAD_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const schema = z.object({
  name: requiredText(2, 160, 'Name'),
  slug: z.string().trim().regex(SLUG, 'Use lowercase words joined by dashes'),
  kind: z.string(),
  isActive: z.boolean(),
  showInMenu: z.boolean(),
  isFeatured: z.boolean(),
  menuColumn: optionalInt(1, 12, 'Menu column'),
  leadFormKey: z
    .string()
    .trim()
    .refine((value) => value === '' || LEAD_KEY.test(value), 'Use lowercase words joined by dashes')
    .transform((value) => value || null),
  shortDescription: optionalText(400),
  description: optionalText(20_000),
  seoTitle: optionalText(180),
  seoDescription: optionalText(400),
  seoKeywords: optionalText(400),
});
type Values = z.input<typeof schema>;

export function CategoryEditor({
  id,
  categories,
  onClose,
  onDialog,
}: {
  id: string;
  categories: readonly AdminCategoryDto[];
  onClose(): void;
  onDialog(dialog: CategoryDialog): void;
}) {
  const category = useQuery({
    queryKey: taxonomyKeys.category(id),
    queryFn: ({ signal }) => categoriesApi.get(id, signal),
    ...cachePolicy.detail,
  });

  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        {category.isPending ? (
          <>
            <SheetTitle className="sr-only">Category</SheetTitle>
            <SheetDescription className="sr-only">Loading</SheetDescription>
            <SectionLoader label="Loading category…" />
          </>
        ) : category.error ? (
          <>
            <SheetTitle>
              {hasCode(category.error, 'NOT_FOUND') ? 'Category not found' : 'Category'}
            </SheetTitle>
            <SheetDescription className="sr-only">Could not load</SheetDescription>
            <ErrorState error={category.error} onRetry={() => void category.refetch()} />
          </>
        ) : (
          <Editor category={category.data} categories={categories} onDialog={onDialog} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Editor({
  category,
  categories,
  onDialog,
}: {
  category: AdminCategoryDto;
  categories: readonly AdminCategoryDto[];
  onDialog(dialog: CategoryDialog): void;
}) {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const canEdit = canCall(categoriesRoutes.update) && !category.deletedAt;

  const issues: WorkbenchIssue[] = [];
  if (!category.isActive)
    issues.push({ key: 'inactive', label: 'Inactive: hidden from customers.', tone: 'warning' });
  if (category.isActive && !category.showInMenu) {
    issues.push({ key: 'menu', label: 'Not in the storefront menu.', tone: 'warning' });
  }
  if (!category.seoDescription)
    issues.push({ key: 'seo', label: 'No SEO description.', tone: 'warning' });

  return (
    <div className="flex flex-col gap-4">
      <SheetHeader className="p-0">
        <SheetTitle>{category.name}</SheetTitle>
        <SheetDescription>
          {categoryTrail(categories, category.id) || category.path}
        </SheetDescription>
      </SheetHeader>
      <Workbench
        kind="Category"
        title={category.name}
        status={
          <>
            <Badge tone={category.deletedAt ? 'danger' : category.isActive ? 'success' : 'warning'}>
              {category.deletedAt ? 'Deleted' : category.isActive ? 'Active' : 'Inactive'}
            </Badge>
            {KIND_OPTIONS.find((k) => k.value === category.kind && k.value !== 'STANDARD') ? (
              <Badge tone="info">
                {KIND_OPTIONS.find((k) => k.value === category.kind)!.label}
              </Badge>
            ) : null}
          </>
        }
        issues={issues}
        facts={[
          { label: 'Address', value: <span className="font-mono text-xs">/{category.path}</span> },
          { label: 'Updated', value: formatRelative(category.updatedAt) },
        ]}
        related={[
          {
            label: 'Products',
            count: category.productCountCache,
            href: `/catalog/products?categoryId=${encodeURIComponent(category.id)}`,
          },
          { label: 'Subcategories', count: category.childCount },
        ]}
        actions={
          <>
            {canCall(categoriesRoutes.create) && !category.deletedAt ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDialog({ kind: 'create', parentId: category.id })}
              >
                Add subcategory
              </Button>
            ) : null}
            {canCall(categoriesRoutes.move) && !category.deletedAt ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDialog({ kind: 'move', category })}
              >
                Move…
              </Button>
            ) : null}
            {canCall(categoriesRoutes.remove) && !category.deletedAt ? (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => onDialog({ kind: 'delete', category })}
              >
                Delete…
              </Button>
            ) : null}
          </>
        }
        history={
          canCall(auditRoutes.list) ? { entity: 'Category', entityId: category.id } : undefined
        }
      />
      <Tabs defaultValue="details">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="details">Details</TabsTrigger>
          {canCall(categoriesRoutes.attributes) ? (
            <TabsTrigger value="attributes">Attributes</TabsTrigger>
          ) : null}
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="redirects">Old addresses</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="pt-4">
          <EditorForm
            key={category.version}
            schema={schema}
            defaultValues={{
              name: category.name,
              slug: category.slug,
              kind: category.kind,
              isActive: category.isActive,
              showInMenu: category.showInMenu,
              isFeatured: category.isFeatured,
              menuColumn: intInput(category.menuColumn),
              leadFormKey: textInput(category.leadFormKey),
              shortDescription: textInput(category.shortDescription),
              description: textInput(category.description),
              seoTitle: textInput(category.seoTitle),
              seoDescription: textInput(category.seoDescription),
              seoKeywords: textInput(category.seoKeywords),
            }}
            successMessage="Category saved"
            readOnly={
              canEdit ? undefined : <p className="text-sm text-muted-foreground">View only.</p>
            }
            conflict={{
              fields: [
                { key: 'name', label: 'Name' },
                { key: 'slug', label: 'URL slug' },
                { key: 'isActive', label: 'Active' },
                { key: 'showInMenu', label: 'In the menu' },
                { key: 'leadFormKey', label: 'Enquiry form' },
                { key: 'description', label: 'Description' },
              ],
              yours: (values) => values as unknown as Partial<AdminCategoryDto>,
              loadLatest: () => categoriesApi.get(category.id),
              onReload: (latest) =>
                queryClient.setQueryData(taxonomyKeys.category(category.id), latest),
            }}
            onSubmit={async (values) => {
              const next = await categoriesApi.update(category.id, {
                ...values,
                kind: values.kind as AdminCategoryDto['kind'] as never,
                version: category.version,
              });
              queryClient.setQueryData(taxonomyKeys.category(category.id), next);
              void queryClient.invalidateQueries({ queryKey: catalogKeys.categoryTree() });
              void queryClient.invalidateQueries({ queryKey: taxonomyKeys.categories });
            }}
          >
            <FormSection title="Basics">
              <FieldGrid>
                <TextField<Values> name="name" label="Name" required />
                <TextField<Values> name="slug" label="URL slug" required />
              </FieldGrid>
              <FieldGrid>
                <SelectField<Values> name="kind" label="Kind" options={KIND_OPTIONS} />
                <TextField<Values>
                  name="leadFormKey"
                  label="Enquiry form"
                  description="For service categories: the enquiry form key, e.g. contract-work."
                />
              </FieldGrid>
              <FieldGrid columns={3}>
                <CheckField<Values>
                  name="isActive"
                  label="Active"
                  description="Visible to customers."
                />
                <CheckField<Values> name="showInMenu" label="In the menu" />
                <CheckField<Values> name="isFeatured" label="Featured" />
              </FieldGrid>
              <NumberField<Values>
                name="menuColumn"
                label="Menu column"
                description="1–12; empty: automatic."
              />
            </FormSection>
            <FormSection title="Description">
              <TextAreaField<Values> name="shortDescription" label="Short description" rows={2} />
              <TextAreaField<Values> name="description" label="Description" rows={5} />
            </FormSection>
            <FormSection title="SEO">
              <TextField<Values> name="seoTitle" label="SEO title" />
              <TextAreaField<Values> name="seoDescription" label="SEO description" rows={3} />
              <TextField<Values> name="seoKeywords" label="SEO keywords" />
            </FormSection>
          </EditorForm>
        </TabsContent>
        {canCall(categoriesRoutes.attributes) ? (
          <TabsContent value="attributes" className="pt-4">
            <CategoryAttributes category={category} />
          </TabsContent>
        ) : null}
        <TabsContent value="products" className="pt-4">
          <CategoryProducts category={category} />
        </TabsContent>
        <TabsContent value="redirects" className="pt-4">
          <CategoryRedirects category={category} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CategoryAttributes({ category }: { category: AdminCategoryDto }) {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const attributes = useAttributeOptions();
  const [adding, setAdding] = useState('');
  const links = useQuery({
    queryKey: taxonomyKeys.categoryPart(category.id, 'attributes'),
    queryFn: ({ signal }) => categoriesApi.attributes(category.id, signal),
    ...cachePolicy.detail,
  });
  const canEdit = canCall(categoriesRoutes.linkAttribute) && !category.deletedAt;
  const refresh = () =>
    void queryClient.invalidateQueries({
      queryKey: taxonomyKeys.categoryPart(category.id, 'attributes'),
    });
  const upsert = useMutation({
    mutationFn: (input: Parameters<typeof categoriesApi.linkAttribute>[1]) =>
      categoriesApi.linkAttribute(category.id, input),
    onSuccess: () => {
      refresh();
      setAdding('');
      notifySuccess('Attribute settings saved');
    },
    onError: (error) => notifyError(error, 'Could not save the attribute'),
  });
  const unlink = useMutation({
    mutationFn: (attributeId: string) => categoriesApi.unlinkAttribute(category.id, attributeId),
    onSuccess: () => {
      refresh();
      notifySuccess('Attribute removed from the category');
    },
    onError: (error) => notifyError(error, 'Could not remove the attribute'),
  });

  if (links.isPending) return <SectionLoader label="Loading attributes…" />;
  if (links.error)
    return <ErrorState error={links.error} onRetry={() => void links.refetch()} compact />;
  const nameOf = (id: string) =>
    attributes.data?.find((a) => a.id === id)?.name ??
    links.data.find((l) => l.attributeId === id)?.name ??
    id;
  const linked = new Set(links.data.map((link) => link.attributeId));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Attributes this category asks for. Required ones must be filled on its products before they
        can be published; filterable ones become storefront filters.
      </p>
      {links.data.length === 0 ? (
        <EmptyState
          title="No attributes linked"
          description="Products still show every attribute; linking makes some required or filterable here."
          compact
        />
      ) : (
        <ul className="flex flex-col divide-y rounded-md border">
          {links.data.map((link) => (
            <li
              key={link.attributeId}
              className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm"
            >
              <span className="min-w-32 flex-1 font-medium">{nameOf(link.attributeId)}</span>
              {(['isRequired', 'isFilterable', 'isVariantDefining'] as const).map((flag) => (
                <label key={flag} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={link[flag]}
                    disabled={!canEdit || upsert.isPending}
                    onChange={(event) =>
                      upsert.mutate({ attributeId: link.attributeId, [flag]: event.target.checked })
                    }
                  />
                  {flag === 'isRequired'
                    ? 'Required'
                    : flag === 'isFilterable'
                      ? 'Filter'
                      : 'Variant option'}
                </label>
              ))}
              {canCall(categoriesRoutes.unlinkAttribute) && !category.deletedAt ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${nameOf(link.attributeId)} from this category`}
                  onClick={() => unlink.mutate(link.attributeId)}
                >
                  <Trash2 aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="link-attribute" className="text-sm font-medium">
              Link an attribute
            </label>
            <NativeSelect
              id="link-attribute"
              value={adding}
              onChange={(event) => setAdding(event.target.value)}
            >
              <option value="">Choose an attribute…</option>
              {(attributes.data ?? [])
                .filter((attribute) => !linked.has(attribute.id))
                .map((attribute) => (
                  <option key={attribute.id} value={attribute.id}>
                    {attribute.name}
                  </option>
                ))}
            </NativeSelect>
          </div>
          <Button
            disabled={!adding}
            loading={upsert.isPending}
            onClick={() => upsert.mutate({ attributeId: adding, isFilterable: true })}
          >
            Link
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function CategoryProducts({ category }: { category: AdminCategoryDto }) {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const products = useQuery({
    queryKey: taxonomyKeys.categoryPart(category.id, 'products', page),
    queryFn: ({ signal }) => categoriesApi.products(category.id, page, signal),
    ...cachePolicy.list,
  });
  const reorder = useMutation({
    mutationFn: async ({ index, by }: { index: number; by: -1 | 1 }) => {
      const list = [...(products.data?.items ?? [])];
      const [item] = list.splice(index, 1);
      list.splice(index + by, 0, item!);
      const offset = (page - 1) * 50;
      await categoriesApi.reorderProducts(
        category.id,
        list.map((row, i) => ({ id: row.productId, position: offset + i })),
      );
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: taxonomyKeys.categoryPart(category.id, 'products'),
      }),
    onError: (error) => notifyError(error, 'Could not reorder'),
  });
  const canReorder = canCall(categoriesRoutes.reorderProducts) && !category.deletedAt;

  if (products.isPending) return <SectionLoader label="Loading products…" />;
  if (products.error)
    return <ErrorState error={products.error} onRetry={() => void products.refetch()} compact />;
  if (products.data.items.length === 0) {
    return (
      <EmptyState
        title="No products in this category"
        description="Assign products from the product editor or with a bulk action."
        compact
      />
    );
  }
  const items = products.data.items;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        The order customers see when this category is sorted by &ldquo;Featured&rdquo;.
      </p>
      <ol
        className="flex flex-col divide-y rounded-md border"
        aria-label="Products in curated order"
      >
        {items.map((row, index) => (
          <li key={row.productId} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className="tabular w-6 text-right text-muted-foreground">
              {(page - 1) * 50 + index + 1}
            </span>
            <Link
              href={`/catalog/products/edit?id=${encodeURIComponent(row.productId)}`}
              className="min-w-0 flex-1 truncate font-medium hover:underline"
            >
              {row.name}
            </Link>
            {row.isPrimary ? <Badge tone="info">Primary</Badge> : null}
            <StatusBadge status={row.publication} registry={PUBLICATION} />
            {canReorder ? (
              <span className="flex">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Move ${row.name} up`}
                  disabled={index === 0 || reorder.isPending}
                  onClick={() => reorder.mutate({ index, by: -1 })}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Move ${row.name} down`}
                  disabled={index === items.length - 1 || reorder.isPending}
                  onClick={() => reorder.mutate({ index, by: 1 })}
                >
                  <ArrowDown aria-hidden />
                </Button>
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      {products.data.meta.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <Button
            size="sm"
            variant="ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {products.data.meta.totalPages} ·{' '}
            {formatCount(products.data.meta.total, 'product')}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={!products.data.meta.hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function CategoryRedirects({ category }: { category: AdminCategoryDto }) {
  const redirects = useQuery({
    queryKey: taxonomyKeys.categoryPart(category.id, 'redirects'),
    queryFn: ({ signal }) => categoriesApi.redirects(category.id, signal),
    ...cachePolicy.detail,
  });
  if (redirects.isPending) return <SectionLoader label="Loading…" />;
  if (redirects.error)
    return <ErrorState error={redirects.error} onRetry={() => void redirects.refetch()} compact />;
  if (redirects.data.length === 0)
    return <p className="text-sm text-muted-foreground">The address has never changed.</p>;
  return (
    <ul className="flex flex-col divide-y rounded-md border text-sm">
      {redirects.data.map((redirect) => (
        <li
          key={redirect.id}
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
        >
          <span className="font-mono break-all">/{redirect.fromSlug}</span>
          <span className="text-xs text-muted-foreground">
            {formatNumber(redirect.hitCount)} visits · since {formatDate(redirect.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
