import { endpoint, requires } from '../endpoint';

export const productsRoutes = {
  get: endpoint('GET', '/admin/catalog/products/{id}', {
    access: requires('catalog.product.read'),
  }),
  create: endpoint('POST', '/admin/catalog/products', {
    access: requires('catalog.product.create'),
    idempotent: true,
  }),
  update: endpoint('PATCH', '/admin/catalog/products/{id}', {
    access: requires('catalog.product.update'),
  }),
  remove: endpoint('DELETE', '/admin/catalog/products/{id}', {
    access: requires('catalog.product.delete'),
  }),
  restore: endpoint('POST', '/admin/catalog/products/{id}/restore', {
    access: requires('catalog.product.update'),
  }),
  duplicate: endpoint('POST', '/admin/catalog/products/{id}/duplicate', {
    access: requires('catalog.product.create'),
    idempotent: true,
  }),
  publish: endpoint('POST', '/admin/catalog/products/{id}/publish', {
    access: requires('catalog.product.publish'),
  }),
  unpublish: endpoint('POST', '/admin/catalog/products/{id}/unpublish', {
    access: requires('catalog.product.publish'),
  }),
  blockers: endpoint('GET', '/admin/catalog/products/{id}/publish-blockers', {
    access: requires('catalog.product.read'),
  }),
  redirects: endpoint('GET', '/admin/catalog/products/{id}/redirects', {
    access: requires('catalog.product.read'),
  }),
  setCategories: endpoint('PUT', '/admin/catalog/products/{id}/categories', {
    access: requires('catalog.product.update'),
  }),
  setAttributeValues: endpoint('PUT', '/admin/catalog/products/{id}/attribute-values', {
    access: requires('catalog.product.update'),
  }),
  setRelations: endpoint('PUT', '/admin/catalog/products/{id}/relations', {
    access: requires('catalog.product.update'),
  }),
  bulk: endpoint('POST', '/admin/catalog/bulk', {
    access: requires('catalog.product.read'),
    idempotent: true,
  }),
} as const;
