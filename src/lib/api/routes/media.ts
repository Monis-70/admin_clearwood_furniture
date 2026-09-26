import { PUBLIC, endpoint, requires } from '../endpoint';

export const mediaRoutes = {
  list: endpoint('GET', '/admin/media', { access: requires('media.asset.read') }),
  config: endpoint('GET', '/admin/media/config', { access: requires('media.asset.read') }),
  get: endpoint('GET', '/admin/media/{id}', { access: requires('media.asset.read') }),
  update: endpoint('PATCH', '/admin/media/{id}', { access: requires('media.asset.update') }),
  upload: endpoint('POST', '/admin/media/upload', {
    access: requires('media.asset.upload'),
    long: true,
  }),
  replace: endpoint('POST', '/admin/media/{id}/replace', {
    access: requires('media.asset.update'),
    long: true,
  }),
  reprocess: endpoint('POST', '/admin/media/{id}/reprocess', {
    access: requires('media.asset.update'),
  }),
  remove: endpoint('DELETE', '/admin/media/{id}', { access: requires('media.asset.delete') }),
  restore: endpoint('POST', '/admin/media/{id}/restore', {
    access: requires('media.asset.delete'),
  }),
  removePermanently: endpoint('DELETE', '/admin/media/{id}/permanent', {
    access: requires('media.asset.delete'),
  }),
  bulkRemove: endpoint('POST', '/admin/media/bulk-delete', {
    access: requires('media.asset.delete'),
  }),
  folders: endpoint('GET', '/admin/media-folders', { access: requires('media.asset.read') }),
  createFolder: endpoint('POST', '/admin/media-folders', {
    access: requires('media.asset.update'),
  }),
  updateFolder: endpoint('PATCH', '/admin/media-folders/{id}', {
    access: requires('media.asset.update'),
  }),
  removeFolder: endpoint('DELETE', '/admin/media-folders/{id}', {
    access: requires('media.asset.delete'),
  }),
  productMedia: endpoint('GET', '/admin/products/{productId}/media', {
    access: requires('catalog.product.update'),
  }),
  attachProductMedia: endpoint('POST', '/admin/products/{productId}/media', {
    access: requires('catalog.product.update'),
  }),
  updateProductMedia: endpoint('PATCH', '/admin/products/{productId}/media/{id}', {
    access: requires('catalog.product.update'),
  }),
  reorderProductMedia: endpoint('PATCH', '/admin/products/{productId}/media/reorder', {
    access: requires('catalog.product.update'),
  }),
  removeProductMedia: endpoint('DELETE', '/admin/products/{productId}/media/{id}', {
    access: requires('catalog.product.update'),
  }),
  /** The storefront gallery resolver, used for "What customers see" on live products. */
  publicGallery: endpoint('GET', '/catalog/products/{slug}/gallery', { access: PUBLIC }),
} as const;
