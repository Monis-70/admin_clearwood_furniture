import { endpoint, requires } from '../endpoint';

export const taxClassesRoutes = {
  list: endpoint('GET', '/admin/catalog/tax-classes', { access: requires('pricing.tax.read') }),
  create: endpoint('POST', '/admin/catalog/tax-classes', {
    access: requires('pricing.tax.update'),
  }),
  update: endpoint('PATCH', '/admin/catalog/tax-classes/{id}', {
    access: requires('pricing.tax.update'),
  }),
  remove: endpoint('DELETE', '/admin/catalog/tax-classes/{id}', {
    access: requires('pricing.tax.update'),
  }),
} as const;
