import type { Permission } from '@shared/enums';

/**
 * Plain-language names for the 86 backend permission codes, used in "you need…" explanations and
 * the role screens. `Record<Permission, …>` makes the compiler reject a missing or unknown code.
 */
export const PERMISSION_LABELS: Readonly<Record<Permission, string>> = {
  'catalog.category.read': 'View categories',
  'catalog.category.create': 'Create categories',
  'catalog.category.update': 'Edit categories',
  'catalog.category.delete': 'Delete categories',
  'catalog.category.reorder': 'Reorder and move categories',
  'catalog.attribute.read': 'View attributes',
  'catalog.attribute.create': 'Create attributes',
  'catalog.attribute.update': 'Edit attributes',
  'catalog.attribute.delete': 'Delete attributes',
  'catalog.product.read': 'View products',
  'catalog.product.create': 'Create products',
  'catalog.product.update': 'Edit products',
  'catalog.product.delete': 'Delete products',
  'catalog.product.publish': 'Publish and unpublish products',
  'catalog.product.import': 'Import catalog data',
  'catalog.product.export': 'Export catalog data',
  'catalog.variant.read': 'View variants',
  'catalog.variant.create': 'Create variants',
  'catalog.variant.update': 'Edit variants',
  'catalog.variant.delete': 'Delete variants',
  'catalog.collection.read': 'View collections',
  'catalog.collection.create': 'Create collections',
  'catalog.collection.update': 'Edit collections',
  'catalog.collection.delete': 'Delete collections',
  'catalog.inventory.read': 'View inventory',
  'catalog.inventory.update': 'Adjust inventory',
  'pricing.adjustment.read': 'View pricing rules',
  'pricing.adjustment.create': 'Create pricing rules',
  'pricing.adjustment.update': 'Edit pricing rules',
  'pricing.adjustment.delete': 'Delete pricing rules',
  'pricing.tax.read': 'View tax and delivery settings',
  'pricing.tax.update': 'Edit tax and delivery settings',
  'pricing.coupon.read': 'View coupons',
  'pricing.coupon.create': 'Create coupons',
  'pricing.coupon.update': 'Edit coupons',
  'pricing.coupon.delete': 'Delete coupons',
  'media.asset.read': 'View media',
  'media.asset.upload': 'Upload media',
  'media.asset.update': 'Edit media',
  'media.asset.delete': 'Delete media',
  'order.order.read': 'View orders',
  'order.order.update': 'Update orders',
  'order.order.cancel': 'Cancel orders',
  'order.order.fulfil': 'Fulfil orders and shipments',
  'order.order.export': 'Export orders and sales reports',
  'order.refund.read': 'View refunds',
  'order.refund.create': 'Create refunds',
  'order.refund.approve': 'Approve refunds',
  'order.customer.read': 'View customers, carts and customer groups',
  'order.customer.update': 'Edit customer groups and carts',
  'order.customer.block': 'Block customers',
  'order.customer.export': 'Export customers',
  'payment.settings.read': 'View payment settings',
  'payment.settings.update': 'Edit payment settings',
  'payment.split.read': 'View payment splits',
  'payment.split.update': 'Edit payment splits',
  'cms.page.read': 'View pages and site content',
  'cms.page.create': 'Create pages and site content',
  'cms.page.update': 'Edit and publish pages and site content',
  'cms.page.delete': 'Delete pages and site content',
  'cms.banner.read': 'View banners and announcements',
  'cms.banner.create': 'Create banners and announcements',
  'cms.banner.update': 'Edit banners and announcements',
  'cms.banner.delete': 'Delete banners and announcements',
  'cms.navigation.read': 'View navigation menus',
  'cms.navigation.update': 'Edit navigation menus',
  'cms.faq.read': 'View FAQs',
  'cms.faq.create': 'Create FAQs',
  'cms.faq.update': 'Edit FAQs',
  'cms.faq.delete': 'Delete FAQs',
  'lead.enquiry.read': 'View enquiries',
  'lead.enquiry.update': 'Update enquiries',
  'lead.enquiry.assign': 'Assign enquiries',
  'lead.enquiry.export': 'Export enquiries',
  'system.user.read': 'View admin users',
  'system.user.create': 'Add admin users',
  'system.user.update': 'Edit admin users',
  'system.user.delete': 'Delete admin users',
  'system.role.read': 'View roles and permissions',
  'system.role.create': 'Create roles',
  'system.role.update': 'Edit roles',
  'system.role.delete': 'Delete roles',
  'system.setting.read': 'View site settings',
  'system.setting.update': 'Edit site settings',
  'system.audit.read': 'View the audit log',
  'system.audit.export': 'Export the audit log',
};

export const PERMISSION_GROUP_LABELS: Readonly<Record<string, string>> = {
  catalog: 'Catalog',
  pricing: 'Pricing',
  media: 'Media',
  order: 'Orders and customers',
  payment: 'Payments',
  cms: 'Content',
  lead: 'Enquiries',
  system: 'System',
};

export function permissionLabel(code: Permission): string {
  return PERMISSION_LABELS[code] ?? code;
}

/** "View products" / "View products and Edit products" / "one of: …" for explanations. */
export function describeRequirement(
  all: readonly Permission[],
  any: readonly Permission[] = [],
): string {
  const parts: string[] = [];
  if (all.length > 0) parts.push(all.map(permissionLabel).join(' and '));
  if (any.length > 0) parts.push(`one of: ${any.map(permissionLabel).join(', ')}`);
  return parts.join('; ');
}
