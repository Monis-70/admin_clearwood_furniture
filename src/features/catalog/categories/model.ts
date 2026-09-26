import type { AdminCategoryDto } from '@shared/types/catalogAdmin';

export interface CategoryNode extends AdminCategoryDto {
  children: CategoryNode[];
}

export function buildTree(rows: readonly AdminCategoryDto[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>();
  for (const row of rows) byId.set(row.id, { ...row, children: [] });
  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (list: CategoryNode[]) => {
    list.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    for (const node of list) sort(node.children);
  };
  sort(roots);
  return roots;
}

/** Keeps matching nodes and the path leading to them. */
export function filterTree(nodes: CategoryNode[], term: string): CategoryNode[] {
  if (!term) return nodes;
  const needle = term.toLowerCase();
  return nodes.flatMap((node) => {
    const children = filterTree(node.children, term);
    const hit = node.name.toLowerCase().includes(needle) || node.slug.includes(needle);
    return hit || children.length > 0
      ? [{ ...node, children: hit ? node.children : children }]
      : [];
  });
}

/** Ids of a category and everything below it: a category cannot move under itself. */
export function descendantIds(rows: readonly AdminCategoryDto[], id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const row of rows) {
      if (row.parentId && out.has(row.parentId) && !out.has(row.id)) {
        out.add(row.id);
        grew = true;
      }
    }
  }
  return out;
}

export const KIND_LABELS: Record<string, string> = {
  SERVICE: 'Contract work',
  INTERIOR_SOLUTION: 'Interior solution',
  SPECIAL_COLLECTION: 'Special collection',
  MAKE_YOUR_OWN: 'Make your own',
  NEW_ARRIVALS: 'New arrivals',
  ALL: 'All products',
};

export const KIND_OPTIONS = [
  { value: 'STANDARD', label: 'Standard (products)' },
  ...Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label })),
];

/** Names for the API's delete strategies; what each one touches is shown by the delete-impact preview. */
export const DELETE_STRATEGIES: Record<string, { label: string; explain: string }> = {
  BLOCK: {
    label: 'Only if empty',
    explain: 'Refused while it still has subcategories or products.',
  },
  SOFT: { label: 'This category only', explain: 'Deletes this category.' },
  REASSIGN_CHILDREN: {
    label: 'Move subcategories up first',
    explain: 'Its subcategories move to its parent.',
  },
  CASCADE_SOFT: {
    label: 'With all subcategories',
    explain: 'Deletes it and every subcategory below it.',
  },
};
