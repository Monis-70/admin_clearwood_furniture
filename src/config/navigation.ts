import type { NavIconName } from '@/config/nav-icons';
import { IMPLEMENTED_THROUGH_PHASE } from '@/config/phase';
import { satisfies, type PermissionSet, type Requirement } from '@/lib/permissions/requirements';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  /**
   * Required once the area is built (a test enforces it). Unbuilt areas name their chosen icon in a
   * comment instead, so every app page does not ship icons for screens nobody can open yet.
   */
  icon?: NavIconName;
  /** What an admin needs to SEE the entry; the page and the API check again. */
  requires: Requirement;
  /** Build phase that delivers the screen (docs/ADMIN_ARCHITECTURE.md §14). */
  phase: number;
  /** Earlier phase that already delivers a read-only view of the same live data. */
  preview?: number;
  /** One line for the dashboard and search: what the operator does there. Built areas only, like the icon. */
  description?: string;
  exact?: boolean;
}

export interface NavGroup {
  id: string;
  label: string | null;
  items: readonly NavItem[];
}

/**
 * The approved information architecture (docs/ADMIN_INFORMATION_ARCHITECTURE.md). Entries for
 * phases not built yet stay in the config so the structure is reviewed once, but are not shown.
 * Every requirement is a real backend permission; none is inferred from a role name.
 */
