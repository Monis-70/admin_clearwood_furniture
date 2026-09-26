import type { AdminCategoryDto } from '@shared/types/catalogAdmin';
import { describe, expect, it } from 'vitest';

import { buildTree, descendantIds, filterTree } from './model';

const row = (id: string, name: string, parentId: string | null, position: number) =>
  ({
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    parentId,
    position,
  }) as AdminCategoryDto;

const rows = [
  row('beds', 'Beds', null, 2),
  row('living', 'Living Room', null, 1),
  row('sofas', 'Sofas', 'living', 1),
  row('sectional', 'Sectional Sofas', 'sofas', 1),
  row('tables', 'Coffee Tables', 'living', 0),
];

describe('category tree helpers', () => {
  it('nests rows under their parents in stored order', () => {
    const tree = buildTree(rows);
    expect(tree.map((node) => node.id)).toEqual(['living', 'beds']);
    expect(tree[0]!.children.map((node) => node.id)).toEqual(['tables', 'sofas']);
    expect(tree[0]!.children[1]!.children.map((node) => node.id)).toEqual(['sectional']);
  });

  it('filters to matches and the path that leads to them', () => {
    const filtered = filterTree(buildTree(rows), 'sectional');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.id).toBe('living');
    expect(filtered[0]!.children.map((node) => node.id)).toEqual(['sofas']);
    expect(filtered[0]!.children[0]!.children.map((node) => node.id)).toEqual(['sectional']);
  });

  it('lists a category and all its descendants, which it cannot move under', () => {
    expect([...descendantIds(rows, 'living')].sort()).toEqual(
      ['living', 'sectional', 'sofas', 'tables'].sort(),
    );
    expect([...descendantIds(rows, 'beds')]).toEqual(['beds']);
  });
});
