import { endpoint, requires } from '../endpoint';

export const priceAdjustmentsRoutes = {
  list: endpoint('GET', '/admin/catalog/price-adjustments', {
    access: requires('pricing.adjustment.read'),
  }),
  conflicts: endpoint('GET', '/admin/catalog/price-adjustments/conflicts', {
    access: requires('pricing.adjustment.read'),
  }),
  create: endpoint('POST', '/admin/catalog/price-adjustments', {
    access: requires('pricing.adjustment.create'),
  }),
  update: endpoint('PATCH', '/admin/catalog/price-adjustments/{id}', {
    access: requires('pricing.adjustment.update'),
  }),
  remove: endpoint('DELETE', '/admin/catalog/price-adjustments/{id}', {
    access: requires('pricing.adjustment.delete'),
  }),
} as const;
