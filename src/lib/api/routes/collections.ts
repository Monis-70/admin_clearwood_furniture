import { endpoint, requires } from '../endpoint';

export const collectionsRoutes = {
  get: endpoint('GET', '/admin/catalog/collections/{id}', {
    access: requires('catalog.collection.read'),
  }),
  create: endpoint('POST', '/admin/catalog/collections', {
    access: requires('catalog.collection.create'),
  }),
  update: endpoint('PATCH', '/admin/catalog/collections/{id}', {
    access: requires('catalog.collection.update'),
  }),
  remove: endpoint('DELETE', '/admin/catalog/collections/{id}', {
    access: requires('catalog.collection.delete'),
  }),
  restore: endpoint('POST', '/admin/catalog/collections/{id}/restore', {
    access: requires('catalog.collection.update'),
  }),
  setProducts: endpoint('PUT', '/admin/catalog/collections/{id}/products', {
    access: requires('catalog.collection.update'),
  }),
  reorderProducts: endpoint('POST', '/admin/catalog/collections/{id}/products/reorder', {
    access: requires('catalog.collection.update'),
  }),
  previewRules: endpoint('POST', '/admin/collections/rules/preview', {
    access: requires('catalog.collection.update'),
  }),
  evaluate: endpoint('POST', '/admin/collections/{id}/evaluate', {
    access: requires('catalog.collection.update'),
  }),
} as const;
