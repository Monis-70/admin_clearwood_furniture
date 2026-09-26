import { endpoint, requires } from '../endpoint';

export const brandsRoutes = {
  list: endpoint('GET', '/admin/catalog/brands', { access: requires('catalog.product.read') }),
  create: endpoint('POST', '/admin/catalog/brands', {
    access: requires('catalog.product.create'),
  }),
  update: endpoint('PATCH', '/admin/catalog/brands/{id}', {
    access: requires('catalog.product.update'),
  }),
  remove: endpoint('DELETE', '/admin/catalog/brands/{id}', {
    access: requires('catalog.product.delete'),
  }),
} as const;
