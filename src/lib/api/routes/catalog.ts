import { PUBLIC, endpoint, requires } from '../endpoint';

export const catalogRoutes = {
  /** Storefront resolver: what a customer reaching this path gets (entity, redirect, 404). */
  resolvePath: endpoint('GET', '/catalog/resolve', { access: PUBLIC }),
  settings: endpoint('GET', '/admin/catalog/settings', {
    access: requires('catalog.product.read'),
  }),
  updateSettings: endpoint('PUT', '/admin/catalog/settings', {
    access: requires('catalog.product.update'),
  }),
  products: endpoint('GET', '/admin/catalog/products', {
    access: requires('catalog.product.read'),
  }),
  categoryTree: endpoint('GET', '/admin/catalog/categories/tree', {
    access: requires('catalog.category.read'),
  }),
  collections: endpoint('GET', '/admin/catalog/collections', {
    access: requires('catalog.collection.read'),
  }),
  lowStock: endpoint('GET', '/admin/catalog/inventory/low-stock', {
    access: requires('catalog.inventory.read'),
  }),
} as const;
