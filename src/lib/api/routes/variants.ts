import { endpoint, requires } from '../endpoint';

export const variantsRoutes = {
  list: endpoint('GET', '/admin/catalog/products/{id}/variants', {
    access: requires('catalog.variant.read'),
  }),
  create: endpoint('POST', '/admin/catalog/products/{id}/variants', {
    access: requires('catalog.variant.create'),
  }),
  update: endpoint('PATCH', '/admin/catalog/products/{id}/variants/{variantId}', {
    access: requires('catalog.variant.update'),
  }),
  remove: endpoint('DELETE', '/admin/catalog/products/{id}/variants/{variantId}', {
    access: requires('catalog.variant.delete'),
  }),
  setDefault: endpoint('POST', '/admin/catalog/products/{id}/variants/{variantId}/set-default', {
    access: requires('catalog.variant.update'),
  }),
  reorder: endpoint('POST', '/admin/catalog/products/{id}/variants/reorder', {
    access: requires('catalog.variant.update'),
  }),
  matrixPreview: endpoint('POST', '/admin/catalog/products/{id}/variants/matrix/preview', {
    access: requires('catalog.variant.read'),
  }),
  matrixGenerate: endpoint('POST', '/admin/catalog/products/{id}/variants/matrix/generate', {
    access: requires('catalog.variant.create'),
    idempotent: true,
  }),
} as const;
