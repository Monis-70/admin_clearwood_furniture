import { describe, expect, it } from 'vitest';

import type { AdminVariantDto } from '@shared/types/catalogAdmin';
import { DEVICE_TARGETS, MEDIA_ROLES } from '@shared/enums';
import type { MediaAssetDto, ProductMediaItemDto } from '@shared/types/media';

import {
  DEVICE_LABELS,
  ROLE_LABELS,
  moveItem,
  patchItem,
  planSave,
  reconcile,
  scopeLabel,
  scopeOptions,
} from './gallery-model';

function row(id: string, position: number, overrides: Partial<ProductMediaItemDto> = {}) {
  return {
    id,
    mediaId: `med_${id}`,
    role: 'GALLERY',
    position,
    altText: null,
    deviceTarget: 'ALL',
    attributeValueId: null,
    variantId: null,
    media: { id: `med_${id}`, title: null, focalPoint: null } as MediaAssetDto,
    ...overrides,
  } as ProductMediaItemDto;
}

const server = [
  row('a', 0, { role: 'PRIMARY' }),
  row('b', 1),
  row('c', 2, { altText: 'Side view' }),
];

describe('gallery draft', () => {
  it('mirrors the shared role and device enums', () => {
    expect(Object.keys(ROLE_LABELS).sort()).toEqual([...MEDIA_ROLES].sort());
    expect(Object.keys(DEVICE_LABELS).sort()).toEqual([...DEVICE_TARGETS].sort());
  });

  it('follows the API order and has nothing to save until something changes', () => {
    const view = reconcile(null, [server[2]!, server[0]!, server[1]!]);
    expect(view.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(planSave(server, view)).toEqual({ items: [], assets: [], reorder: null });
  });

  it('keeps local edits when rows are attached or removed meanwhile', () => {
    const edited = moveItem(reconcile(null, server), 2, 0);
    const next = reconcile(edited, [server[0]!, server[2]!, row('d', 3)]);
    expect(next.map((item) => item.id)).toEqual(['c', 'a', 'd']);
  });

  it('sends the full new order once, positions from zero', () => {
    const view = moveItem(reconcile(null, server), 2, 0);
    expect(planSave(server, view).reorder).toEqual([
      { id: 'c', position: 0 },
      { id: 'a', position: 1 },
      { id: 'b', position: 2 },
    ]);
    expect(moveItem(view, 0, 0)).toBe(view);
    expect(moveItem(view, 0, 9)).toBe(view);
  });

  it('keeps one primary: promoting demotes the old one, and the promotion is sent last', () => {
    const view = patchItem(reconcile(null, server), 'b', { role: 'PRIMARY' });
    expect(view.map((item) => item.role)).toEqual(['GALLERY', 'PRIMARY', 'GALLERY']);
    expect(planSave(server, view).items).toEqual([
      { id: 'a', patch: { role: 'GALLERY' } },
      { id: 'b', patch: { role: 'PRIMARY' } },
    ]);
  });

  it('sends only changed fields: trimmed alt text, cleared alt as null, scope as ids', () => {
    let view = reconcile(null, server);
    view = patchItem(view, 'b', { altText: '  Front view ', deviceTarget: 'MOBILE' });
    view = patchItem(view, 'c', { altText: '', scope: 'variant:var_beige' });
    view = patchItem(view, 'a', { scope: 'value:val_grey' });
    expect(planSave(server, view).items).toEqual([
      { id: 'a', patch: { variantId: null, attributeValueId: 'val_grey' } },
      { id: 'b', patch: { altText: 'Front view', deviceTarget: 'MOBILE' } },
      { id: 'c', patch: { altText: null, variantId: 'var_beige', attributeValueId: null } },
    ]);
  });

  it("sends the file's title and focal point to the file, once per changed file", () => {
    let view = reconcile(null, server);
    view = patchItem(view, 'a', { title: ' Hero ', focalPoint: { x: 2500, y: 7500 } });
    view = patchItem(view, 'b', { title: '' });
    expect(planSave(server, view).assets).toEqual([
      { mediaId: 'med_a', patch: { title: 'Hero', focalPoint: { x: 2500, y: 7500 } } },
    ]);
  });

  it("offers only this product's variants and the option values they use", () => {
    const variants = [
      {
        id: 'var_beige',
        sku: 'CW-B',
        name: 'Beige',
        attributeValues: [{ attributeId: 'att_colour', attributeValueId: 'val_beige' }],
      },
      {
        id: 'var_grey',
        sku: 'CW-G',
        name: null,
        attributeValues: [{ attributeId: 'att_colour', attributeValueId: 'val_grey' }],
      },
    ] as AdminVariantDto[];
    const attributes = [
      { id: 'att_size', name: 'Size', position: 2, values: [{ id: 'val_l', label: 'Large' }] },
      {
        id: 'att_colour',
        name: 'Colour',
        position: 1,
        values: [
          { id: 'val_beige', label: 'Beige' },
          { id: 'val_grey', label: 'Grey' },
          { id: 'val_red', label: 'Red' },
        ],
      },
    ];
    const options = scopeOptions(variants, attributes);
    expect(options.variants).toEqual([
      { value: 'variant:var_beige', label: 'Beige' },
      { value: 'variant:var_grey', label: 'CW-G' },
    ]);
    expect(options.values).toEqual([
      { value: 'value:val_beige', label: 'Colour: Beige' },
      { value: 'value:val_grey', label: 'Colour: Grey' },
    ]);
    expect(scopeLabel('', options)).toBe('All variants');
    expect(scopeLabel('variant:var_beige', options)).toBe('Variant: Beige');
    expect(scopeLabel('value:val_grey', options)).toBe('Colour: Grey');
  });
});
