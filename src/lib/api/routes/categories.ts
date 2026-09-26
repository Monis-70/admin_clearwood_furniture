import { endpoint, requires } from '../endpoint';

export const categoriesRoutes = {
  list: endpoint('GET', '/admin/catalog/categories', {
    access: requires('catalog.category.read'),
  }),
  get: endpoint('GET', '/admin/catalog/categories/{id}', {
    access: requires('catalog.category.read'),
  }),
  create: endpoint('POST', '/admin/catalog/categories', {
    access: requires('catalog.category.create'),
    idempotent: true,
  }),
  update: endpoint('PATCH', '/admin/catalog/categories/{id}', {
    access: requires('catalog.category.update'),
  }),
  remove: endpoint('DELETE', '/admin/catalog/categories/{id}', {
    access: requires('catalog.category.delete'),
  }),
  deleteImpact: endpoint('GET', '/admin/catalog/categories/{id}/delete-impact', {
    access: requires('catalog.category.delete'),
  }),
  move: endpoint('POST', '/admin/catalog/categories/{id}/move', {
    access: requires('catalog.category.reorder'),
  }),
  reorder: endpoint('POST', '/admin/catalog/categories/reorder', {
    access: requires('catalog.category.reorder'),
  }),
  bulk: endpoint('POST', '/admin/catalog/categories/bulk', {
    access: requires('catalog.category.update'),
  }),
  restore: endpoint('POST', '/admin/catalog/categories/{id}/restore', {
    access: requires('catalog.category.update'),
  }),
  redirects: endpoint('GET', '/admin/catalog/categories/{id}/redirects', {
    access: requires('catalog.category.read'),
  }),
  products: endpoint('GET', '/admin/catalog/categories/{id}/products', {
    access: requires('catalog.category.read'),
  }),
  reorderProducts: endpoint('POST', '/admin/catalog/categories/{id}/products/reorder', {
    access: requires('catalog.category.reorder'),
  }),
  attributes: endpoint('GET', '/admin/catalog/categories/{id}/attributes', {
    access: requires('catalog.attribute.read'),
  }),
  linkAttribute: endpoint('POST', '/admin/catalog/categories/{id}/attributes', {
    access: requires('catalog.attribute.update'),
  }),
  unlinkAttribute: endpoint('DELETE', '/admin/catalog/categories/{id}/attributes/{attributeId}', {
    access: requires('catalog.attribute.update'),
  }),
} as const;
