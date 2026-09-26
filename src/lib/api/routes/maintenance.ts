import { endpoint, requires } from '../endpoint';

export const maintenanceRoutes = {
  evaluateAllCollections: endpoint('POST', '/admin/collections/evaluate-all', {
    access: requires('catalog.collection.update'),
    long: true,
  }),
  storageReport: endpoint('GET', '/admin/media/gc', {
    access: requires('media.asset.delete'),
    long: true,
  }),
} as const;
