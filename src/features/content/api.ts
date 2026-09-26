import type { BlockCategory, BlockType } from '@shared/enums';

import { apiPage, apiRequest, type Page } from '@/lib/api/client';
import { contentRoutes } from '@/lib/api/routes/content';

/*
 * The CMS admin API. Most CMS routes answer with the stored rows (not typed in @clearwood/shared):
 * the interfaces below list the fields the screens use. JSON columns (`...Json`) arrive as strings.
 */

type PageStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';

/** `GET /admin/cms/pages` rows. */
export interface CmsPageRow {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: PageStatus;
  isSystem: boolean;
  noIndex: boolean;
  publishedAt: string | null;
  scheduledAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
}

export interface PageBlock {
  id: string;
  type: BlockType;
  position: number;
  isActive: boolean;
  deviceVisibility: string;
  config: Record<string, unknown>;
  rawConfig: unknown;
  startsAt: string | null;
  endsAt: string | null;
  anchorId: string | null;
  cssClass: string | null;
}

/** The page DTO every page and block route answers with. */
export interface CmsPage extends CmsPageRow {
  template: string | null;
  excerpt: string | null;
  heroMediaId: string | null;
  ogMediaId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  canonicalUrl: string | null;
  viewCount: number;
  version: number;
  blocks: PageBlock[];
}

export interface PageRevision {
  id: string;
  version: number;
  editedById: string | null;
  editedByName: string | null;
  note: string | null;
  createdAt: string;
}

/** `GET /admin/cms/block-types`: the shared block registry as JSON. */
export interface BlockTypeInfo {
  type: BlockType;
  label: string;
  description: string;
  category: BlockCategory;
  maxPerPage: number | null;
  defaultConfig: unknown;
  mediaFields: string[];
  referenceFields: Record<string, string[]>;
}

/** `details.blockers` of a 422 PAGE_NOT_PUBLISHABLE. */
export interface PublishBlocker {
  code: string;
  blockId?: string;
  blockType?: string;
  detail?: string;
}

export interface BannerRow {
  id: string;
  name: string;
  placement: string;
  mediaId: string | null;
  mobileMediaId: string | null;
  altText: string | null;
  headline: string | null;
  subheadline: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  ctaStyle: string | null;
  backgroundHex: string | null;
  textHex: string | null;
  isActive: boolean;
  deviceVisibility: string;
  position: number;
  startsAt: string | null;
  endsAt: string | null;
  targetCategoryIdsJson: string | null;
  targetCollectionIdsJson: string | null;
  impressionCount: number;
  clickCount: number;
  version: number;
  updatedAt: string;
}

export interface BannerStats {
  id: string;
  name: string;
  impressionCount: number;
  clickCount: number;
  clickThroughBp: number;
  daily: { entityType: string; dayKey: string; viewCount: number }[];
}

export interface AnnouncementRow {
  id: string;
  message: string;
  linkUrl: string | null;
  linkLabel: string | null;
  backgroundHex: string | null;
  textHex: string | null;
  isDismissible: boolean;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  position: number;
  deviceVisibility: string;
  version: number;
}

export interface FaqRow {
  id: string;
  faqCategoryId: string | null;
  question: string;
  answer: string;
  visibility: string;
  position: number;
  isActive: boolean;
  targetProductIdsJson: string | null;
  targetCategoryIdsJson: string | null;
  helpfulYes: number;
  helpfulNo: number;
  version: number;
}

export interface FaqCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconMediaId: string | null;
  position: number;
  isActive: boolean;
  version: number;
}

export interface HelpCategoryNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconMediaId: string | null;
  parentId: string | null;
  position: number;
  isActive: boolean;
  depth: number;
  version: number;
  children: HelpCategoryNode[];
}

export interface HelpArticleRow {
  id: string;
  helpCategoryId: string;
  slug: string;
  title: string;
  excerpt: string | null;
  bodyMarkdown: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  position: number;
  viewCount: number;
  helpfulYes: number;
  helpfulNo: number;
  relatedArticleIdsJson: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  version: number;
  updatedAt: string;
}

export interface TestimonialRow {
  id: string;
  authorName: string;
  authorLocation: string | null;
  authorRole: string | null;
  avatarMediaId: string | null;
  quote: string;
  ratingBp: number | null;
  productId: string | null;
  mediaIdsJson: string | null;
  isFeatured: boolean;
  position: number;
  isActive: boolean;
  capturedAt: string | null;
  version: number;
}