export const NAVIGATION: readonly NavGroup[] = [
  {
    id: 'overview',
    label: null,
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/',
        icon: 'LayoutDashboard',
        requires: 'session',
        phase: 0,
        exact: true,
        description: 'Your access and what needs attention.',
      },
    ],
  },
  {
    id: 'catalog',
    label: 'Catalog',
    items: [
      {
        id: 'products',
        label: 'Products',
        href: '/catalog/products',
        icon: 'Package',
        requires: { all: ['catalog.product.read'] },
        phase: 2,
        description: 'Create, edit and publish products, their variants and stock.',
      },
      {
        id: 'categories',
        label: 'Categories',
        href: '/catalog/categories',
        icon: 'FolderTree',
        requires: { all: ['catalog.category.read'] },
        phase: 2,
        description: 'The category tree customers browse.',
      },
      {
        id: 'attributes',
        label: 'Attributes',
        href: '/catalog/attributes',
        icon: 'Tags',
        requires: { all: ['catalog.attribute.read'] },
        phase: 2,
        description: 'Product properties such as material or size, and their values.',
      },
      {
        id: 'brands',
        label: 'Brands',
        href: '/catalog/brands',
        icon: 'Award',
        requires: { all: ['catalog.product.read'] },
        phase: 2,
        description: 'Brands products can belong to.',
      },
      {
        id: 'inventory',
        label: 'Inventory',
        href: '/catalog/inventory',
        icon: 'Warehouse',
        requires: { all: ['catalog.inventory.read'] },
        phase: 2,
        description: 'Stock levels, low stock and adjustments.',
      },
      {
        id: 'collections',
        label: 'Collections',
        href: '/catalog/collections',
        icon: 'Layers',
        requires: { all: ['catalog.collection.read'] },
        phase: 2,
        description: 'Curated and rule-based product groups.',
      },
      {
        id: 'merchandising',
        label: 'Merchandising',
        href: '/catalog/merchandising',
        icon: 'Sparkles',
        requires: { all: ['catalog.product.read'] },
        phase: 3,
        description: 'Featured, new and highlighted products.',
      },
      {
        id: 'import-export',
        label: 'Import & export',
        href: '/catalog/import-export',
        icon: 'Upload',
        requires: {
          any: [
            'catalog.product.import',
            'catalog.product.export',
            'catalog.inventory.update',
            'pricing.adjustment.create',
          ],
        },
        phase: 2,
        description: 'Bring in or download catalog data in bulk.',
      },
      {
        id: 'catalog-settings',
        label: 'Catalog settings',
        href: '/catalog/settings',
        icon: 'Settings2',
        requires: { all: ['catalog.product.read'] },
        phase: 3,
        description: 'Page sizes, out-of-stock products, new arrivals and badges.',
      },
    ],
  },
  {
    id: 'media',
    label: 'Media',
    items: [
      {
        id: 'media',
        label: 'Media library',
        href: '/media',
        icon: 'Images',
        requires: { all: ['media.asset.read'] },
        phase: 2,
        description: 'Images and files used across the store.',
      },
    ],
  },
  {
    id: 'pricing',
    label: 'Pricing',
    items: [
      {
        id: 'price-rules',
        label: 'Price rules',
        href: '/pricing/price-rules',
        icon: 'IndianRupee',
        requires: { all: ['pricing.adjustment.read'] },
        phase: 2,
        description: 'Markdowns and adjustments on product prices.',
      },
      {
        id: 'price-lists',
        label: 'Price lists & tiers',
        href: '/pricing/price-lists',
        icon: 'ClipboardList',
        requires: { all: ['pricing.adjustment.read'] },
        phase: 5,
        description: 'Special price lists and quantity tiers.',
      },
      {
        id: 'discounts',
        label: 'Automatic discounts',
        href: '/pricing/discount-rules',
        icon: 'BadgePercent',
        requires: { all: ['pricing.adjustment.read'] },
        phase: 5,
        description: 'Discounts applied without a code.',
      },
      {
        id: 'coupons',
        label: 'Coupons',
        href: '/pricing/coupons',
        icon: 'TicketPercent',
        requires: { all: ['pricing.coupon.read'] },
        phase: 5,
        description: 'Codes customers enter at checkout.',
      },
      {
        id: 'customer-groups',
        label: 'Customer groups',
        href: '/pricing/customer-groups',
        icon: 'Users',
        requires: { all: ['order.customer.read'] },
        phase: 5,
        description: 'Groups that receive their own prices.',
      },
      {
        id: 'tax',
        label: 'Tax & GST',
        href: '/pricing/tax',
        icon: 'Receipt',
        requires: { all: ['pricing.tax.read'] },
        phase: 2,
        description: 'Tax classes and GST rates.',
      },
      {
        id: 'delivery',
        label: 'Delivery charges',
        href: '/pricing/delivery',
        icon: 'Truck',
        requires: { all: ['pricing.tax.read'] },
        phase: 5,
        description: 'Delivery zones, rates and pincodes.',
      },
      {
        id: 'simulator',
        label: 'Price simulator',
        href: '/pricing/simulator',
        icon: 'Calculator',
        requires: { all: ['pricing.adjustment.read'] },
        phase: 5,
        description: 'Price a what-if cart and see every rule applied.',
      },
    ],
  },
  {
    id: 'search',
    label: 'Search',
    items: [
      {
        id: 'search-insights',
        label: 'Search insights',
        href: '/search/insights',
        icon: 'Search',
        requires: { all: ['catalog.product.update'] },
        phase: 6,
        description: 'What customers search for and miss.',
      },
      {
        id: 'synonyms',
        label: 'Synonyms',
        href: '/search/synonyms',
        icon: 'ListTree',
        requires: { all: ['catalog.product.update'] },
        phase: 6,
        description: 'Words that should find the same products.',
      },
      {
        id: 'search-index',
        label: 'Index maintenance',
        href: '/search/index',
        icon: 'DatabaseZap',
        requires: { all: ['catalog.product.update'] },
        phase: 6,
        description: 'Rebuild the search index and popularity.',
      },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    items: [
      {
        id: 'pages',
        label: 'Pages',
        href: '/content/pages',
        preview: 1,
        icon: 'FileText',
        requires: { all: ['cms.page.read'] },
        phase: 7,
        description: 'Storefront pages built from blocks.',
      },
      {
        id: 'banners',
        label: 'Banners',
        href: '/content/banners',
        preview: 1,
        icon: 'PanelTop',
        requires: { all: ['cms.banner.read'] },
        phase: 7,
        description: 'Promotional banners and their schedule.',
      },
      {
        id: 'announcements',
        label: 'Announcements',
        href: '/content/announcements',
        icon: 'Megaphone',
        requires: { all: ['cms.banner.read'] },
        phase: 7,
        description: 'The announcement bar above the storefront.',
      },
      {
        id: 'faqs',
        label: 'FAQs',
        href: '/content/faqs',
        icon: 'CircleHelp',
        requires: { all: ['cms.faq.read'] },
        phase: 7,
        description: 'Questions and answers by category.',
      },
      {
        id: 'help-centre',
        label: 'Help centre',
        href: '/content/help-centre',
        icon: 'LifeBuoy',
        requires: { all: ['cms.page.read'] },
        phase: 7,
        description: 'Help articles and their categories.',
      },
      {
        id: 'testimonials',
        label: 'Testimonials',
        href: '/content/testimonials',
        icon: 'Quote',
        requires: { all: ['cms.page.read'] },
        phase: 7,
        description: 'Customer quotes shown on the storefront.',
      },
      {
        id: 'stores',
        label: 'Stores',
        href: '/content/stores',
        icon: 'Store',
        requires: { all: ['cms.page.read'] },
        phase: 7,
        description: 'Showroom locations and opening hours.',
      },
      {
        id: 'navigation',
        label: 'Navigation menus',
        href: '/content/navigation',
        icon: 'Menu',
        requires: { all: ['cms.navigation.read'] },
        phase: 7,
        description: 'Header, footer and top-bar menus.',
      },
      {
        id: 'site-settings',
        label: 'Site & SEO settings',
        href: '/content/site-settings',
        icon: 'Settings',
        requires: { all: ['system.setting.read'] },
        phase: 7,
        description: 'Contact details, SEO defaults and sitemap.',
      },
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    items: [
      {
        id: 'carts',
        label: 'Carts & wishlists',
        href: '/customers/carts',
        // icon: ShoppingCart
        requires: { all: ['order.customer.read'] },
        phase: 8,
        // description: 'Open carts and wishlist activity.'
      },
    ],
  },
  {
    id: 'enquiries',
    label: 'Enquiries',
    items: [
      {
        id: 'enquiries',
        label: 'All enquiries',
        href: '/enquiries',
        preview: 1,
        icon: 'Inbox',
        requires: { all: ['lead.enquiry.read'] },
        phase: 8,
        description: 'Leads from storefront forms.',
      },
      {
        id: 'contract-work',
        label: 'Contract work',
        href: '/enquiries/contract-work',
        preview: 1,
        icon: 'HardHat',
        requires: { all: ['lead.enquiry.read'] },
        phase: 8,
        description: 'Enquiries for contract and interior work.',
      },
    ],
  },
  {
    id: 'orders',
    label: 'Orders',
    items: [
      {
        id: 'orders',
        label: 'Orders',
        href: '/orders',
        // icon: ClipboardList
        requires: { all: ['order.order.read'] },
        phase: 9,
        // description: 'Cash-on-delivery orders and their status.'
      },
      {
        id: 'shipments',
        label: 'Shipments',
        href: '/orders/shipments',
        // icon: Truck
        requires: { all: ['order.order.read'] },
        phase: 9,
        // description: 'Manual shipments and delivery exceptions.'
      },
      {
        id: 'reports',
        label: 'Reports',
        href: '/orders/reports',
        // icon: FileSpreadsheet
        requires: { any: ['order.order.export', 'catalog.inventory.read'] },
        phase: 9,
        // description: 'Sales, GST and inventory reports.'
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      {
        id: 'system-status',
        label: 'Status & integrations',
        href: '/system/status',
        icon: 'Activity',
        requires: 'session',
        phase: 0,
        description: 'API health and which integrations are active.',
      },
      {
        id: 'admin-users',
        label: 'Admin users',
        href: '/system/users',
        icon: 'UserCog',
        requires: { all: ['system.user.read'] },
        phase: 1,
        description: 'Who can sign in to this admin.',
      },
      {
        id: 'roles',
        label: 'Roles & permissions',
        href: '/system/roles',
        icon: 'ShieldCheck',
        requires: { all: ['system.role.read'] },
        phase: 1,
        description: 'What each role is allowed to do.',
      },
      {
        id: 'audit-log',
        label: 'Audit log',
        href: '/system/audit-log',
        icon: 'ScrollText',
        requires: { all: ['system.audit.read'] },
        phase: 1,
        description: 'Who changed what, and when.',
      },
    ],
  },
];

export function isBuilt(item: NavItem, throughPhase = IMPLEMENTED_THROUGH_PHASE): boolean {
  return Math.min(item.phase, item.preview ?? item.phase) <= throughPhase;
}

/** Delivered only as a read-only view so far. */
export function isPreview(item: NavItem, throughPhase = IMPLEMENTED_THROUGH_PHASE): boolean {
  return item.phase > throughPhase && isBuilt(item, throughPhase);
}

/** Groups and entries this admin can open now; empty groups are dropped. */
export function visibleNavigation(
  held: PermissionSet,
  throughPhase = IMPLEMENTED_THROUGH_PHASE,
): NavGroup[] {
  return NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => isBuilt(item, throughPhase) && satisfies(item.requires, held),
    ),
  })).filter((group) => group.items.length > 0);
}

export function isActive(item: NavItem, pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (item.exact) return path === item.href;
  return path === item.href || path.startsWith(`${item.href}/`);
}
