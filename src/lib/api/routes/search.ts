import { PUBLIC, endpoint, requires } from '../endpoint';

export const searchRoutes = {
  /** Storefront search: every call is logged as a customer search (Search insights). */
  storefrontSearch: endpoint('GET', '/search', { access: PUBLIC }),
  analytics: endpoint('GET', '/admin/search/analytics', {
    access: requires('catalog.product.update'),
  }),
  synonyms: endpoint('GET', '/admin/search/synonyms', {
    access: requires('catalog.product.update'),
  }),
  createSynonym: endpoint('POST', '/admin/search/synonyms', {
    access: requires('catalog.product.update'),
  }),
  updateSynonym: endpoint('PATCH', '/admin/search/synonyms/{term}', {
    access: requires('catalog.product.update'),
  }),
  removeSynonym: endpoint('DELETE', '/admin/search/synonyms/{term}', {
    access: requires('catalog.product.update'),
  }),
  jobs: endpoint('GET', '/admin/search/jobs', { access: requires('catalog.product.update') }),
  job: endpoint('GET', '/admin/search/jobs/{id}', { access: requires('catalog.product.update') }),
  reindex: endpoint('POST', '/admin/search/reindex', {
    access: requires('catalog.product.update'),
    long: true,
  }),
  recomputePopularity: endpoint('POST', '/admin/search/popularity/recompute', {
    access: requires('catalog.product.update'),
    long: true,
  }),
  productDocument: endpoint('GET', '/admin/catalog/products/{id}/search-document', {
    access: requires('catalog.product.read'),
  }),
} as const;