export interface OpeningHours {
  day: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
  opens: string;
  closes: string;
  closed: boolean;
}

export interface StoreRow {
  id: string;
  name: string;
  slug: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  phone: string | null;
  email: string | null;
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  openingHoursJson: string | null;
  mediaIdsJson: string | null;
  isActive: boolean;
  position: number;
  isFlagship: boolean;
  version: number;
}

export interface MenuRow {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
}

export interface MenuItemRow {
  id: string;
  menuId: string;
  parentId: string | null;
  label: string;
  type: 'CATEGORY' | 'COLLECTION' | 'URL' | 'LEAD_FORM' | 'PAGE';
  position: number;
  isActive: boolean;
  isHighlighted: boolean;
  badgeText: string | null;
  badgeColor: string | null;
  url: string | null;
  categoryId: string | null;
  collectionId: string | null;
  leadFormKey: string | null;
  iconMediaId: string | null;
  menuColumn: number | null;
  openInNewTab: boolean;
}

export type SiteSettings = Record<string, string | number | boolean | null>;

export interface PageListQuery {
  page: number;
  limit: number;
  sort?: string;
  order: 'asc' | 'desc';
  q?: string;
  status?: string;
  type?: string;
}

export interface BannerListQuery {
  page: number;
  limit: number;
  sort?: string;
  order: 'asc' | 'desc';
  placement?: string;
  isActive?: string;
}

/** Request bodies are the shared CMS schemas' inputs; dates travel as ISO strings. */
type Body = Record<string, unknown>;
export type ReorderInput = { order: { id: string; position: number }[] };

export const contentKeys = {
  all: ['content'] as const,
  pages: (query: PageListQuery) => [...contentKeys.all, 'pages', query] as const,
  page: (id: string) => [...contentKeys.all, 'page', id] as const,
  revisions: (id: string) => [...contentKeys.all, 'page', id, 'revisions'] as const,
  blockTypes: () => [...contentKeys.all, 'block-types'] as const,
  banners: (query: BannerListQuery) => [...contentKeys.all, 'banners', query] as const,
  bannerStats: (id: string) => [...contentKeys.all, 'banner-stats', id] as const,
  announcements: () => [...contentKeys.all, 'announcements'] as const,
  faqs: () => [...contentKeys.all, 'faqs'] as const,
  faqCategories: () => [...contentKeys.all, 'faq-categories'] as const,
  helpCategories: () => [...contentKeys.all, 'help-categories'] as const,
  helpArticles: () => [...contentKeys.all, 'help-articles'] as const,
  testimonials: () => [...contentKeys.all, 'testimonials'] as const,
  stores: () => [...contentKeys.all, 'stores'] as const,
  menus: () => [...contentKeys.all, 'menus'] as const,
  menu: (key: string) => [...contentKeys.all, 'menu', key] as const,
  settings: () => [...contentKeys.all, 'settings'] as const,
  seoPreview: (type: string, id: string) => [...contentKeys.all, 'seo', type, id] as const,
};

const e = contentRoutes;

