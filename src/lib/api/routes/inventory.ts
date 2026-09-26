import { endpoint, requires } from '../endpoint';

export const inventoryRoutes = {
  history: endpoint('GET', '/admin/catalog/variants/{id}/inventory', {
    access: requires('catalog.inventory.read'),
  }),
  snapshot: endpoint('GET', '/admin/catalog/variants/{id}/inventory/snapshot', {
    access: requires('catalog.inventory.read'),
  }),
  adjust: endpoint('POST', '/admin/catalog/variants/{id}/inventory/adjust', {
    access: requires('catalog.inventory.update'),
    idempotent: true,
  }),
  bulkAdjust: endpoint('POST', '/admin/catalog/inventory/bulk-adjust', {
    access: requires('catalog.inventory.update'),
    idempotent: true,
  }),
} as const;
