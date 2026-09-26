import type { ProductTab } from './model';

/** Kept apart from ./model so lists that only link to products do not ship the editor's tables. */
export const productHref = (id: string, tab?: ProductTab): string =>
  `/catalog/products/edit?id=${encodeURIComponent(id)}${tab && tab !== 'general' ? `&tab=${tab}` : ''}`;
