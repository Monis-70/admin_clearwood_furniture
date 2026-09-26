import { endpoint, requires } from '../endpoint';

export const contentRoutes = {
  pages: endpoint('GET', '/admin/cms/pages', { access: requires('cms.page.read') }),
  createPage: endpoint('POST', '/admin/cms/pages', { access: requires('cms.page.create') }),
  page: endpoint('GET', '/admin/cms/pages/{id}', { access: requires('cms.page.read') }),
  updatePage: endpoint('PATCH', '/admin/cms/pages/{id}', { access: requires('cms.page.update') }),
  removePage: endpoint('DELETE', '/admin/cms/pages/{id}', {
    access: requires('cms.page.delete'),
  }),
  publishPage: endpoint('POST', '/admin/cms/pages/{id}/publish', {
    access: requires('cms.page.update'),
  }),
  unpublishPage: endpoint('POST', '/admin/cms/pages/{id}/unpublish', {
    access: requires('cms.page.update'),
  }),
  schedulePage: endpoint('POST', '/admin/cms/pages/{id}/schedule', {
    access: requires('cms.page.update'),
  }),
  duplicatePage: endpoint('POST', '/admin/cms/pages/{id}/duplicate', {
    access: requires('cms.page.create'),
  }),
  previewPage: endpoint('POST', '/admin/cms/pages/{id}/preview', {
    access: requires('cms.page.read'),
  }),
  revisions: endpoint('GET', '/admin/cms/pages/{id}/revisions', {
    access: requires('cms.page.read'),
  }),
  restoreRevision: endpoint('POST', '/admin/cms/pages/{id}/revisions/{version}/restore', {
    access: requires('cms.page.update'),
  }),
  addBlock: endpoint('POST', '/admin/cms/pages/{id}/blocks', {
    access: requires('cms.page.update'),
  }),
  updateBlock: endpoint('PATCH', '/admin/cms/pages/{id}/blocks/{blockId}', {
    access: requires('cms.page.update'),
  }),
  removeBlock: endpoint('DELETE', '/admin/cms/pages/{id}/blocks/{blockId}', {
    access: requires('cms.page.update'),
  }),
  reorderBlocks: endpoint('POST', '/admin/cms/pages/{id}/blocks/reorder', {
    access: requires('cms.page.update'),
  }),
  blockTypes: endpoint('GET', '/admin/cms/block-types', { access: requires('cms.page.read') }),
  seoPreview: endpoint('GET', '/admin/seo/preview/{type}/{id}', {
    access: requires('cms.page.read'),
  }),
  rebuildSitemap: endpoint('POST', '/admin/seo/sitemap/rebuild', {
    access: requires('cms.page.update'),
    long: true,
  }),
  banners: endpoint('GET', '/admin/cms/banners', { access: requires('cms.banner.read') }),
  createBanner: endpoint('POST', '/admin/cms/banners', { access: requires('cms.banner.create') }),
  updateBanner: endpoint('PATCH', '/admin/cms/banners/{id}', {
    access: requires('cms.banner.update'),
  }),
  removeBanner: endpoint('DELETE', '/admin/cms/banners/{id}', {
    access: requires('cms.banner.delete'),
  }),
  reorderBanners: endpoint('POST', '/admin/cms/banners/reorder', {
    access: requires('cms.banner.update'),
  }),
  bannerStats: endpoint('GET', '/admin/cms/banners/{id}/stats', {
    access: requires('cms.banner.read'),
  }),
  announcements: endpoint('GET', '/admin/cms/announcements', {
    access: requires('cms.banner.read'),
  }),
  createAnnouncement: endpoint('POST', '/admin/cms/announcements', {
    access: requires('cms.banner.create'),
  }),
  updateAnnouncement: endpoint('PATCH', '/admin/cms/announcements/{id}', {
    access: requires('cms.banner.update'),
  }),
  removeAnnouncement: endpoint('DELETE', '/admin/cms/announcements/{id}', {
    access: requires('cms.banner.delete'),
  }),
  faqs: endpoint('GET', '/admin/cms/faqs', { access: requires('cms.faq.read') }),
  createFaq: endpoint('POST', '/admin/cms/faqs', { access: requires('cms.faq.create') }),
  updateFaq: endpoint('PATCH', '/admin/cms/faqs/{id}', { access: requires('cms.faq.update') }),
  removeFaq: endpoint('DELETE', '/admin/cms/faqs/{id}', { access: requires('cms.faq.delete') }),
  reorderFaqs: endpoint('POST', '/admin/cms/faqs/reorder', {
    access: requires('cms.faq.update'),
  }),
  faqCategories: endpoint('GET', '/admin/cms/faq-categories', {
    access: requires('cms.faq.read'),
  }),
  createFaqCategory: endpoint('POST', '/admin/cms/faq-categories', {
    access: requires('cms.faq.create'),
  }),
  updateFaqCategory: endpoint('PATCH', '/admin/cms/faq-categories/{id}', {
    access: requires('cms.faq.update'),
  }),
  removeFaqCategory: endpoint('DELETE', '/admin/cms/faq-categories/{id}', {
    access: requires('cms.faq.delete'),
  }),
  helpCategories: endpoint('GET', '/admin/cms/help/categories', {
    access: requires('cms.page.read'),
  }),
  createHelpCategory: endpoint('POST', '/admin/cms/help/categories', {
    access: requires('cms.page.create'),
  }),
  updateHelpCategory: endpoint('PATCH', '/admin/cms/help/categories/{id}', {
    access: requires('cms.page.update'),
  }),
  removeHelpCategory: endpoint('DELETE', '/admin/cms/help/categories/{id}', {
    access: requires('cms.page.delete'),
  }),
  helpArticles: endpoint('GET', '/admin/cms/help/articles', {
    access: requires('cms.page.read'),
  }),
  createHelpArticle: endpoint('POST', '/admin/cms/help/articles', {
    access: requires('cms.page.create'),
  }),
  updateHelpArticle: endpoint('PATCH', '/admin/cms/help/articles/{id}', {
    access: requires('cms.page.update'),
  }),
  removeHelpArticle: endpoint('DELETE', '/admin/cms/help/articles/{id}', {
    access: requires('cms.page.delete'),
  }),
  reorderHelpArticles: endpoint('POST', '/admin/cms/help/articles/reorder', {
    access: requires('cms.page.update'),
  }),
  testimonials: endpoint('GET', '/admin/cms/testimonials', {
    access: requires('cms.page.read'),
  }),
  createTestimonial: endpoint('POST', '/admin/cms/testimonials', {
    access: requires('cms.page.create'),
  }),
  updateTestimonial: endpoint('PATCH', '/admin/cms/testimonials/{id}', {
    access: requires('cms.page.update'),
  }),
  removeTestimonial: endpoint('DELETE', '/admin/cms/testimonials/{id}', {
    access: requires('cms.page.delete'),
  }),
  reorderTestimonials: endpoint('POST', '/admin/cms/testimonials/reorder', {
    access: requires('cms.page.update'),
  }),
  stores: endpoint('GET', '/admin/cms/stores', { access: requires('cms.page.read') }),
  createStore: endpoint('POST', '/admin/cms/stores', { access: requires('cms.page.create') }),
  updateStore: endpoint('PATCH', '/admin/cms/stores/{id}', {
    access: requires('cms.page.update'),
  }),
  removeStore: endpoint('DELETE', '/admin/cms/stores/{id}', {
    access: requires('cms.page.delete'),
  }),
  reorderStores: endpoint('POST', '/admin/cms/stores/reorder', {
    access: requires('cms.page.update'),
  }),
  menus: endpoint('GET', '/admin/navigation', { access: requires('cms.navigation.read') }),
  menu: endpoint('GET', '/admin/navigation/{key}', { access: requires('cms.navigation.read') }),
  addMenuItem: endpoint('POST', '/admin/navigation/{key}/items', {
    access: requires('cms.navigation.update'),
  }),
  updateMenuItem: endpoint('PATCH', '/admin/navigation/items/{id}', {
    access: requires('cms.navigation.update'),
  }),
  removeMenuItem: endpoint('DELETE', '/admin/navigation/items/{id}', {
    access: requires('cms.navigation.update'),
  }),
  reorderMenu: endpoint('POST', '/admin/navigation/{key}/reorder', {
    access: requires('cms.navigation.update'),
  }),
  settings: endpoint('GET', '/admin/content/settings', {
    access: requires('system.setting.read'),
  }),
  updateSettings: endpoint('PUT', '/admin/content/settings', {
    access: requires('system.setting.update'),
  }),
} as const;
