import { endpoint, requires } from '../endpoint';

export const pricingRoutes = {
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
} as const;
