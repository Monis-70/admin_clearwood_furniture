import type { AdminVariantDto } from '@shared/types/catalogAdmin';
import type { DeviceTarget, MediaRole } from '@shared/enums';
import type { MediaUpdateInput, ProductMediaUpdateInput } from '@shared/schemas/media';
import type { FocalPoint, ProductMediaItemDto } from '@shared/types/media';

/**
 * The gallery editor keeps local edits (order, primary, role, alt text, device, where an image is
 * shown, the file's title and focal point) until the admin saves, then sends only what changed.
 * Nothing here decides what customers see: the API's gallery resolver does.
 */

/** Mirrors MEDIA_ROLES (pinned by a test) without importing the shared enum module at runtime. */
export const ROLE_LABELS: Readonly<Record<MediaRole, string>> = {
  PRIMARY: 'Primary',
  HOVER: 'Hover',
  GALLERY: 'Gallery',
  LIFESTYLE: 'Lifestyle',
  DIMENSION_SHEET: 'Dimension sheet',
  THREE_SIXTY: '360°',
  VIDEO: 'Video',
};

/** Mirrors DEVICE_TARGETS (pinned by a test). */
export const DEVICE_LABELS: Readonly<Record<DeviceTarget, string>> = {
  ALL: 'All devices',
  MOBILE: 'Phones only',
  DESKTOP: 'Desktop only',
};

export interface DraftItem {
  id: string;
  role: MediaRole;
  /** '' when the image has no product-specific alt text. */
  altText: string;
  deviceTarget: DeviceTarget;
  /** '' for every variant, `variant:<id>` or `value:<attributeValueId>`. */
  scope: string;
  /** The file's own title and focal point: shared by everything that uses the file. */
  title: string;
  focalPoint: FocalPoint | null;
}

export type Draft = readonly DraftItem[];

export function byPosition(items: readonly ProductMediaItemDto[]): ProductMediaItemDto[] {
  return [...items].sort((a, b) => a.position - b.position);
}

export function scopeOf(item: Pick<ProductMediaItemDto, 'variantId' | 'attributeValueId'>) {
  if (item.variantId) return `variant:${item.variantId}`;
  if (item.attributeValueId) return `value:${item.attributeValueId}`;
  return '';
}

export function scopeFields(scope: string): {
  variantId: string | null;
  attributeValueId: string | null;
} {
  if (scope.startsWith('variant:')) return { variantId: scope.slice(8), attributeValueId: null };
  if (scope.startsWith('value:')) return { variantId: null, attributeValueId: scope.slice(6) };
  return { variantId: null, attributeValueId: null };
}

export function toDraftItem(item: ProductMediaItemDto): DraftItem {
  return {
    id: item.id,
    role: item.role,
    altText: item.altText ?? '',
    deviceTarget: item.deviceTarget,
    scope: scopeOf(item),
    title: item.media.title ?? '',
    focalPoint: item.media.focalPoint,
  };
}

/**
 * The API's rows with the local edits applied. A row attached meanwhile (upload, library) joins at
 * the end with its saved values; a row removed meanwhile disappears.
 */
export function reconcile(draft: Draft | null, server: readonly ProductMediaItemDto[]): Draft {
  const ordered = byPosition(server);
  if (!draft) return ordered.map(toDraftItem);
  const known = new Set(ordered.map((item) => item.id));
  const kept = draft.filter((item) => known.has(item.id));
  const keptIds = new Set(kept.map((item) => item.id));
  return [...kept, ...ordered.filter((item) => !keptIds.has(item.id)).map(toDraftItem)];
}

export function moveItem(draft: Draft, from: number, to: number): Draft {
  if (from === to || from < 0 || to < 0 || from >= draft.length || to >= draft.length) return draft;
  const next = [...draft];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/** Only one primary: the API demotes the previous one to Gallery, and so does the draft. */
export function patchItem(draft: Draft, id: string, change: Partial<Omit<DraftItem, 'id'>>): Draft {
  return draft.map((item) => {
    if (item.id === id) return { ...item, ...change };
    if (change.role === 'PRIMARY' && item.role === 'PRIMARY') return { ...item, role: 'GALLERY' };
    return item;
  });
}

export interface SavePlan {
  /** Item changes; a promotion to Primary is sent last so the API's demotion cannot undo it. */
  items: { id: string; patch: ProductMediaUpdateInput }[];
  assets: { mediaId: string; patch: MediaUpdateInput }[];
  /** The full order, or null when the order did not change. */
  reorder: { id: string; position: number }[] | null;
}

const sameFocal = (a: FocalPoint | null, b: FocalPoint | null) =>
  a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y);

