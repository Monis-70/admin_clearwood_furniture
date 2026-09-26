import { SESSION, endpoint, requires } from '../endpoint';

export const importExportRoutes = {
  exportCsv: endpoint('GET', '/admin/catalog/export/{entity}', {
    access: requires('catalog.product.export'),
    long: true,
  }),
  template: endpoint('GET', '/admin/catalog/import/templates/{entity}', {
    access: requires('catalog.product.import'),
  }),
  upload: endpoint('POST', '/admin/catalog/import/{entity}', { access: SESSION, long: true }),
  jobs: endpoint('GET', '/admin/catalog/import/jobs', {
    access: requires('catalog.product.import'),
  }),
  job: endpoint('GET', '/admin/catalog/import/jobs/{id}', {
    access: requires('catalog.product.import'),
  }),
  commit: endpoint('POST', '/admin/catalog/import/jobs/{id}/commit', {
    access: SESSION,
    idempotent: true,
    long: true,
  }),
} as const;