export const contentApi = {
  /* ---------------------------------------------------------------- pages */
  pages(query: PageListQuery, signal?: AbortSignal): Promise<Page<CmsPageRow>> {
    return apiPage<CmsPageRow>(e.pages, { query: { ...query }, signal });
  },
  async page(id: string, signal?: AbortSignal) {
    return (await apiRequest(e.page, { params: { id }, signal })).data as CmsPage;
  },
  async createPage(body: Body) {
    return (await apiRequest(e.createPage, { body })).data as CmsPage;
  },
  async updatePage(id: string, body: Body) {
    return (await apiRequest(e.updatePage, { params: { id }, body })).data as CmsPage;
  },
  async removePage(id: string) {
    await apiRequest(e.removePage, { params: { id } });
  },
  async publishPage(id: string) {
    return (await apiRequest(e.publishPage, { params: { id } })).data as CmsPage;
  },
  async unpublishPage(id: string) {
    return (await apiRequest(e.unpublishPage, { params: { id } })).data as CmsPage;
  },
  async schedulePage(id: string, body: { scheduledAt: string; expiresAt: string | null }) {
    return (await apiRequest(e.schedulePage, { params: { id }, body })).data as CmsPage;
  },
  async duplicatePage(id: string, body: { slug: string; title: string }) {
    return (await apiRequest(e.duplicatePage, { params: { id }, body })).data as CmsPage;
  },
  async previewPage(id: string) {
    return (await apiRequest(e.previewPage, { params: { id } })).data as Record<string, unknown>;
  },
  async revisions(id: string, signal?: AbortSignal) {
    return (await apiRequest(e.revisions, { params: { id }, signal })).data as PageRevision[];
  },
  async restoreRevision(id: string, version: number) {
    return (await apiRequest(e.restoreRevision, { params: { id, version: String(version) } }))
      .data as CmsPage;
  },
  async blockTypes(signal?: AbortSignal) {
    return (await apiRequest(e.blockTypes, { signal })).data as BlockTypeInfo[];
  },
  async addBlock(id: string, body: Body) {
    return (await apiRequest(e.addBlock, { params: { id }, body })).data as CmsPage;
  },
  async updateBlock(id: string, blockId: string, body: Body) {
    return (await apiRequest(e.updateBlock, { params: { id, blockId }, body })).data as CmsPage;
  },
  async removeBlock(id: string, blockId: string) {
    return (await apiRequest(e.removeBlock, { params: { id, blockId } })).data as CmsPage;
  },
  async reorderBlocks(id: string, body: ReorderInput) {
    await apiRequest(e.reorderBlocks, { params: { id }, body });
  },
  async seoPreview(type: string, id: string, signal?: AbortSignal) {
    return (await apiRequest(e.seoPreview, { params: { type, id }, signal })).data as Record<
      string,
      unknown
    >;
  },
  async rebuildSitemap() {
    return (await apiRequest(e.rebuildSitemap)).data as { sections: Record<string, number> };
  },

  /* -------------------------------------------------------------- banners */
  banners(query: BannerListQuery, signal?: AbortSignal): Promise<Page<BannerRow>> {
    return apiPage<BannerRow>(e.banners, { query: { ...query }, signal });
  },
  async createBanner(body: Body) {
    return (await apiRequest(e.createBanner, { body })).data as BannerRow;
  },
  async updateBanner(id: string, body: Body) {
    return (await apiRequest(e.updateBanner, { params: { id }, body })).data as BannerRow;
  },
  async removeBanner(id: string) {
    await apiRequest(e.removeBanner, { params: { id } });
  },
  async reorderBanners(body: ReorderInput) {
    await apiRequest(e.reorderBanners, { body });
  },
  async bannerStats(id: string, signal?: AbortSignal) {
    return (await apiRequest(e.bannerStats, { params: { id }, signal })).data as BannerStats;
  },

  /* -------------------------------------------------------- announcements */
  async announcements(signal?: AbortSignal) {
    return (await apiRequest(e.announcements, { signal })).data as AnnouncementRow[];
  },
  async createAnnouncement(body: Body) {
    return (await apiRequest(e.createAnnouncement, { body })).data as AnnouncementRow;
  },
  async updateAnnouncement(id: string, body: Body) {
    return (await apiRequest(e.updateAnnouncement, { params: { id }, body }))
      .data as AnnouncementRow;
  },
  async removeAnnouncement(id: string) {
    await apiRequest(e.removeAnnouncement, { params: { id } });
  },

  /* ----------------------------------------------------------------- FAQs */
  async faqs(signal?: AbortSignal) {
    return (await apiRequest(e.faqs, { signal })).data as FaqRow[];
  },
  async createFaq(body: Body) {
    return (await apiRequest(e.createFaq, { body })).data as FaqRow;
  },
  async updateFaq(id: string, body: Body) {
    return (await apiRequest(e.updateFaq, { params: { id }, body })).data as FaqRow;
  },
  async removeFaq(id: string) {
    await apiRequest(e.removeFaq, { params: { id } });
  },
  async reorderFaqs(body: ReorderInput) {
    await apiRequest(e.reorderFaqs, { body });
  },
  async faqCategories(signal?: AbortSignal) {
    return (await apiRequest(e.faqCategories, { signal })).data as FaqCategoryRow[];
  },
  async createFaqCategory(body: Body) {
    return (await apiRequest(e.createFaqCategory, { body })).data as FaqCategoryRow;
  },
  async updateFaqCategory(id: string, body: Body) {
    return (await apiRequest(e.updateFaqCategory, { params: { id }, body })).data as FaqCategoryRow;
  },
  async removeFaqCategory(id: string) {
    await apiRequest(e.removeFaqCategory, { params: { id } });
  },

  /* ---------------------------------------------------------- help centre */
  async helpCategories(signal?: AbortSignal) {
    return (await apiRequest(e.helpCategories, { signal })).data as HelpCategoryNode[];
  },
  async createHelpCategory(body: Body) {
    return (await apiRequest(e.createHelpCategory, { body })).data as HelpCategoryNode;
  },
  async updateHelpCategory(id: string, body: Body) {
    return (await apiRequest(e.updateHelpCategory, { params: { id }, body }))
      .data as HelpCategoryNode;
  },
  async removeHelpCategory(id: string) {
    await apiRequest(e.removeHelpCategory, { params: { id } });
  },
  async helpArticles(signal?: AbortSignal) {
    return (await apiRequest(e.helpArticles, { signal })).data as HelpArticleRow[];
  },
  async createHelpArticle(body: Body) {
    return (await apiRequest(e.createHelpArticle, { body })).data as HelpArticleRow;
  },
  async updateHelpArticle(id: string, body: Body) {
    return (await apiRequest(e.updateHelpArticle, { params: { id }, body })).data as HelpArticleRow;
  },
  async removeHelpArticle(id: string) {
    await apiRequest(e.removeHelpArticle, { params: { id } });
  },
  async reorderHelpArticles(body: ReorderInput) {
    await apiRequest(e.reorderHelpArticles, { body });
  },

  /* --------------------------------------------------------- testimonials */
  async testimonials(signal?: AbortSignal) {
    return (await apiRequest(e.testimonials, { signal })).data as TestimonialRow[];
  },
  async createTestimonial(body: Body) {
    return (await apiRequest(e.createTestimonial, { body })).data as TestimonialRow;
  },
  async updateTestimonial(id: string, body: Body) {
    return (await apiRequest(e.updateTestimonial, { params: { id }, body })).data as TestimonialRow;
  },
  async removeTestimonial(id: string) {
    await apiRequest(e.removeTestimonial, { params: { id } });
  },
  async reorderTestimonials(body: ReorderInput) {
    await apiRequest(e.reorderTestimonials, { body });
  },

  /* --------------------------------------------------------------- stores */
  async stores(signal?: AbortSignal) {
    return (await apiRequest(e.stores, { signal })).data as StoreRow[];
  },
  async createStore(body: Body) {
    return (await apiRequest(e.createStore, { body })).data as StoreRow;
  },
  async updateStore(id: string, body: Body) {
    return (await apiRequest(e.updateStore, { params: { id }, body })).data as StoreRow;
  },
  async removeStore(id: string) {
    await apiRequest(e.removeStore, { params: { id } });
  },
  async reorderStores(body: ReorderInput) {
    await apiRequest(e.reorderStores, { body });
  },

  /* ----------------------------------------------------------- navigation */
  async menus(signal?: AbortSignal) {
    return (await apiRequest(e.menus, { signal })).data as MenuRow[];
  },
  async menu(key: string, signal?: AbortSignal) {
    return (await apiRequest(e.menu, { params: { key }, signal })).data as MenuRow & {
      items: MenuItemRow[];
    };
  },
  async addMenuItem(key: string, body: Body) {
    return (await apiRequest(e.addMenuItem, { params: { key }, body })).data as MenuItemRow;
  },
  async updateMenuItem(id: string, body: Body) {
    return (await apiRequest(e.updateMenuItem, { params: { id }, body })).data as MenuItemRow;
  },
  async removeMenuItem(id: string) {
    await apiRequest(e.removeMenuItem, { params: { id } });
  },
  async reorderMenu(key: string, body: ReorderInput) {
    await apiRequest(e.reorderMenu, { params: { key }, body });
  },

  /* -------------------------------------------------------- site settings */
  async settings(signal?: AbortSignal) {
    return (await apiRequest(e.settings, { signal })).data as SiteSettings;
  },
  async updateSettings(body: SiteSettings) {
    return (await apiRequest(e.updateSettings, { body })).data as SiteSettings;
  },
};