export function planSave(server: readonly ProductMediaItemDto[], draft: Draft): SavePlan {
  const saved = new Map(server.map((item) => [item.id, item]));
  const items: SavePlan['items'] = [];
  const promotions: SavePlan['items'] = [];
  const assets: SavePlan['assets'] = [];
  for (const item of draft) {
    const before = saved.get(item.id);
    if (!before) continue;
    const patch: ProductMediaUpdateInput = {};
    if (item.role !== before.role) patch.role = item.role;
    const altText = item.altText.trim();
    if (altText !== (before.altText ?? '')) patch.altText = altText || null;
    if (item.deviceTarget !== before.deviceTarget) patch.deviceTarget = item.deviceTarget;
    if (item.scope !== scopeOf(before)) Object.assign(patch, scopeFields(item.scope));
    if (Object.keys(patch).length > 0) {
      (patch.role === 'PRIMARY' ? promotions : items).push({ id: item.id, patch });
    }

    const asset: MediaUpdateInput = {};
    const title = item.title.trim();
    if (title !== (before.media.title ?? '')) asset.title = title || null;
    if (!sameFocal(item.focalPoint, before.media.focalPoint)) asset.focalPoint = item.focalPoint;
    if (Object.keys(asset).length > 0) assets.push({ mediaId: before.mediaId, patch: asset });
  }
  const savedOrder = byPosition(server)
    .filter((item) => draft.some((entry) => entry.id === item.id))
    .map((item) => item.id);
  const draftOrder = draft.filter((item) => saved.has(item.id)).map((item) => item.id);
  const reordered = draftOrder.some((id, index) => savedOrder[index] !== id);
  return {
    items: [...items, ...promotions],
    assets,
    reorder: reordered ? draftOrder.map((id, position) => ({ id, position })) : null,
  };
}

export function changeCount(plan: SavePlan): number {
  return plan.items.length + plan.assets.length + (plan.reorder ? 1 : 0);
}

export interface ScopeOption {
  value: string;
  label: string;
}

/**
 * Where an image can be shown: every variant, one variant of this product, or one option value
 * (such as a colour) that this product's variants use. Nothing from another product is offered.
 */
export function scopeOptions(
  variants: readonly AdminVariantDto[],
  attributes: readonly {
    id: string;
    name: string;
    position: number;
    values: readonly { id: string; label: string }[];
  }[],
): { variants: ScopeOption[]; values: ScopeOption[] } {
  const used = new Map<string, Set<string>>();
  for (const variant of variants) {
    for (const value of variant.attributeValues) {
      const set = used.get(value.attributeId) ?? new Set<string>();
      set.add(value.attributeValueId);
      used.set(value.attributeId, set);
    }
  }
  const values = [...attributes]
    .filter((attribute) => used.has(attribute.id))
    .sort((a, b) => a.position - b.position)
    .flatMap((attribute) =>
      attribute.values
        .filter((value) => used.get(attribute.id)!.has(value.id))
        .map((value) => ({
          value: `value:${value.id}`,
          label: `${attribute.name}: ${value.label}`,
        })),
    );
  return {
    variants: variants.map((variant) => ({
      value: `variant:${variant.id}`,
      label: variant.name ?? variant.sku,
    })),
    values,
  };
}

export function scopeLabel(
  scope: string,
  options: { variants: ScopeOption[]; values: ScopeOption[] },
): string {
  if (!scope) return 'All variants';
  const match = [...options.variants, ...options.values].find((option) => option.value === scope);
  if (match) return scope.startsWith('variant:') ? `Variant: ${match.label}` : match.label;
  return scope.startsWith('variant:') ? 'One variant' : 'One option value';
}
