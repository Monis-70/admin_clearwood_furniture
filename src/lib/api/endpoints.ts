import { PUBLIC, SESSION, endpoint, requires } from './endpoint';

/**
 * The single registry of API operations the admin calls. Paths are written once, here; feature
 * API modules reference these definitions and never spell a path themselves.
 * `npm run coverage:check` verifies every entry against the pinned backend route inventory
 * (method, path, auth, permissions, CSRF, idempotency) and src/config/api-coverage.ts.
 */
export const endpoints = {
  auth: {
    login: endpoint('POST', '/admin/auth/login', { access: PUBLIC }),
    refresh: endpoint('POST', '/admin/auth/refresh', { access: PUBLIC }),
    logout: endpoint('POST', '/admin/auth/logout', { access: SESSION, renewSession: false }),
    logoutAll: endpoint('POST', '/admin/auth/logout-all', { access: SESSION }),
    me: endpoint('GET', '/admin/auth/me', { access: SESSION }),
    changePassword: endpoint('POST', '/admin/auth/change-password', { access: SESSION }),
    sessions: endpoint('GET', '/admin/auth/sessions', { access: SESSION }),
    endSession: endpoint('DELETE', '/admin/auth/sessions/{id}', { access: SESSION }),
  },
  users: {
    list: endpoint('GET', '/admin/users', { access: requires('system.user.read') }),
    create: endpoint('POST', '/admin/users', { access: requires('system.user.create') }),
    update: endpoint('PATCH', '/admin/users/{id}', { access: requires('system.user.update') }),
    remove: endpoint('DELETE', '/admin/users/{id}', { access: requires('system.user.delete') }),
    setRoles: endpoint('POST', '/admin/users/{id}/roles', {
      access: requires('system.user.update', 'system.role.read'),
    }),
    setPassword: endpoint('POST', '/admin/users/{id}/password', {
      access: requires('system.user.update'),
    }),
  },
  roles: {
    list: endpoint('GET', '/admin/roles', { access: requires('system.role.read') }),
    get: endpoint('GET', '/admin/roles/{id}', { access: requires('system.role.read') }),
    create: endpoint('POST', '/admin/roles', { access: requires('system.role.create') }),
    update: endpoint('PATCH', '/admin/roles/{id}', { access: requires('system.role.update') }),
    remove: endpoint('DELETE', '/admin/roles/{id}', { access: requires('system.role.delete') }),
    permissions: endpoint('GET', '/admin/permissions', { access: requires('system.role.read') }),
  },
  audit: {
    list: endpoint('GET', '/admin/audit-logs', { access: requires('system.audit.read') }),
  },
  catalog: {
    settings: endpoint('GET', '/admin/catalog/settings', {
      access: requires('catalog.product.read'),
    }),
    updateSettings: endpoint('PUT', '/admin/catalog/settings', {
      access: requires('catalog.product.update'),
    }),
    products: endpoint('GET', '/admin/catalog/products', {
      access: requires('catalog.product.read'),
    }),
    categoryTree: endpoint('GET', '/admin/catalog/categories/tree', {
      access: requires('catalog.category.read'),
    }),
    collections: endpoint('GET', '/admin/catalog/collections', {
      access: requires('catalog.collection.read'),
    }),
    lowStock: endpoint('GET', '/admin/catalog/inventory/low-stock', {
      access: requires('catalog.inventory.read'),
    }),
  },
  products: {
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
  },
  variants: {
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
  },
  inventory: {
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
  },
  categories: {
    list: endpoint('GET', '/admin/catalog/categories', {
      access: requires('catalog.category.read'),
    }),
    get: endpoint('GET', '/admin/catalog/categories/{id}', {
      access: requires('catalog.category.read'),
    }),
    create: endpoint('POST', '/admin/catalog/categories', {
      access: requires('catalog.category.create'),
      idempotent: true,
    }),
    update: endpoint('PATCH', '/admin/catalog/categories/{id}', {
      access: requires('catalog.category.update'),
    }),
    remove: endpoint('DELETE', '/admin/catalog/categories/{id}', {
      access: requires('catalog.category.delete'),
    }),
    deleteImpact: endpoint('GET', '/admin/catalog/categories/{id}/delete-impact', {
      access: requires('catalog.category.delete'),
    }),
    move: endpoint('POST', '/admin/catalog/categories/{id}/move', {
      access: requires('catalog.category.reorder'),
    }),
    reorder: endpoint('POST', '/admin/catalog/categories/reorder', {
      access: requires('catalog.category.reorder'),
    }),
    bulk: endpoint('POST', '/admin/catalog/categories/bulk', {
      access: requires('catalog.category.update'),
    }),
    restore: endpoint('POST', '/admin/catalog/categories/{id}/restore', {
      access: requires('catalog.category.update'),
    }),
    redirects: endpoint('GET', '/admin/catalog/categories/{id}/redirects', {
      access: requires('catalog.category.read'),
    }),
    products: endpoint('GET', '/admin/catalog/categories/{id}/products', {
      access: requires('catalog.category.read'),
    }),
    reorderProducts: endpoint('POST', '/admin/catalog/categories/{id}/products/reorder', {
      access: requires('catalog.category.reorder'),
    }),
    attributes: endpoint('GET', '/admin/catalog/categories/{id}/attributes', {
      access: requires('catalog.attribute.read'),
    }),
    linkAttribute: endpoint('POST', '/admin/catalog/categories/{id}/attributes', {
      access: requires('catalog.attribute.update'),
    }),
    unlinkAttribute: endpoint('DELETE', '/admin/catalog/categories/{id}/attributes/{attributeId}', {
      access: requires('catalog.attribute.update'),
    }),
  },
  attributes: {
    groups: endpoint('GET', '/admin/catalog/attribute-groups', {
      access: requires('catalog.attribute.read'),
    }),
    createGroup: endpoint('POST', '/admin/catalog/attribute-groups', {
      access: requires('catalog.attribute.create'),
    }),
    updateGroup: endpoint('PATCH', '/admin/catalog/attribute-groups/{id}', {
      access: requires('catalog.attribute.update'),
    }),
    removeGroup: endpoint('DELETE', '/admin/catalog/attribute-groups/{id}', {
      access: requires('catalog.attribute.delete'),
    }),
    list: endpoint('GET', '/admin/catalog/attributes', {
      access: requires('catalog.attribute.read'),
    }),
    get: endpoint('GET', '/admin/catalog/attributes/{id}', {
      access: requires('catalog.attribute.read'),
    }),
    create: endpoint('POST', '/admin/catalog/attributes', {
      access: requires('catalog.attribute.create'),
    }),
    update: endpoint('PATCH', '/admin/catalog/attributes/{id}', {
      access: requires('catalog.attribute.update'),
    }),
    remove: endpoint('DELETE', '/admin/catalog/attributes/{id}', {
      access: requires('catalog.attribute.delete'),
    }),
    reorder: endpoint('POST', '/admin/catalog/attributes/reorder', {
      access: requires('catalog.attribute.update'),
    }),
    createValue: endpoint('POST', '/admin/catalog/attributes/{id}/values', {
      access: requires('catalog.attribute.update'),
    }),
    updateValue: endpoint('PATCH', '/admin/catalog/attribute-values/{valueId}', {
      access: requires('catalog.attribute.update'),
    }),
    removeValue: endpoint('DELETE', '/admin/catalog/attribute-values/{valueId}', {
      access: requires('catalog.attribute.delete'),
    }),
  },
  brands: {
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
  },
  taxClasses: {
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
  },
  collections: {
    get: endpoint('GET', '/admin/catalog/collections/{id}', {
      access: requires('catalog.collection.read'),
    }),
    create: endpoint('POST', '/admin/catalog/collections', {
      access: requires('catalog.collection.create'),
    }),
    update: endpoint('PATCH', '/admin/catalog/collections/{id}', {
      access: requires('catalog.collection.update'),
    }),
    remove: endpoint('DELETE', '/admin/catalog/collections/{id}', {
      access: requires('catalog.collection.delete'),
    }),
    restore: endpoint('POST', '/admin/catalog/collections/{id}/restore', {
      access: requires('catalog.collection.update'),
    }),
    setProducts: endpoint('PUT', '/admin/catalog/collections/{id}/products', {
      access: requires('catalog.collection.update'),
    }),
    reorderProducts: endpoint('POST', '/admin/catalog/collections/{id}/products/reorder', {
      access: requires('catalog.collection.update'),
    }),
    previewRules: endpoint('POST', '/admin/collections/rules/preview', {
      access: requires('catalog.collection.update'),
    }),
    evaluate: endpoint('POST', '/admin/collections/{id}/evaluate', {
      access: requires('catalog.collection.update'),
    }),
  },
  priceAdjustments: {
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
  },
  pricing: {
    settings: endpoint('GET', '/admin/pricing/settings', { access: requires('pricing.tax.read') }),
    updateSettings: endpoint('PUT', '/admin/pricing/settings', {
      access: requires('pricing.tax.update'),
    }),
    simulate: endpoint('POST', '/admin/pricing/simulate', {
      access: requires('pricing.adjustment.read'),
    }),
    explain: endpoint('GET', '/admin/pricing/explain/{id}', {
      access: requires('pricing.adjustment.read'),
    }),
    tierPrices: endpoint('GET', '/admin/pricing/tier-prices', {
      access: requires('pricing.adjustment.read'),
    }),
    createTierPrice: endpoint('POST', '/admin/pricing/tier-prices', {
      access: requires('pricing.adjustment.create'),
    }),
    updateTierPrice: endpoint('PATCH', '/admin/pricing/tier-prices/{id}', {
      access: requires('pricing.adjustment.update'),
    }),
    removeTierPrice: endpoint('DELETE', '/admin/pricing/tier-prices/{id}', {
      access: requires('pricing.adjustment.delete'),
    }),
    priceLists: endpoint('GET', '/admin/pricing/price-lists', {
      access: requires('pricing.adjustment.read'),
    }),
    createPriceList: endpoint('POST', '/admin/pricing/price-lists', {
      access: requires('pricing.adjustment.create'),
      idempotent: true,
    }),
    updatePriceList: endpoint('PATCH', '/admin/pricing/price-lists/{id}', {
      access: requires('pricing.adjustment.update'),
    }),
    removePriceList: endpoint('DELETE', '/admin/pricing/price-lists/{id}', {
      access: requires('pricing.adjustment.delete'),
    }),
    priceListItems: endpoint('GET', '/admin/pricing/price-lists/{id}/items', {
      access: requires('pricing.adjustment.read'),
    }),
    setPriceListItems: endpoint('PUT', '/admin/pricing/price-lists/{id}/items', {
      access: requires('pricing.adjustment.update'),
    }),
    discountRules: endpoint('GET', '/admin/pricing/discount-rules', {
      access: requires('pricing.adjustment.read'),
    }),
    createDiscountRule: endpoint('POST', '/admin/pricing/discount-rules', {
      access: requires('pricing.adjustment.create'),
    }),
    updateDiscountRule: endpoint('PATCH', '/admin/pricing/discount-rules/{id}', {
      access: requires('pricing.adjustment.update'),
    }),
    removeDiscountRule: endpoint('DELETE', '/admin/pricing/discount-rules/{id}', {
      access: requires('pricing.adjustment.delete'),
    }),
    evaluateDiscountRules: endpoint('POST', '/admin/pricing/discount-rules/evaluate', {
      access: requires('pricing.adjustment.read'),
    }),
    coupons: endpoint('GET', '/admin/pricing/coupons', { access: requires('pricing.coupon.read') }),
    coupon: endpoint('GET', '/admin/pricing/coupons/{id}', {
      access: requires('pricing.coupon.read'),
    }),
    couponRedemptions: endpoint('GET', '/admin/pricing/coupons/{id}/redemptions', {
      access: requires('pricing.coupon.read'),
    }),
    createCoupon: endpoint('POST', '/admin/pricing/coupons', {
      access: requires('pricing.coupon.create'),
      idempotent: true,
    }),
    generateCoupons: endpoint('POST', '/admin/pricing/coupons/bulk-generate', {
      access: requires('pricing.coupon.create'),
      idempotent: true,
    }),
    updateCoupon: endpoint('PATCH', '/admin/pricing/coupons/{id}', {
      access: requires('pricing.coupon.update'),
    }),
    removeCoupon: endpoint('DELETE', '/admin/pricing/coupons/{id}', {
      access: requires('pricing.coupon.delete'),
    }),
    customerGroups: endpoint('GET', '/admin/pricing/customer-groups', {
      access: requires('order.customer.read'),
    }),
    createCustomerGroup: endpoint('POST', '/admin/pricing/customer-groups', {
      access: requires('order.customer.update'),
      idempotent: true,
    }),
    updateCustomerGroup: endpoint('PATCH', '/admin/pricing/customer-groups/{id}', {
      access: requires('order.customer.update'),
    }),
    removeCustomerGroup: endpoint('DELETE', '/admin/pricing/customer-groups/{id}', {
      access: requires('order.customer.update'),
    }),
    groupMembers: endpoint('GET', '/admin/pricing/customer-groups/{id}/members', {
      access: requires('order.customer.read'),
    }),
    addGroupMembers: endpoint('POST', '/admin/pricing/customer-groups/{id}/members', {
      access: requires('order.customer.update'),
    }),
    removeGroupMembers: endpoint('DELETE', '/admin/pricing/customer-groups/{id}/members', {
      access: requires('order.customer.update'),
    }),
    zones: endpoint('GET', '/admin/pricing/shipping-zones', {
      access: requires('pricing.tax.read'),
    }),
    createZone: endpoint('POST', '/admin/pricing/shipping-zones', {
      access: requires('pricing.tax.update'),
    }),
    updateZone: endpoint('PATCH', '/admin/pricing/shipping-zones/{id}', {
      access: requires('pricing.tax.update'),
    }),
    removeZone: endpoint('DELETE', '/admin/pricing/shipping-zones/{id}', {
      access: requires('pricing.tax.update'),
    }),
    importPincodes: endpoint('POST', '/admin/pricing/shipping-zones/{id}/pincodes/import', {
      access: requires('pricing.tax.update'),
      long: true,
    }),
    rates: endpoint('GET', '/admin/pricing/shipping-rates', {
      access: requires('pricing.tax.read'),
    }),
    createRate: endpoint('POST', '/admin/pricing/shipping-rates', {
      access: requires('pricing.tax.update'),
    }),
    updateRate: endpoint('PATCH', '/admin/pricing/shipping-rates/{id}', {
      access: requires('pricing.tax.update'),
    }),
    removeRate: endpoint('DELETE', '/admin/pricing/shipping-rates/{id}', {
      access: requires('pricing.tax.update'),
    }),
    pincodes: endpoint('GET', '/admin/pricing/shipping-pincodes', {
      access: requires('pricing.tax.read'),
    }),
    createPincode: endpoint('POST', '/admin/pricing/shipping-pincodes', {
      access: requires('pricing.tax.update'),
    }),
    removePincode: endpoint('DELETE', '/admin/pricing/shipping-pincodes/{id}', {
      access: requires('pricing.tax.update'),
    }),
    createPincodeRange: endpoint('POST', '/admin/pricing/shipping-pincode-ranges', {
      access: requires('pricing.tax.update'),
    }),
  },
  importExport: {
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
  },
  media: {
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
  },
  content: {
    pages: endpoint('GET', '/admin/cms/pages', { access: requires('cms.page.read') }),
    banners: endpoint('GET', '/admin/cms/banners', { access: requires('cms.banner.read') }),
  },
  enquiries: {
    list: endpoint('GET', '/admin/enquiries', { access: requires('lead.enquiry.read') }),
    get: endpoint('GET', '/admin/enquiries/{id}', { access: requires('lead.enquiry.read') }),
  },
  system: {
    version: endpoint('GET', '/version', { access: PUBLIC }),
    health: endpoint('GET', '/health', { access: PUBLIC, base: 'root' }),
    ready: endpoint('GET', '/ready', { access: PUBLIC, base: 'root' }),
  },
} as const;
