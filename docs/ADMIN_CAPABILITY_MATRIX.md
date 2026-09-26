# ClearWood Admin — Capability, Permission and Mutation Matrix

> **Generated** by `npm run matrix:doc` from `contracts/route-inventory.json` and
> `contracts/openapi-debt.json` (backend `c553f92`), `src/config/api-coverage.ts`, the endpoint
> registry and the seeded role grants. Do not edit by hand. `npm run matrix:doc -- --check` (part of
> `npm run verify`) fails when it is out of date. Per-route purpose and screen: [ADMIN_API_COVERAGE.md](ADMIN_API_COVERAGE.md).

## 1. Every backend route, by class

Implemented through phase **P2**.

| Class | Meaning | Admin routes | Other routes | Total |
| --- | --- | ---: | ---: | ---: |
| UI required: built | wired in the endpoint registry and used by a screen | 131 | 4 | 135 |
| UI required: final UI phase | classified for a screen (P3 and later), not wired yet | 151 | 2 | 153 |
| On hold (integration) | payments, refunds, returns, courier or e-mail: hidden until the integration is live | 35 | 0 | 35 |
| Internal / system | never called by the UI (see ADMIN_API_COVERAGE.md §4) | 1 | 0 | 1 |
| Not applicable to the admin | storefront and customer API; the admin does not call it | 0 | 113 | 113 |
| **Total** | | **318** | **119** | **437** |
| Missing backend capability | no route exists; the UI must not imitate it (§6) | 6 capabilities | | |

## 2. Admin routes by module

| Module | Routes | Built | Final UI phase | On hold | Internal | Not in OpenAPI |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Access · Session | 10 | 8 | 0 | 2 | 0 | 6 |
| Catalog · Attributes | 13 | 13 | 0 | 0 | 0 | 13 |
| Catalog · Brands | 4 | 4 | 0 | 0 | 0 | 4 |
| Catalog · Categories | 17 | 17 | 0 | 0 | 0 | 10 |
| Catalog · Collections | 11 | 10 | 1 | 0 | 0 | 8 |
| Pricing · Price rules | 22 | 5 | 17 | 0 | 0 | 20 |
| Catalog · Products | 15 | 14 | 1 | 0 | 0 | 11 |
| Catalog · Variants | 8 | 8 | 0 | 0 | 0 | 4 |
| Pricing · Tax & GST | 6 | 4 | 2 | 0 | 0 | 5 |
| Content · Banners & announcements | 10 | 1 | 9 | 0 | 0 | 0 |
| Content · FAQs & help centre | 18 | 0 | 18 | 0 | 0 | 0 |
| Content · Pages | 19 | 1 | 18 | 0 | 0 | 0 |
| Content · Testimonials, stores, navigation, settings | 18 | 0 | 18 | 0 | 0 | 0 |
| Media | 22 | 20 | 1 | 0 | 1 | 14 |
| On hold · Payments | 13 | 0 | 0 | 13 | 0 | 0 |
| Pricing · Coupons & customer groups | 14 | 0 | 14 | 0 | 0 | 13 |
| Pricing · Delivery charges | 13 | 0 | 13 | 0 | 0 | 13 |
| System · Admin users & roles | 13 | 13 | 0 | 0 | 0 | 7 |
| Search | 10 | 0 | 10 | 0 | 0 | 5 |
| Carts & wishlists | 6 | 0 | 6 | 0 | 0 | 1 |
| Catalog · Import & export | 6 | 6 | 0 | 0 | 0 | 4 |
| Catalog · Inventory | 5 | 5 | 0 | 0 | 0 | 4 |
| Catalog · Settings | 2 | 0 | 2 | 0 | 0 | 0 |
| Orders (limited verification) | 25 | 0 | 19 | 6 | 0 | 0 |
| Enquiries | 4 | 2 | 2 | 0 | 0 | 0 |
| On hold · Notifications | 2 | 0 | 0 | 2 | 0 | 0 |
| On hold · Refunds & returns | 12 | 0 | 0 | 12 | 0 | 0 |

## 3. Remaining UI capabilities for the final UI phase (151 admin routes)

Grouped by module; the status is the planned phase. Screens and actions come from the coverage table.

### Content · Banners & announcements (9)

| Status | Method | Path | Purpose | Screen → action | Permission | Destructive |
| --- | --- | --- | --- | --- | --- | --- |
| P7 | DELETE | `/cms/announcements/{id}` | Delete an announcement bar | /content/announcements → Delete announcement | `cms.banner.delete` | irreversible |
| P7 | DELETE | `/cms/banners/{id}` | Delete a banner | /content/banners → Delete banner | `cms.banner.delete` | irreversible |
| P7 | GET | `/cms/announcements` | Announcement bars | /content/announcements → Announcements table | `cms.banner.read` | — |
| P7 | GET | `/cms/banners/{id}/stats` | Impressions and clicks | /content/banners?id= → Performance | `cms.banner.read` | — |
| P7 | PATCH | `/cms/announcements/{id}` | Edit an announcement bar (version) | /content/announcements → Edit announcement | `cms.banner.update` | reversible |
| P7 | PATCH | `/cms/banners/{id}` | Edit a banner (version) | /content/banners → Edit banner | `cms.banner.update` | reversible |
| P7 | POST | `/cms/announcements` | Create an announcement bar | /content/announcements → Add announcement | `cms.banner.create` | — |
| P7 | POST | `/cms/banners` | Create a banner | /content/banners → Add banner | `cms.banner.create` | — |
| P7 | POST | `/cms/banners/reorder` | Reorder banners | /content/banners → Drag to reorder | `cms.banner.update` | — |

### Content · FAQs & help centre (18)

| Status | Method | Path | Purpose | Screen → action | Permission | Destructive |
| --- | --- | --- | --- | --- | --- | --- |
| P7 | DELETE | `/cms/faq-categories/{id}` | Delete a FAQ category | /content/faqs → Delete category | `cms.faq.delete` | irreversible |
| P7 | DELETE | `/cms/faqs/{id}` | Delete a FAQ | /content/faqs → Delete FAQ | `cms.faq.delete` | irreversible |
| P7 | DELETE | `/cms/help/articles/{id}` | Delete a help article | /content/help-centre?article= → Delete article | `cms.page.delete` | irreversible |
| P7 | DELETE | `/cms/help/categories/{id}` | Delete a help category | /content/help-centre → Delete category | `cms.page.delete` | irreversible |
| P7 | GET | `/cms/faq-categories` | FAQ categories | /content/faqs → Categories panel | `cms.faq.read` | — |
| P7 | GET | `/cms/faqs` | List FAQs | /content/faqs → FAQs table | `cms.faq.read` | — |
| P7 | GET | `/cms/help/articles` | Help articles | /content/help-centre → Articles table | `cms.page.read` | — |
| P7 | GET | `/cms/help/categories` | Help category tree | /content/help-centre → Category tree | `cms.page.read` | — |
| P7 | PATCH | `/cms/faq-categories/{id}` | Edit a FAQ category (version) | /content/faqs → Edit category | `cms.faq.update` | — |
| P7 | PATCH | `/cms/faqs/{id}` | Edit a FAQ (version) | /content/faqs → Edit FAQ | `cms.faq.update` | reversible |
| P7 | PATCH | `/cms/help/articles/{id}` | Edit a help article (version) | /content/help-centre?article= → Save / Publish / Archive | `cms.page.update` | reversible |
| P7 | PATCH | `/cms/help/categories/{id}` | Edit a help category (version) | /content/help-centre → Edit category | `cms.page.update` | — |
| P7 | POST | `/cms/faq-categories` | Create a FAQ category | /content/faqs → Add category | `cms.faq.create` | — |
| P7 | POST | `/cms/faqs` | Create a FAQ | /content/faqs → Add FAQ | `cms.faq.create` | — |
| P7 | POST | `/cms/faqs/reorder` | Reorder FAQs | /content/faqs → Drag to reorder | `cms.faq.update` | — |
| P7 | POST | `/cms/help/articles` | Create a help article (Markdown) | /content/help-centre → New article | `cms.page.create` | — |
| P7 | POST | `/cms/help/articles/reorder` | Reorder help articles | /content/help-centre → Drag to reorder | `cms.page.update` | — |
| P7 | POST | `/cms/help/categories` | Create a help category | /content/help-centre → Add category | `cms.page.create` | — |

### Content · Pages (18)

| Status | Method | Path | Purpose | Screen → action | Permission | Destructive |
| --- | --- | --- | --- | --- | --- | --- |
| P7 | DELETE | `/cms/pages/{id}` | Soft-delete a page | /content/pages/edit?id= → Delete page | `cms.page.delete` | irreversible |
| P7 | DELETE | `/cms/pages/{id}/blocks/{blockId}` | Remove a block | /content/pages/edit?id= → Remove block | `cms.page.update` | reversible |
| P7 | GET | `/cms/block-types` | Block registry: defaults + media/reference paths | /content/pages/edit?id= → Block palette | `cms.page.read` | — |
| P7 | GET | `/cms/pages/{id}` | One page with blocks | /content/pages/edit?id= → Page builder | `cms.page.read` | — |
| P7 | GET | `/cms/pages/{id}/revisions` | Revision history | /content/pages/edit?id=&tab=history → Revisions | `cms.page.read` | — |
| P7 | GET | `/seo/preview/{type}/{id}` | Meta tags an entity will render with | /content/pages/edit?id=&tab=seo, product SEO tab → SEO preview | `cms.page.read` | — |
| P7 | PATCH | `/cms/pages/{id}` | Edit page settings (version) | /content/pages/edit?id=&tab=settings → Save | `cms.page.update` | — |
| P7 | PATCH | `/cms/pages/{id}/blocks/{blockId}` | Edit a block | /content/pages/edit?id= → Save block | `cms.page.update` | — |
| P7 | POST | `/cms/pages` | Create a page | /content/pages → New page | `cms.page.create` | — |
| P7 | POST | `/cms/pages/{id}/blocks` | Add a block | /content/pages/edit?id= → Add block | `cms.page.update` | — |
| P7 | POST | `/cms/pages/{id}/blocks/reorder` | Reorder blocks | /content/pages/edit?id= → Drag to reorder | `cms.page.update` | — |
| P7 | POST | `/cms/pages/{id}/duplicate` | Duplicate with a new slug/title | /content/pages → Duplicate | `cms.page.create` | — |
| P7 | POST | `/cms/pages/{id}/preview` | Render including drafts (data, not HTML) | /content/pages/edit?id=&tab=preview → Preview | `cms.page.read` | — |
| P7 | POST | `/cms/pages/{id}/publish` | Publish; 422 lists every blocker | /content/pages/edit?id= → Publish | `cms.page.update` | — |
| P7 | POST | `/cms/pages/{id}/revisions/{version}/restore` | Restore a revision (writes a new revision) | /content/pages/edit?id=&tab=history → Restore this version | `cms.page.update` | — |
| P7 | POST | `/cms/pages/{id}/schedule` | Schedule publish (and optional expiry) | /content/pages/edit?id= → Schedule | `cms.page.update` | — |
| P7 | POST | `/cms/pages/{id}/unpublish` | Unpublish | /content/pages/edit?id= → Unpublish | `cms.page.update` | reversible |
| P7 | POST | `/seo/sitemap/rebuild` | Rebuild the sitemap cache | /content/pages (SEO tools), /content/site-settings → Rebuild sitemap | `cms.page.update` | — |

### Content · Testimonials, stores, navigation, settings (18)

| Status | Method | Path | Purpose | Screen → action | Permission | Destructive |
| --- | --- | --- | --- | --- | --- | --- |
| P7 | DELETE | `/cms/stores/{id}` | Delete a store | /content/stores → Delete store | `cms.page.delete` | irreversible |
| P7 | DELETE | `/cms/testimonials/{id}` | Delete a testimonial | /content/testimonials → Delete testimonial | `cms.page.delete` | irreversible |
| P7 | DELETE | `/navigation/items/{id}` | Delete a menu item | /content/navigation?menu= → Delete item | `cms.navigation.update` | irreversible |
| P7 | GET | `/cms/stores` | Store locations | /content/stores → Stores table | `cms.page.read` | — |
| P7 | GET | `/cms/testimonials` | Testimonials | /content/testimonials → Testimonials table | `cms.page.read` | — |
| P7 | GET | `/content/settings` | Site contact, social, SEO and CMS settings | /content/site-settings → Settings form | `system.setting.read` | — |
| P7 | GET | `/navigation` | Navigation menus | /content/navigation → Menu list | `cms.navigation.read` | — |
| P7 | GET | `/navigation/{key}` | One menu with items | /content/navigation?menu= → Menu editor | `cms.navigation.read` | — |
| P7 | PATCH | `/cms/stores/{id}` | Edit a store (version) | /content/stores → Edit store | `cms.page.update` | reversible |
| P7 | PATCH | `/cms/testimonials/{id}` | Edit a testimonial (version) | /content/testimonials → Edit testimonial | `cms.page.update` | reversible |
| P7 | PATCH | `/navigation/items/{id}` | Edit a menu item | /content/navigation?menu= → Edit item | `cms.navigation.update` | reversible |
| P7 | POST | `/cms/stores` | Create a store | /content/stores → Add store | `cms.page.create` | — |
| P7 | POST | `/cms/stores/reorder` | Reorder stores | /content/stores → Drag to reorder | `cms.page.update` | — |
| P7 | POST | `/cms/testimonials` | Create a testimonial | /content/testimonials → Add testimonial | `cms.page.create` | — |
| P7 | POST | `/cms/testimonials/reorder` | Reorder testimonials | /content/testimonials → Drag to reorder | `cms.page.update` | — |
| P7 | POST | `/navigation/{key}/items` | Add a menu item (target verified; depth ≤ 3) | /content/navigation?menu= → Add item | `cms.navigation.update` | — |
| P7 | POST | `/navigation/{key}/reorder` | Reorder a menu | /content/navigation?menu= → Drag to reorder | `cms.navigation.update` | — |
| P7 | PUT | `/content/settings` | Write whitelisted content settings (20 keys) | /content/site-settings → Save settings | `system.setting.update` | — |

### Pricing · Coupons & customer groups (14)

| Status | Method | Path | Purpose | Screen → action | Permission | Destructive |
| --- | --- | --- | --- | --- | --- | --- |
| P5 | DELETE | `/pricing/coupons/{id}` | Delete a coupon | /pricing/coupons?id= → Delete coupon | `pricing.coupon.delete` | irreversible |
| P5 | DELETE | `/pricing/customer-groups/{id}` | Delete a customer group | /pricing/customer-groups → Delete group | `order.customer.update` | irreversible |
| P5 | DELETE | `/pricing/customer-groups/{id}/members` | Remove customers by id | /pricing/customer-groups?id= → Remove members | `order.customer.update` | — |
| P5 | GET | `/pricing/coupons` | Search coupons | /pricing/coupons → Coupons table | `pricing.coupon.read` | — |
| P5 | GET | `/pricing/coupons/{id}` | One coupon with redemption counts | /pricing/coupons?id= → Coupon drawer | `pricing.coupon.read` | — |
| P5 | GET | `/pricing/coupons/{id}/redemptions` | Redemption ledger of a coupon | /pricing/coupons?id=&tab=redemptions → Redemptions table | `pricing.coupon.read` | — |
| P5 | GET | `/pricing/customer-groups` | Customer groups | /pricing/customer-groups → Groups table | `order.customer.read` | — |
| P5 | GET | `/pricing/customer-groups/{id}/members` | Members of a group | /pricing/customer-groups?id= → Members table | `order.customer.read` | — |
| P5 | PATCH | `/pricing/coupons/{id}` | Edit a coupon (version) | /pricing/coupons?id= → Save / Activate / Deactivate | `pricing.coupon.update` | reversible |
| P5 | PATCH | `/pricing/customer-groups/{id}` | Edit a customer group (version) | /pricing/customer-groups → Edit group | `order.customer.update` | — |
| P5 | POST | `/pricing/coupons` | Create a coupon | /pricing/coupons → Add coupon | `pricing.coupon.create` | — |
| P5 | POST | `/pricing/coupons/bulk-generate` | Generate up to 500 codes from a template | /pricing/coupons → Generate codes | `pricing.coupon.create` | — |
| P5 | POST | `/pricing/customer-groups` | Create a customer group | /pricing/customer-groups → Add group | `order.customer.update` | — |
| P5 | POST | `/pricing/customer-groups/{id}/members` | Add customers by id | /pricing/customer-groups?id= → Add members | `order.customer.update` | — |

### Pricing · Price rules (17)

| Status | Method | Path | Purpose | Screen → action | Permission | Destructive |
| --- | --- | --- | --- | --- | --- | --- |
| P5 | DELETE | `/pricing/discount-rules/{id}` | Delete a discount rule | /pricing/discount-rules → Delete rule | `pricing.adjustment.delete` | irreversible |
| P5 | DELETE | `/pricing/price-lists/{id}` | Delete a price list | /pricing/price-lists → Delete price list | `pricing.adjustment.delete` | irreversible |
| P5 | DELETE | `/pricing/tier-prices/{id}` | Delete a tier price | /pricing/tier-prices → Delete tier | `pricing.adjustment.delete` | irreversible |
| P5 | GET | `/pricing/discount-rules` | Automatic discount rules | /pricing/discount-rules → Rules table | `pricing.adjustment.read` | — |
| P5 | GET | `/pricing/explain/{id}` | Every rule that could touch a product | /pricing/simulator, product Pricing tab → Explain price | `pricing.adjustment.read` | — |
| P5 | GET | `/pricing/price-lists` | Price lists | /pricing/price-lists → Price lists table | `pricing.adjustment.read` | — |
| P5 | GET | `/pricing/price-lists/{id}/items` | Items of a price list | /pricing/price-lists?id= → Items editor | `pricing.adjustment.read` | — |
| P5 | GET | `/pricing/tier-prices` | Quantity tier prices | /pricing/tier-prices → Tiers table | `pricing.adjustment.read` | — |
| P5 | PATCH | `/pricing/discount-rules/{id}` | Edit a discount rule (version) | /pricing/discount-rules → Edit rule | `pricing.adjustment.update` | — |
| P5 | PATCH | `/pricing/price-lists/{id}` | Edit a price list (version) | /pricing/price-lists → Edit price list | `pricing.adjustment.update` | — |
| P5 | PATCH | `/pricing/tier-prices/{id}` | Edit a tier price (no version) | /pricing/tier-prices → Edit tier | `pricing.adjustment.update` | — |
| P5 | POST | `/pricing/discount-rules` | Create a discount rule (conditions + actions) | /pricing/discount-rules → Add rule | `pricing.adjustment.create` | — |
| P5 | POST | `/pricing/discount-rules/evaluate` | Test discount rules against a sample cart | /pricing/discount-rules → Test rules | `pricing.adjustment.read` | — |
| P5 | POST | `/pricing/price-lists` | Create a price list | /pricing/price-lists → Add price list | `pricing.adjustment.create` | — |
| P5 | POST | `/pricing/simulate` | Price a hypothetical cart with the full rule trace | /pricing/simulator → Run simulation | `pricing.adjustment.read` | — |
| P5 | POST | `/pricing/tier-prices` | Create a tier price | /pricing/tier-prices → Add tier | `pricing.adjustment.create` | — |
| P5 | PUT | `/pricing/price-lists/{id}/items` | Replace price list items | /pricing/price-lists?id= → Save items | `pricing.adjustment.update` | — |

### Pricing · Delivery charges (13)

| Status | Method | Path | Purpose | Screen → action | Permission | Destructive |
| --- | --- | --- | --- | --- | --- | --- |
| P5 | DELETE | `/pricing/shipping-pincodes/{id}` | Remove a pincode | /pricing/delivery?zone= → Remove pincode | `pricing.tax.update` | irreversible |
| P5 | DELETE | `/pricing/shipping-rates/{id}` | Delete a rate | /pricing/delivery → Delete rate | `pricing.tax.update` | irreversible |
| P5 | DELETE | `/pricing/shipping-zones/{id}` | Delete a zone | /pricing/delivery → Delete zone | `pricing.tax.update` | irreversible |
| P5 | GET | `/pricing/shipping-pincodes` | Serviceable pincodes (optional zoneId query) | /pricing/delivery?zone= → Pincodes table | `pricing.tax.read` | — |
| P5 | GET | `/pricing/shipping-rates` | Delivery rates | /pricing/delivery → Rates table | `pricing.tax.read` | — |
| P5 | GET | `/pricing/shipping-zones` | Delivery zones | /pricing/delivery → Zones table | `pricing.tax.read` | — |
| P5 | PATCH | `/pricing/shipping-rates/{id}` | Edit a rate (version) | /pricing/delivery → Edit rate | `pricing.tax.update` | — |
| P5 | PATCH | `/pricing/shipping-zones/{id}` | Edit a zone (version) | /pricing/delivery → Edit zone | `pricing.tax.update` | — |
| P5 | POST | `/pricing/shipping-pincode-ranges` | Add a pincode range to a zone | /pricing/delivery?zone= → Add range | `pricing.tax.update` | — |
| P5 | POST | `/pricing/shipping-pincodes` | Add a pincode to a zone | /pricing/delivery?zone= → Add pincode | `pricing.tax.update` | — |
| P5 | POST | `/pricing/shipping-rates` | Create a rate | /pricing/delivery → Add rate | `pricing.tax.update` | — |
| P5 | POST | `/pricing/shipping-zones` | Create a zone | /pricing/delivery → Add zone | `pricing.tax.update` | — |
| P5 | POST | `/pricing/shipping-zones/{id}/pincodes/import` | Import pincodes from CSV (multipart "files" or csv field) | /pricing/delivery?zone= → Import pincodes | `pricing.tax.update` | — |

### Search (10)

| Status | Method | Path | Purpose | Screen → action | Permission | Destructive |
| --- | --- | --- | --- | --- | --- | --- |
| P6 | DELETE | `/search/synonyms/{term}` | Delete a synonym set | /search/synonyms → Delete synonym | `catalog.product.update` | irreversible |
| P6 | GET | `/catalog/products/{id}/search-document` | What search indexed for a product | /catalog/products/edit?id=&tab=seo → What search sees | `catalog.product.read` | — |
| P6 | GET | `/search/analytics` | Top/zero-result queries, CTR, 30-day trend | /search/insights → Insights | `catalog.product.update` | — |
| P6 | GET | `/search/jobs` | Recent reindex jobs | /search/index → Jobs table | `catalog.product.update` | — |
| P6 | GET | `/search/jobs/{id}` | Reindex job progress | /search/index → Progress | `catalog.product.update` | — |
| P6 | GET | `/search/synonyms` | Synonym sets | /search/synonyms → Synonyms table | `catalog.product.update` | — |
| P6 | PATCH | `/search/synonyms/{term}` | Edit a synonym set | /search/synonyms → Edit synonym | `catalog.product.update` | — |
| P6 | POST | `/search/popularity/recompute` | Recompute popularity scores | /search/index → Recompute popularity | `catalog.product.update` | — |
| P6 | POST | `/search/reindex` | Start a (partial or full) reindex job | /search/index → Rebuild index | `catalog.product.update` | — |
| P6 | POST | `/search/synonyms` | Create a synonym set | /search/synonyms, /search/insights → Add synonym | `catalog.product.update` | — |

### Carts & wishlists (6)

| Status | Method | Path | Purpose | Screen → action | Permission | Destructive |
| --- | --- | --- | --- | --- | --- | --- |
| P8 | GET | `/carts` | Browse carts incl. abandoned | /carts → Carts table | `order.customer.read` | — |
| P8 | GET | `/carts/{id}` | Cart with event timeline and live re-quote | /carts?id= → Cart drawer | `order.customer.read` | — |
| P8 | GET | `/carts/stats` | Abandonment rate, average value, top abandoned products | /carts → Stats header | `order.customer.read` | — |
| P8 | GET | `/customers/{id}/cart` | A customer's active cart | /carts?customer= → Customer cart | `order.customer.read` | — |
| P8 | GET | `/wishlists/stats` | Most-wishlisted products and price-drop candidates | /carts?tab=wishlists → Wishlist insights | `order.customer.read` | — |
| P8 | POST | `/carts/cleanup` | Mark abandoned and expire stale carts | /carts → Run cart cleanup | `order.customer.update` | irreversible |

### Catalog · Settings (2)

| Status | Method | Path | Purpose | Screen → action | Permission | Destructive |
| --- | --- | --- | --- | --- | --- | --- |
| P3 | GET | `/catalog/settings` | Page sizes, out-of-stock policy, new-arrival window, badges | /catalog/settings → Settings form | `catalog.product.read` | — |
| P3 | PUT | `/catalog/settings` | Change catalog settings (badges merge per code; null turns one off) | /catalog/settings → Save settings | `catalog.product.update` | — |

### Orders (limited verification) (19)

| Status | Method | Path | Purpose | Screen → action | Permission | Destructive |
| --- | --- | --- | --- | --- | --- | --- |
| P9 | GET | `/documents/{documentNumber}/download` | Download a checksum-verified document | /orders/view?id=&tab=documents → Download PDF | `order.order.read` | — |
| P9 | GET | `/ndr` | Failed deliveries awaiting a decision | /orders/shipments?tab=ndr → Failed deliveries | `order.order.read` | — |
| P9 | GET | `/notifications/logs` | What was sent / skipped / failed | /orders/notifications → Notification log | `order.order.read` | — |
| P9 | GET | `/orders` | Browse orders | /orders → Orders table | `order.order.read` | — |
| P9 | GET | `/orders/{id}` | Order with payments, allocations and ledger check | /orders/view?id= → Order detail | `order.order.read` | — |
| P9 | GET | `/orders/{id}/ledger-check` | Does the order's money balance? | /orders/view?id= → Ledger check (advanced) | `order.order.read` | — |
| P9 | GET | `/orders/{orderNumber}/documents` | Documents issued for an order | /orders/view?id=&tab=documents → Documents | `order.order.read` | — |
| P9 | GET | `/orders/{orderNumber}/shipments` | Shipments and unshipped quantities of an order | /orders/view?id=&tab=fulfilment → Fulfilment panel | `order.order.read` | — |
| P9 | GET | `/reports` | Operational reports (CSV or JSON totals) | /orders/reports → Generate report | computed per request | — |
| P9 | GET | `/shipments` | List shipments | /orders/shipments → Shipments table | `order.order.read` | — |
| P9 | GET | `/shipments/{shipmentNumber}` | Shipment with full timeline | /orders/shipments?n= → Shipment drawer | `order.order.read` | — |
| P9 | POST | `/ndr/{id}/action` | Reattempt / return / contact buyer | /orders/shipments?tab=ndr → Decide | `order.order.fulfil` | — |
| P9 | POST | `/orders/{id}/cancel` | Cancel an order | /orders/view?id= → Cancel order | `order.order.cancel` | irreversible |
| P9 | POST | `/orders/{id}/status` | Guarded status transition | /orders/view?id= → Change status | `order.order.update` | — |
| P9 | POST | `/orders/{orderNumber}/documents/invoice` | Issue the GST tax invoice (once; never regenerated) | /orders/view?id=&tab=documents → Issue invoice | `order.order.update` | irreversible |
| P9 | POST | `/orders/{orderNumber}/shipments` | Draft a shipment (manual: true) | /orders/view?id=&tab=fulfilment → Create manual shipment | `order.order.fulfil` | — |
| P9 | POST | `/shipments/{shipmentNumber}/awb` | Assign an AWB (courier) or record a manual docket | /orders/shipments?n= → Record docket number | `order.order.fulfil` | — |
| P9 | POST | `/shipments/{shipmentNumber}/cancel` | Cancel a shipment | /orders/shipments?n= → Cancel shipment | `order.order.fulfil` | irreversible |
| P9 | POST | `/shipments/{shipmentNumber}/status` | Move a shipment by hand (state machine) | /orders/shipments?n= → Update status | `order.order.fulfil` | — |

### Enquiries (2)

| Status | Method | Path | Purpose | Screen → action | Permission | Destructive |
| --- | --- | --- | --- | --- | --- | --- |
| P8 | GET | `/enquiries/assignees` | Admins an enquiry can be assigned to (id and name only) | /enquiries?id= → Assignee picker | `lead.enquiry.assign` | — |
| P8 | PATCH | `/enquiries/{id}` | Move status, assign, add note (version) | /enquiries?id= → Update status / Assign / Note | `lead.enquiry.update` | — |

### Media (1)

| Status | Method | Path | Purpose | Screen → action | Permission | Destructive |
| --- | --- | --- | --- | --- | --- | --- |
| P6 | GET | `/media/gc` | Storage integrity report (orphaned/missing files), read-only | /system/status → Run storage check | `media.asset.delete` | — |

### Pricing · Tax & GST (2)

| Status | Method | Path | Purpose | Screen → action | Permission | Destructive |
| --- | --- | --- | --- | --- | --- | --- |
| P5 | GET | `/pricing/settings` | Pricing & GST settings | /pricing/tax → Settings form | `pricing.tax.read` | — |
| P5 | PUT | `/pricing/settings` | Change pricing & GST settings | /pricing/tax → Save settings | `pricing.tax.update` | — |

### Catalog · Collections (1)

| Status | Method | Path | Purpose | Screen → action | Permission | Destructive |
| --- | --- | --- | --- | --- | --- | --- |
| P6 | POST | `/collections/evaluate-all` | Re-evaluate every AUTOMATIC collection | /system/status (Maintenance) → Refresh all automatic collections | `catalog.collection.update` | — |

### Catalog · Products (1)

| Status | Method | Path | Purpose | Screen → action | Permission | Destructive |
| --- | --- | --- | --- | --- | --- | --- |
| P3 | PUT | `/catalog/products/{id}/relations` | Replace curated relations (RELATED, SIMILAR, …) | /catalog/products/edit?id=&tab=related → Save related products | `catalog.product.update` | — |

## 4. Permission matrix

Seeded roles: SA SUPER_ADMIN · AD ADMIN · CM CATALOG_MANAGER · OM ORDER_MANAGER · CO CONTENT_MANAGER. A role holds a route when it holds
every required permission (and one of the "any of" set). 1 admin routes decide per request
(`GET /reports`); 2 check the permission in the controller (imports, §5);
6 need only a signed-in admin (own session and account); 4 are public (sign-in, session renewal
and the password-reset pair, which is on hold).

| Permission | SA | AD | CM | OM | CO | Admin routes | Built | Final UI phase | On hold / internal |
| --- | :---: | :---: | :---: | :---: | :---: | ---: | ---: | ---: | ---: |
| `catalog.category.read` | ✓ | ✓ | ✓ |  | ✓ | 5 | 5 | 0 | 0 |
| `catalog.category.create` | ✓ | ✓ | ✓ |  |  | 1 | 1 | 0 | 0 |
| `catalog.category.update` | ✓ | ✓ | ✓ |  |  | 3 | 3 | 0 | 0 |
| `catalog.category.delete` | ✓ | ✓ | ✓ |  |  | 2 | 2 | 0 | 0 |
| `catalog.category.reorder` | ✓ | ✓ | ✓ |  |  | 3 | 3 | 0 | 0 |
| `catalog.attribute.read` | ✓ | ✓ | ✓ |  |  | 4 | 4 | 0 | 0 |
| `catalog.attribute.create` | ✓ | ✓ | ✓ |  |  | 2 | 2 | 0 | 0 |
| `catalog.attribute.update` | ✓ | ✓ | ✓ |  |  | 7 | 7 | 0 | 0 |
| `catalog.attribute.delete` | ✓ | ✓ | ✓ |  |  | 3 | 3 | 0 | 0 |
| `catalog.product.read` | ✓ | ✓ | ✓ | ✓ | ✓ | 8 | 6 | 2 | 0 |
| `catalog.product.create` | ✓ | ✓ | ✓ |  |  | 3 | 3 | 0 | 0 |
| `catalog.product.update` | ✓ | ✓ | ✓ |  |  | 21 | 10 | 11 | 0 |
| `catalog.product.delete` | ✓ | ✓ | ✓ |  |  | 2 | 2 | 0 | 0 |
| `catalog.product.publish` | ✓ | ✓ | ✓ |  |  | 2 | 2 | 0 | 0 |
| `catalog.product.import` | ✓ | ✓ | ✓ |  |  | 3 | 3 | 0 | 0 |
| `catalog.product.export` | ✓ | ✓ | ✓ |  |  | 1 | 1 | 0 | 0 |
| `catalog.variant.read` | ✓ | ✓ | ✓ |  |  | 2 | 2 | 0 | 0 |
| `catalog.variant.create` | ✓ | ✓ | ✓ |  |  | 2 | 2 | 0 | 0 |
| `catalog.variant.update` | ✓ | ✓ | ✓ |  |  | 3 | 3 | 0 | 0 |
| `catalog.variant.delete` | ✓ | ✓ | ✓ |  |  | 1 | 1 | 0 | 0 |
| `catalog.collection.read` | ✓ | ✓ | ✓ |  |  | 2 | 2 | 0 | 0 |
| `catalog.collection.create` | ✓ | ✓ | ✓ |  |  | 1 | 1 | 0 | 0 |
| `catalog.collection.update` | ✓ | ✓ | ✓ |  |  | 7 | 6 | 1 | 0 |
| `catalog.collection.delete` | ✓ | ✓ | ✓ |  |  | 1 | 1 | 0 | 0 |
| `catalog.inventory.read` | ✓ | ✓ | ✓ | ✓ |  | 3 | 3 | 0 | 0 |
| `catalog.inventory.update` | ✓ | ✓ | ✓ | ✓ |  | 2 | 2 | 0 | 0 |
| `pricing.adjustment.read` | ✓ | ✓ | ✓ |  |  | 9 | 2 | 7 | 0 |
| `pricing.adjustment.create` | ✓ | ✓ | ✓ |  |  | 4 | 1 | 3 | 0 |
| `pricing.adjustment.update` | ✓ | ✓ | ✓ |  |  | 5 | 1 | 4 | 0 |
| `pricing.adjustment.delete` | ✓ | ✓ | ✓ |  |  | 4 | 1 | 3 | 0 |
| `pricing.tax.read` | ✓ | ✓ | ✓ |  |  | 5 | 1 | 4 | 0 |
| `pricing.tax.update` | ✓ | ✓ |  |  |  | 14 | 3 | 11 | 0 |
| `pricing.coupon.read` | ✓ | ✓ |  |  |  | 3 | 0 | 3 | 0 |
| `pricing.coupon.create` | ✓ | ✓ |  |  |  | 2 | 0 | 2 | 0 |
| `pricing.coupon.update` | ✓ | ✓ |  |  |  | 1 | 0 | 1 | 0 |
| `pricing.coupon.delete` | ✓ | ✓ |  |  |  | 1 | 0 | 1 | 0 |
| `media.asset.read` | ✓ | ✓ | ✓ |  | ✓ | 4 | 4 | 0 | 0 |
| `media.asset.upload` | ✓ | ✓ | ✓ |  | ✓ | 2 | 1 | 0 | 1 |
| `media.asset.update` | ✓ | ✓ | ✓ |  | ✓ | 5 | 5 | 0 | 0 |
| `media.asset.delete` | ✓ | ✓ | ✓ |  | ✓ | 6 | 5 | 1 | 0 |
| `order.order.read` | ✓ | ✓ |  | ✓ |  | 13 | 0 | 10 | 3 |
| `order.order.update` | ✓ | ✓ |  | ✓ |  | 8 | 0 | 2 | 6 |
| `order.order.cancel` | ✓ | ✓ |  | ✓ |  | 1 | 0 | 1 | 0 |
| `order.order.fulfil` | ✓ | ✓ |  | ✓ |  | 8 | 0 | 5 | 3 |
| `order.refund.read` | ✓ | ✓ |  | ✓ |  | 2 | 0 | 0 | 2 |
| `order.refund.create` | ✓ | ✓ |  | ✓ |  | 2 | 0 | 0 | 2 |
| `order.refund.approve` | ✓ | ✓ |  |  |  | 3 | 0 | 0 | 3 |
| `order.customer.read` | ✓ | ✓ |  | ✓ |  | 7 | 0 | 7 | 0 |
| `order.customer.update` | ✓ | ✓ |  | ✓ |  | 6 | 0 | 6 | 0 |
| `payment.settings.read` | ✓ | ✓ |  |  |  | 2 | 0 | 0 | 2 |
| `payment.settings.update` | ✓ |  |  |  |  | 3 | 0 | 0 | 3 |
| `payment.split.read` | ✓ | ✓ |  |  |  | 3 | 0 | 0 | 3 |
| `payment.split.update` | ✓ |  |  |  |  | 4 | 0 | 0 | 4 |
| `cms.page.read` | ✓ | ✓ |  |  | ✓ | 10 | 1 | 9 | 0 |
| `cms.page.create` | ✓ | ✓ |  |  | ✓ | 6 | 0 | 6 | 0 |
| `cms.page.update` | ✓ | ✓ |  |  | ✓ | 17 | 0 | 17 | 0 |
| `cms.page.delete` | ✓ | ✓ |  |  | ✓ | 5 | 0 | 5 | 0 |
| `cms.banner.read` | ✓ | ✓ |  |  | ✓ | 3 | 1 | 2 | 0 |
| `cms.banner.create` | ✓ | ✓ |  |  | ✓ | 2 | 0 | 2 | 0 |
| `cms.banner.update` | ✓ | ✓ |  |  | ✓ | 3 | 0 | 3 | 0 |
| `cms.banner.delete` | ✓ | ✓ |  |  | ✓ | 2 | 0 | 2 | 0 |
| `cms.navigation.read` | ✓ | ✓ | ✓ |  | ✓ | 2 | 0 | 2 | 0 |
| `cms.navigation.update` | ✓ | ✓ |  |  | ✓ | 4 | 0 | 4 | 0 |
| `cms.faq.read` | ✓ | ✓ |  |  | ✓ | 2 | 0 | 2 | 0 |
| `cms.faq.create` | ✓ | ✓ |  |  | ✓ | 2 | 0 | 2 | 0 |
| `cms.faq.update` | ✓ | ✓ |  |  | ✓ | 3 | 0 | 3 | 0 |
| `cms.faq.delete` | ✓ | ✓ |  |  | ✓ | 2 | 0 | 2 | 0 |
| `lead.enquiry.read` | ✓ | ✓ |  | ✓ | ✓ | 2 | 2 | 0 | 0 |
| `lead.enquiry.update` | ✓ | ✓ |  |  | ✓ | 1 | 0 | 1 | 0 |
| `lead.enquiry.assign` | ✓ | ✓ |  |  | ✓ | 1 | 0 | 1 | 0 |
| `system.user.read` | ✓ | ✓ |  |  |  | 1 | 1 | 0 | 0 |
| `system.user.create` | ✓ | ✓ |  |  |  | 1 | 1 | 0 | 0 |
| `system.user.update` | ✓ | ✓ |  |  |  | 3 | 3 | 0 | 0 |
| `system.user.delete` | ✓ |  |  |  |  | 1 | 1 | 0 | 0 |
| `system.role.read` | ✓ |  |  |  |  | 4 | 4 | 0 | 0 |
| `system.role.create` | ✓ |  |  |  |  | 1 | 1 | 0 | 0 |
| `system.role.update` | ✓ |  |  |  |  | 1 | 1 | 0 | 0 |
| `system.role.delete` | ✓ |  |  |  |  | 1 | 1 | 0 | 0 |
| `system.setting.read` | ✓ | ✓ |  |  |  | 2 | 0 | 1 | 1 |
| `system.setting.update` | ✓ | ✓ |  |  |  | 2 | 0 | 1 | 1 |
| `system.audit.read` | ✓ | ✓ |  |  |  | 1 | 1 | 0 | 0 |

Permissions that guard no admin route (5): `order.order.export`, `order.customer.block`, `order.customer.export`, `lead.enquiry.export`, `system.audit.export`.

## 5. Admin mutations: security and data integrity (211)

| Property | Mutations | Of |
| --- | ---: | ---: |
| CSRF token required (double submit) | 207 | 211 |
| Permission guard on the route, computed per request, or checked in the handler | 203 | 211 |
| Request validated by a schema (body, params or query) | 202 | 211 |
| POST/PUT/PATCH with a validated body | 141 | 171 |
| Idempotency-Key honoured | 18 | 211 |
| Rate limited | 16 | 211 |
| Versioned update (409 on a stale version) | 25 | 211 |
| Destructive: reversible / irreversible | 20 / 43 | 211 |

**Without a CSRF token (4)** — no session cookie exists yet, or the refresh cookie itself is the credential:

- `POST /auth/forgot-password` (public), rate limit `admin-forgot` — Email a reset token
- `POST /auth/login` (public), rate limit `admin-login` — Sign in; sets httpOnly session cookies + readable CSRF cookie
- `POST /auth/refresh` (public), rate limit `admin-refresh` — Rotate the session using the httpOnly refresh cookie
- `POST /auth/reset-password` (public), rate limit `admin-reset` — Redeem a reset/invite token

**Without a permission guard (8)** — act only on the caller's own session or account:

- `DELETE /auth/sessions/{id}` — End one of own sessions
- `POST /auth/change-password` — Change own password (clears mustChangePassword; other devices signed out)
- `POST /auth/forgot-password` (public), rate limit `admin-forgot` — Email a reset token
- `POST /auth/login` (public), rate limit `admin-login` — Sign in; sets httpOnly session cookies + readable CSRF cookie
- `POST /auth/logout` — End this session and clear cookies
- `POST /auth/logout-all` — End every session of the signed-in admin
- `POST /auth/refresh` (public), rate limit `admin-refresh` — Rotate the session using the httpOnly refresh cookie
- `POST /auth/reset-password` (public), rate limit `admin-reset` — Redeem a reset/invite token

**Permission checked in the handler, not in route middleware (2)**:

- `POST /catalog/import/{entity}`: in the controller, per entity (`assertImportAllowed`: `IMPORT_PERMISSIONS`, e.g. `catalog.product.import`)
- `POST /catalog/import/jobs/{id}/commit`: in the controller, before the job is read (`assertAnyImportAllowed`), then per entity

**POST/PUT/PATCH without a body schema (30)** — multipart uploads, or actions whose only input is the path:

- `POST /auth/logout` — End this session and clear cookies
- `POST /auth/logout-all` — End every session of the signed-in admin
- `POST /catalog/categories/{id}/restore` — Restore a soft-deleted category
- `POST /catalog/collections/{id}/restore` — Restore (AUTOMATIC ones re-evaluated)
- `POST /catalog/import/{entity}`, rate limit `catalog-import` — Upload a CSV; dry run by default (validates, writes nothing)
- `POST /catalog/import/jobs/{id}/commit`, rate limit `catalog-import` — Commit a validated job (re-attach the same file)
- `POST /catalog/products/{id}/restore` — Restore a deleted product
- `POST /catalog/products/{id}/unpublish` — Take a product off the storefront
- `POST /catalog/products/{id}/variants/{variantId}/set-default` — Make the single default variant
- `POST /cms/pages/{id}/preview` — Render including drafts (data, not HTML)
- `POST /cms/pages/{id}/publish` — Publish; 422 lists every blocker
- `POST /cms/pages/{id}/revisions/{version}/restore` — Restore a revision (writes a new revision)
- `POST /cms/pages/{id}/unpublish` — Unpublish
- `POST /collections/{id}/evaluate` — Materialise an AUTOMATIC collection now
- `POST /collections/evaluate-all` — Re-evaluate every AUTOMATIC collection
- `POST /media/{id}/replace`, rate limit `media-replace` — Replace an asset's file in place
- `POST /media/{id}/reprocess` — Regenerate renditions
- `POST /media/{id}/restore` — Restore a trashed asset
- `POST /media/upload`, rate limit `media-upload` — Upload files (multipart "files")
- `POST /orders/{id}/retry-transfers` — Retry failed payout legs
- `POST /orders/{orderNumber}/documents/invoice` — Issue the GST tax invoice (once; never regenerated)
- `POST /pricing/shipping-zones/{id}/pincodes/import`, rate limit `pincode-import` — Import pincodes from CSV (multipart "files" or csv field)
- `POST /refunds/{id}/credit-note` — Issue the credit note for a processed refund
- `POST /returns/{returnNumber}/complete` — Close, restock and raise the refund
- `POST /returns/{returnNumber}/receive` — Mark goods received
- `POST /search/popularity/recompute` — Recompute popularity scores
- `POST /search/reindex` — Start a (partial or full) reindex job
- `POST /seo/sitemap/rebuild` — Rebuild the sitemap cache
- `POST /shipments/{shipmentNumber}/sync` — Pull current state from the courier
- `POST /webhooks/{id}/replay` — Re-process a stored event

<details>
<summary>Every admin mutation</summary>

| Method | Path | Kind | Destructive | Permission | CSRF | Validation | Idempotency | Rate limit | Class |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DELETE | `/auth/sessions/{id}` | A | X | own session | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/catalog/attribute-groups/{id}` | D | X | `catalog.attribute.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/catalog/attribute-values/{valueId}` | D | X | `catalog.attribute.delete` | yes | — | — | — | UI required: built |
| DELETE | `/catalog/attributes/{id}` | D | X | `catalog.attribute.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/catalog/brands/{id}` | D | X | `catalog.product.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/catalog/categories/{id}` | D | R | `catalog.category.delete` | yes | params: idParamSchema; query: categoryDeleteQuerySchema | — | catalog-destructive | UI required: built |
| DELETE | `/catalog/categories/{id}/attributes/{attributeId}` | D | X | `catalog.attribute.update` | yes | params: idParamSchema.extend({ attributeId: idParamSchema.shape.id }) | — | — | UI required: built |
| DELETE | `/catalog/collections/{id}` | D | R | `catalog.collection.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/catalog/price-adjustments/{id}` | D | X | `pricing.adjustment.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/catalog/products/{id}` | D | R | `catalog.product.delete` | yes | params: idParamSchema | — | catalog-destructive | UI required: built |
| DELETE | `/catalog/products/{id}/variants/{variantId}` | D | X | `catalog.variant.delete` | yes | params: idParamSchema.extend({ variantId: idParamSchema.shape.id }) | — | — | UI required: built |
| DELETE | `/catalog/tax-classes/{id}` | D | X | `pricing.tax.update` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/cms/announcements/{id}` | D | X | `cms.banner.delete` | yes | params: idParamSchema | — | — | UI required: final UI phase |
| DELETE | `/cms/banners/{id}` | D | X | `cms.banner.delete` | yes | params: idParamSchema | — | — | UI required: final UI phase |
| DELETE | `/cms/faq-categories/{id}` | D | X | `cms.faq.delete` | yes | params: idParamSchema | — | — | UI required: final UI phase |
| DELETE | `/cms/faqs/{id}` | D | X | `cms.faq.delete` | yes | params: idParamSchema | — | — | UI required: final UI phase |
| DELETE | `/cms/help/articles/{id}` | D | X | `cms.page.delete` | yes | params: idParamSchema | — | — | UI required: final UI phase |
| DELETE | `/cms/help/categories/{id}` | D | X | `cms.page.delete` | yes | params: idParamSchema | — | — | UI required: final UI phase |
| DELETE | `/cms/pages/{id}` | D | X | `cms.page.delete` | yes | params: idParamSchema | — | — | UI required: final UI phase |
| DELETE | `/cms/pages/{id}/blocks/{blockId}` | D | R | `cms.page.update` | yes | — | — | — | UI required: final UI phase |
| DELETE | `/cms/stores/{id}` | D | X | `cms.page.delete` | yes | params: idParamSchema | — | — | UI required: final UI phase |
| DELETE | `/cms/testimonials/{id}` | D | X | `cms.page.delete` | yes | params: idParamSchema | — | — | UI required: final UI phase |
| DELETE | `/media-folders/{id}` | D | X | `media.asset.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/media/{id}` | D | R | `media.asset.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/media/{id}/permanent` | D | X | `media.asset.delete` | yes | params: idParamSchema; query: mediaHardDeleteQuerySchema | — | — | UI required: built |
| DELETE | `/navigation/items/{id}` | D | X | `cms.navigation.update` | yes | params: idParamSchema | — | — | UI required: final UI phase |
| DELETE | `/payments/split-rules/{id}` | D | X | `payment.split.update` | yes | params: idParamSchema | — | — | On hold (integration) |
| DELETE | `/pricing/coupons/{id}` | D | X | `pricing.coupon.delete` | yes | params: idParamSchema | — | — | UI required: final UI phase |
| DELETE | `/pricing/customer-groups/{id}` | D | X | `order.customer.update` | yes | params: idParamSchema | — | — | UI required: final UI phase |
| DELETE | `/pricing/customer-groups/{id}/members` | A | - | `order.customer.update` | yes | params: idParamSchema; body: customerGroupMembersSchema | — | — | UI required: final UI phase |
| DELETE | `/pricing/discount-rules/{id}` | D | X | `pricing.adjustment.delete` | yes | params: idParamSchema | — | — | UI required: final UI phase |
| DELETE | `/pricing/price-lists/{id}` | D | X | `pricing.adjustment.delete` | yes | params: idParamSchema | — | — | UI required: final UI phase |
| DELETE | `/pricing/shipping-pincodes/{id}` | D | X | `pricing.tax.update` | yes | params: idParamSchema | — | — | UI required: final UI phase |
| DELETE | `/pricing/shipping-rates/{id}` | D | X | `pricing.tax.update` | yes | params: idParamSchema | — | — | UI required: final UI phase |
| DELETE | `/pricing/shipping-zones/{id}` | D | X | `pricing.tax.update` | yes | params: idParamSchema | — | — | UI required: final UI phase |
| DELETE | `/pricing/tier-prices/{id}` | D | X | `pricing.adjustment.delete` | yes | params: idParamSchema | — | — | UI required: final UI phase |
| DELETE | `/products/{productId}/media/{id}` | D | R | `catalog.product.update` | yes | params: productMediaItemParamsSchema | — | — | UI required: built |
| DELETE | `/roles/{id}` | D | X | `system.role.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/search/synonyms/{term}` | D | X | `catalog.product.update` | yes | params: synonymTermParamSchema | — | — | UI required: final UI phase |
| DELETE | `/users/{id}` | D | X | `system.user.delete` | yes | params: idParamSchema | — | — | UI required: built |
| PATCH | `/catalog/attribute-groups/{id}` | u | - | `catalog.attribute.update` | yes | params: idParamSchema; body: attributeGroupUpdateSchema | — | — | UI required: built |
| PATCH | `/catalog/attribute-values/{valueId}` | U | - | `catalog.attribute.update` | yes | body: attributeValueUpdateSchema | — | — | UI required: built |
| PATCH | `/catalog/attributes/{id}` | U | - | `catalog.attribute.update` | yes | params: idParamSchema; body: attributeUpdateSchema | — | — | UI required: built |
| PATCH | `/catalog/brands/{id}` | U | - | `catalog.product.update` | yes | params: idParamSchema; body: brandUpdateSchema | — | — | UI required: built |
| PATCH | `/catalog/categories/{id}` | U | - | `catalog.category.update` | yes | params: idParamSchema; body: categoryUpdateSchema | — | — | UI required: built |
| PATCH | `/catalog/collections/{id}` | U | - | `catalog.collection.update` | yes | params: idParamSchema; body: collectionUpdateSchema | — | — | UI required: built |
| PATCH | `/catalog/price-adjustments/{id}` | U | - | `pricing.adjustment.update` | yes | params: idParamSchema; body: priceAdjustmentUpdateSchema | — | — | UI required: built |
| PATCH | `/catalog/products/{id}` | U | - | `catalog.product.update` | yes | params: idParamSchema; body: productUpdateSchema | — | — | UI required: built |
| PATCH | `/catalog/products/{id}/variants/{variantId}` | U | - | `catalog.variant.update` | yes | params: idParamSchema.extend({ variantId: idParamSchema.shape.id }); body: variantUpdateSchema | — | — | UI required: built |
| PATCH | `/catalog/tax-classes/{id}` | u | - | `pricing.tax.update` | yes | params: idParamSchema; body: taxClassUpdateSchema | — | — | UI required: built |
| PATCH | `/cms/announcements/{id}` | U | R | `cms.banner.update` | yes | params: idParamSchema; body: announcementUpdateSchema | — | — | UI required: final UI phase |
| PATCH | `/cms/banners/{id}` | U | R | `cms.banner.update` | yes | params: idParamSchema; body: bannerUpdateSchema | — | — | UI required: final UI phase |
| PATCH | `/cms/faq-categories/{id}` | U | - | `cms.faq.update` | yes | params: idParamSchema; body: faqCategoryUpdateSchema | — | — | UI required: final UI phase |
| PATCH | `/cms/faqs/{id}` | U | R | `cms.faq.update` | yes | params: idParamSchema; body: faqUpdateSchema | — | — | UI required: final UI phase |
| PATCH | `/cms/help/articles/{id}` | U | R | `cms.page.update` | yes | params: idParamSchema; body: helpArticleUpdateSchema | — | — | UI required: final UI phase |
| PATCH | `/cms/help/categories/{id}` | U | - | `cms.page.update` | yes | params: idParamSchema; body: helpCategoryUpdateSchema | — | — | UI required: final UI phase |
| PATCH | `/cms/pages/{id}` | U | - | `cms.page.update` | yes | params: idParamSchema; body: pageUpdateSchema | — | — | UI required: final UI phase |
| PATCH | `/cms/pages/{id}/blocks/{blockId}` | u | - | `cms.page.update` | yes | body: blockUpdateSchema | — | — | UI required: final UI phase |
| PATCH | `/cms/stores/{id}` | U | R | `cms.page.update` | yes | params: idParamSchema; body: storeUpdateSchema | — | — | UI required: final UI phase |
| PATCH | `/cms/testimonials/{id}` | U | R | `cms.page.update` | yes | params: idParamSchema; body: testimonialUpdateSchema | — | — | UI required: final UI phase |
| PATCH | `/enquiries/{id}` | U | - | `lead.enquiry.update` | yes | params: idParamSchema; body: enquiryUpdateSchema | — | — | UI required: final UI phase |
| PATCH | `/media-folders/{id}` | u | - | `media.asset.update` | yes | params: idParamSchema; body: mediaFolderUpdateSchema | — | — | UI required: built |
| PATCH | `/media/{id}` | u | - | `media.asset.update` | yes | params: idParamSchema; body: mediaUpdateSchema | — | — | UI required: built |
| PATCH | `/navigation/items/{id}` | u | R | `cms.navigation.update` | yes | params: idParamSchema; body: navigationItemUpdateSchema | — | — | UI required: final UI phase |
| PATCH | `/payments/split-accounts/{id}` | U | - | `payment.settings.update` | yes | params: idParamSchema; body: splitAccountUpdateSchema | — | — | On hold (integration) |
| PATCH | `/payments/split-rules/{id}` | u | - | `payment.split.update` | yes | params: idParamSchema; body: splitRuleUpdateSchema | — | — | On hold (integration) |
| PATCH | `/pricing/coupons/{id}` | U | R | `pricing.coupon.update` | yes | params: idParamSchema; body: couponUpdateSchema | — | — | UI required: final UI phase |
| PATCH | `/pricing/customer-groups/{id}` | U | - | `order.customer.update` | yes | params: idParamSchema; body: customerGroupUpdateSchema | — | — | UI required: final UI phase |
| PATCH | `/pricing/discount-rules/{id}` | U | - | `pricing.adjustment.update` | yes | params: idParamSchema; body: discountRuleUpdateSchema | — | — | UI required: final UI phase |
| PATCH | `/pricing/price-lists/{id}` | U | - | `pricing.adjustment.update` | yes | params: idParamSchema; body: priceListUpdateSchema | — | — | UI required: final UI phase |
| PATCH | `/pricing/shipping-rates/{id}` | U | - | `pricing.tax.update` | yes | params: idParamSchema; body: shippingRateUpdateSchema | — | — | UI required: final UI phase |
| PATCH | `/pricing/shipping-zones/{id}` | U | - | `pricing.tax.update` | yes | params: idParamSchema; body: shippingZoneUpdateSchema | — | — | UI required: final UI phase |
| PATCH | `/pricing/tier-prices/{id}` | u | - | `pricing.adjustment.update` | yes | params: idParamSchema; body: tierPriceUpdateSchema | — | — | UI required: final UI phase |
| PATCH | `/products/{productId}/media/{id}` | u | - | `catalog.product.update` | yes | params: productMediaItemParamsSchema; body: productMediaUpdateSchema | — | — | UI required: built |
| PATCH | `/products/{productId}/media/reorder` | R | - | `catalog.product.update` | yes | params: productMediaParamsSchema; body: productMediaReorderSchema | — | — | UI required: built |
| PATCH | `/roles/{id}` | u | - | `system.role.update` | yes | params: idParamSchema; body: roleUpdateSchema | — | — | UI required: built |
| PATCH | `/search/synonyms/{term}` | u | - | `catalog.product.update` | yes | params: synonymTermParamSchema; body: synonymUpdateSchema | — | — | UI required: final UI phase |
| PATCH | `/users/{id}` | u | R | `system.user.update` | yes | params: idParamSchema; body: adminUserUpdateSchema | — | — | UI required: built |
| POST | `/auth/change-password` | AU | - | own session | yes | body: changePasswordSchema | — | — | UI required: built |
| POST | `/auth/forgot-password` | AU | - | public | **no** | body: forgotPasswordSchema | — | admin-forgot | On hold (integration) |
| POST | `/auth/login` | AU | - | public | **no** | body: adminLoginSchema | — | admin-login | UI required: built |
| POST | `/auth/logout` | AU | - | own session | yes | — | — | — | UI required: built |
| POST | `/auth/logout-all` | AU | X | own session | yes | — | — | — | UI required: built |
| POST | `/auth/refresh` | AU | - | public | **no** | body: refreshSchema | — | admin-refresh | UI required: built |
| POST | `/auth/reset-password` | AU | - | public | **no** | body: resetPasswordSchema | — | admin-reset | On hold (integration) |
| POST | `/carts/cleanup` | A | X | `order.customer.update` | yes | body: cartCleanupSchema | — | — | UI required: final UI phase |
| POST | `/catalog/attribute-groups` | C | - | `catalog.attribute.create` | yes | body: attributeGroupCreateSchema | — | — | UI required: built |
| POST | `/catalog/attributes` | C | - | `catalog.attribute.create` | yes | body: attributeCreateSchema | — | — | UI required: built |
| POST | `/catalog/attributes/{id}/values` | C | - | `catalog.attribute.update` | yes | params: idParamSchema; body: attributeValueCreateSchema | — | — | UI required: built |
| POST | `/catalog/attributes/reorder` | R | - | `catalog.attribute.update` | yes | body: reorderSchema | — | — | UI required: built |
| POST | `/catalog/brands` | C | - | `catalog.product.create` | yes | body: brandCreateSchema | — | — | UI required: built |
| POST | `/catalog/bulk` | A | R | `catalog.product.read` | yes | body: bulkActionSchema | yes | catalog-bulk | UI required: built |
| POST | `/catalog/categories` | C | - | `catalog.category.create` | yes | body: categoryCreateSchema | yes | — | UI required: built |
| POST | `/catalog/categories/{id}/attributes` | A | - | `catalog.attribute.update` | yes | params: idParamSchema; body: categoryAttributeUpsertSchema | — | — | UI required: built |
| POST | `/catalog/categories/{id}/move` | A | - | `catalog.category.reorder` | yes | params: idParamSchema; body: categoryMoveSchema | — | — | UI required: built |
| POST | `/catalog/categories/{id}/products/reorder` | R | - | `catalog.category.reorder` | yes | params: idParamSchema; body: reorderSchema | — | — | UI required: built |
| POST | `/catalog/categories/{id}/restore` | A | - | `catalog.category.update` | yes | params: idParamSchema | — | — | UI required: built |
| POST | `/catalog/categories/bulk` | A | R | `catalog.category.update` | yes | body: categoryBulkSchema | — | catalog-bulk | UI required: built |
| POST | `/catalog/categories/reorder` | R | - | `catalog.category.reorder` | yes | body: reorderSchema | — | — | UI required: built |
| POST | `/catalog/collections` | C | - | `catalog.collection.create` | yes | body: collectionCreateSchema | — | — | UI required: built |
| POST | `/catalog/collections/{id}/products/reorder` | R | - | `catalog.collection.update` | yes | params: idParamSchema; body: reorderSchema | — | — | UI required: built |
| POST | `/catalog/collections/{id}/restore` | A | - | `catalog.collection.update` | yes | params: idParamSchema | — | — | UI required: built |
| POST | `/catalog/import/{entity}` | UP | - | in the controller, per entity (`assertImportAllowed`: `IMPORT_PERMISSIONS`, e.g. `catalog.product.import`) | yes | params: importEntityParamSchema | — | catalog-import | UI required: built |
| POST | `/catalog/import/jobs/{id}/commit` | A | X | in the controller, before the job is read (`assertAnyImportAllowed`), then per entity | yes | params: idParamSchema | yes | catalog-import | UI required: built |
| POST | `/catalog/inventory/bulk-adjust` | A | - | `catalog.inventory.update` | yes | body: inventoryBulkAdjustSchema | yes | inventory-bulk | UI required: built |
| POST | `/catalog/price-adjustments` | C | - | `pricing.adjustment.create` | yes | body: priceAdjustmentCreateSchema | — | — | UI required: built |
| POST | `/catalog/products` | C | - | `catalog.product.create` | yes | body: productCreateSchema | yes | — | UI required: built |
| POST | `/catalog/products/{id}/duplicate` | C | - | `catalog.product.create` | yes | params: idParamSchema; body: productDuplicateSchema | yes | — | UI required: built |
| POST | `/catalog/products/{id}/publish` | A | - | `catalog.product.publish` | yes | params: idParamSchema; body: productPublishSchema | — | — | UI required: built |
| POST | `/catalog/products/{id}/restore` | A | - | `catalog.product.update` | yes | params: idParamSchema | — | — | UI required: built |
| POST | `/catalog/products/{id}/unpublish` | A | R | `catalog.product.publish` | yes | params: idParamSchema | — | — | UI required: built |
| POST | `/catalog/products/{id}/variants` | C | - | `catalog.variant.create` | yes | params: idParamSchema; body: variantCreateSchema | — | — | UI required: built |
| POST | `/catalog/products/{id}/variants/{variantId}/set-default` | A | - | `catalog.variant.update` | yes | params: idParamSchema.extend({ variantId: idParamSchema.shape.id }) | — | — | UI required: built |
| POST | `/catalog/products/{id}/variants/matrix/generate` | C | - | `catalog.variant.create` | yes | params: idParamSchema; body: variantMatrixSchema | yes | — | UI required: built |
| POST | `/catalog/products/{id}/variants/matrix/preview` | P | - | `catalog.variant.read` | yes | params: idParamSchema; body: variantMatrixSchema | — | — | UI required: built |
| POST | `/catalog/products/{id}/variants/reorder` | R | - | `catalog.variant.update` | yes | params: idParamSchema; body: reorderSchema | — | — | UI required: built |
| POST | `/catalog/tax-classes` | C | - | `pricing.tax.update` | yes | body: taxClassCreateSchema | — | — | UI required: built |
| POST | `/catalog/variants/{id}/inventory/adjust` | A | - | `catalog.inventory.update` | yes | params: idParamSchema; body: inventoryAdjustSchema | yes | — | UI required: built |
| POST | `/cms/announcements` | C | - | `cms.banner.create` | yes | body: announcementCreateSchema | — | — | UI required: final UI phase |
| POST | `/cms/banners` | C | - | `cms.banner.create` | yes | body: bannerCreateSchema | — | — | UI required: final UI phase |
| POST | `/cms/banners/reorder` | R | - | `cms.banner.update` | yes | body: cmsReorderSchema | — | — | UI required: final UI phase |
| POST | `/cms/faq-categories` | C | - | `cms.faq.create` | yes | body: faqCategoryCreateSchema | — | — | UI required: final UI phase |
| POST | `/cms/faqs` | C | - | `cms.faq.create` | yes | body: faqCreateSchema | — | — | UI required: final UI phase |
| POST | `/cms/faqs/reorder` | R | - | `cms.faq.update` | yes | body: cmsReorderSchema | — | — | UI required: final UI phase |
| POST | `/cms/help/articles` | C | - | `cms.page.create` | yes | body: helpArticleCreateSchema | — | — | UI required: final UI phase |
| POST | `/cms/help/articles/reorder` | R | - | `cms.page.update` | yes | body: cmsReorderSchema | — | — | UI required: final UI phase |
| POST | `/cms/help/categories` | C | - | `cms.page.create` | yes | body: helpCategoryCreateSchema | — | — | UI required: final UI phase |
| POST | `/cms/pages` | C | - | `cms.page.create` | yes | body: pageCreateSchema | — | — | UI required: final UI phase |
| POST | `/cms/pages/{id}/blocks` | C | - | `cms.page.update` | yes | params: idParamSchema; body: blockCreateSchema | — | — | UI required: final UI phase |
| POST | `/cms/pages/{id}/blocks/reorder` | R | - | `cms.page.update` | yes | params: idParamSchema; body: blockReorderSchema | — | — | UI required: final UI phase |
| POST | `/cms/pages/{id}/duplicate` | C | - | `cms.page.create` | yes | params: idParamSchema; body: pageDuplicateSchema | — | — | UI required: final UI phase |
| POST | `/cms/pages/{id}/preview` | P | - | `cms.page.read` | yes | params: idParamSchema | — | — | UI required: final UI phase |
| POST | `/cms/pages/{id}/publish` | A | - | `cms.page.update` | yes | params: idParamSchema | — | — | UI required: final UI phase |
| POST | `/cms/pages/{id}/revisions/{version}/restore` | A | - | `cms.page.update` | yes | — | — | — | UI required: final UI phase |
| POST | `/cms/pages/{id}/schedule` | A | - | `cms.page.update` | yes | params: idParamSchema; body: pageScheduleSchema | — | — | UI required: final UI phase |
| POST | `/cms/pages/{id}/unpublish` | A | R | `cms.page.update` | yes | params: idParamSchema | — | — | UI required: final UI phase |
| POST | `/cms/stores` | C | - | `cms.page.create` | yes | body: storeCreateSchema | — | — | UI required: final UI phase |
| POST | `/cms/stores/reorder` | R | - | `cms.page.update` | yes | body: cmsReorderSchema | — | — | UI required: final UI phase |
| POST | `/cms/testimonials` | C | - | `cms.page.create` | yes | body: testimonialCreateSchema | — | — | UI required: final UI phase |
| POST | `/cms/testimonials/reorder` | R | - | `cms.page.update` | yes | body: cmsReorderSchema | — | — | UI required: final UI phase |
| POST | `/collections/{id}/evaluate` | A | - | `catalog.collection.update` | yes | params: idParamSchema | — | — | UI required: built |
| POST | `/collections/evaluate-all` | A | - | `catalog.collection.update` | yes | — | — | — | UI required: final UI phase |
| POST | `/collections/rules/preview` | P | - | `catalog.collection.update` | yes | body: collectionRulePreviewSchema | — | — | UI required: built |
| POST | `/media-folders` | C | - | `media.asset.update` | yes | body: mediaFolderCreateSchema | — | — | UI required: built |
| POST | `/media/{id}/replace` | UP | - | `media.asset.update` | yes | params: idParamSchema | — | media-replace | UI required: built |
| POST | `/media/{id}/reprocess` | A | - | `media.asset.update` | yes | params: idParamSchema | — | — | UI required: built |
| POST | `/media/{id}/restore` | A | - | `media.asset.delete` | yes | params: idParamSchema | — | — | UI required: built |
| POST | `/media/bulk-delete` | D | R | `media.asset.delete` | yes | body: mediaBulkDeleteSchema | — | — | UI required: built |
| POST | `/media/presign` | A | - | `media.asset.upload` | yes | body: mediaPresignSchema | — | media-presign | Internal / system |
| POST | `/media/upload` | UP | - | `media.asset.upload` | yes | — | — | media-upload | UI required: built |
| POST | `/navigation/{key}/items` | C | - | `cms.navigation.update` | yes | params: menuKeyParamSchema; body: navigationItemCreateSchema | — | — | UI required: final UI phase |
| POST | `/navigation/{key}/reorder` | R | - | `cms.navigation.update` | yes | params: menuKeyParamSchema; body: cmsReorderSchema | — | — | UI required: final UI phase |
| POST | `/ndr/{id}/action` | A | - | `order.order.fulfil` | yes | params: idParamSchema; body: ndrActionSchema | — | — | UI required: final UI phase |
| POST | `/orders/{id}/cancel` | A | X | `order.order.cancel` | yes | params: idParamSchema; body: orderCancelSchema | — | — | UI required: final UI phase |
| POST | `/orders/{id}/retry-transfers` | A | - | `payment.split.update` | yes | params: idParamSchema | — | — | On hold (integration) |
| POST | `/orders/{id}/status` | A | - | `order.order.update` | yes | params: idParamSchema; body: adminOrderStatusSchema | — | — | UI required: final UI phase |
| POST | `/orders/{orderNumber}/documents/invoice` | A | X | `order.order.update` | yes | params: orderNumberParamSchema | yes | — | UI required: final UI phase |
| POST | `/orders/{orderNumber}/refunds` | C | - | `order.refund.create` | yes | params: orderNumberParamSchema; body: refundRequestSchema | yes | — | On hold (integration) |
| POST | `/orders/{orderNumber}/refunds/preview` | P | - | `order.refund.read` | yes | params: orderNumberParamSchema; body: refundPreviewSchema | — | — | On hold (integration) |
| POST | `/orders/{orderNumber}/shipments` | C | - | `order.order.fulfil` | yes | params: orderNumberParamSchema; body: shipmentCreateSchema | yes | — | UI required: final UI phase |
| POST | `/orders/reconcile` | A | - | `order.order.update` | yes | body: reconcileSchema | — | — | On hold (integration) |
| POST | `/payments/split-accounts` | C | - | `payment.settings.update` | yes | body: splitAccountCreateSchema | — | — | On hold (integration) |
| POST | `/payments/split-rules` | C | - | `payment.split.update` | yes | body: splitRuleCreateSchema | — | — | On hold (integration) |
| POST | `/payments/split-simulate` | P | - | `payment.split.read` | yes | body: splitSimulateSchema | — | — | On hold (integration) |
| POST | `/pricing/coupons` | C | - | `pricing.coupon.create` | yes | body: couponCreateSchema | yes | — | UI required: final UI phase |
| POST | `/pricing/coupons/bulk-generate` | C | - | `pricing.coupon.create` | yes | body: couponBulkGenerateSchema | yes | coupon-bulk | UI required: final UI phase |
| POST | `/pricing/customer-groups` | C | - | `order.customer.update` | yes | body: customerGroupCreateSchema | yes | — | UI required: final UI phase |
| POST | `/pricing/customer-groups/{id}/members` | A | - | `order.customer.update` | yes | params: idParamSchema; body: customerGroupMembersSchema | — | — | UI required: final UI phase |
| POST | `/pricing/discount-rules` | C | - | `pricing.adjustment.create` | yes | body: discountRuleCreateSchema | — | — | UI required: final UI phase |
| POST | `/pricing/discount-rules/evaluate` | P | - | `pricing.adjustment.read` | yes | body: simulateSchema | — | — | UI required: final UI phase |
| POST | `/pricing/price-lists` | C | - | `pricing.adjustment.create` | yes | body: priceListCreateSchema | yes | — | UI required: final UI phase |
| POST | `/pricing/shipping-pincode-ranges` | C | - | `pricing.tax.update` | yes | body: shippingPincodeRangeCreateSchema | — | — | UI required: final UI phase |
| POST | `/pricing/shipping-pincodes` | C | - | `pricing.tax.update` | yes | body: shippingPincodeCreateSchema | — | — | UI required: final UI phase |
| POST | `/pricing/shipping-rates` | C | - | `pricing.tax.update` | yes | body: shippingRateCreateSchema | — | — | UI required: final UI phase |
| POST | `/pricing/shipping-zones` | C | - | `pricing.tax.update` | yes | body: shippingZoneCreateSchema | — | — | UI required: final UI phase |
| POST | `/pricing/shipping-zones/{id}/pincodes/import` | UP | - | `pricing.tax.update` | yes | params: idParamSchema | — | pincode-import | UI required: final UI phase |
| POST | `/pricing/simulate` | P | - | `pricing.adjustment.read` | yes | body: simulateSchema | — | — | UI required: final UI phase |
| POST | `/pricing/tier-prices` | C | - | `pricing.adjustment.create` | yes | body: tierPriceCreateSchema | — | — | UI required: final UI phase |
| POST | `/products/{productId}/media` | A | - | `catalog.product.update` | yes | params: productMediaParamsSchema; body: productMediaAttachSchema | — | — | UI required: built |
| POST | `/refunds/{id}/approve` | A | - | `order.refund.approve` | yes | params: idParamSchema; body: refundApproveSchema | — | — | On hold (integration) |
| POST | `/refunds/{id}/credit-note` | A | X | `order.refund.approve` | yes | params: idParamSchema | yes | — | On hold (integration) |
| POST | `/refunds/{id}/execute` | A | X | `order.refund.approve` | yes | params: idParamSchema; body: refundExecuteSchema | yes | — | On hold (integration) |
| POST | `/returns/{returnNumber}/approve` | A | - | `order.order.update` | yes | params: returnNumberParamSchema; body: returnApproveSchema | — | — | On hold (integration) |
| POST | `/returns/{returnNumber}/complete` | A | X | `order.refund.create` | yes | params: returnNumberParamSchema | — | — | On hold (integration) |
| POST | `/returns/{returnNumber}/inspect` | A | - | `order.order.update` | yes | params: returnNumberParamSchema; body: returnInspectSchema | — | — | On hold (integration) |
| POST | `/returns/{returnNumber}/receive` | A | - | `order.order.update` | yes | params: returnNumberParamSchema | — | — | On hold (integration) |
| POST | `/returns/{returnNumber}/reject` | A | - | `order.order.update` | yes | params: returnNumberParamSchema; body: returnRejectSchema | — | — | On hold (integration) |
| POST | `/roles` | C | - | `system.role.create` | yes | body: roleCreateSchema | — | — | UI required: built |
| POST | `/search/popularity/recompute` | A | - | `catalog.product.update` | yes | — | — | — | UI required: final UI phase |
| POST | `/search/reindex` | A | - | `catalog.product.update` | yes | query: reindexQuerySchema | — | — | UI required: final UI phase |
| POST | `/search/synonyms` | C | - | `catalog.product.update` | yes | body: synonymCreateSchema | — | — | UI required: final UI phase |
| POST | `/seo/sitemap/rebuild` | A | - | `cms.page.update` | yes | — | — | — | UI required: final UI phase |
| POST | `/shipments/{shipmentNumber}/awb` | A | - | `order.order.fulfil` | yes | params: shipmentNumberParamSchema; body: assignAwbSchema | yes | — | UI required: final UI phase |
| POST | `/shipments/{shipmentNumber}/cancel` | A | X | `order.order.fulfil` | yes | params: shipmentNumberParamSchema; body: shipmentCancelSchema | — | — | UI required: final UI phase |
| POST | `/shipments/{shipmentNumber}/pickup` | A | - | `order.order.fulfil` | yes | params: shipmentNumberParamSchema; body: schedulePickupSchema | — | — | On hold (integration) |
| POST | `/shipments/{shipmentNumber}/status` | A | - | `order.order.fulfil` | yes | params: shipmentNumberParamSchema; body: shipmentStatusSchema | — | — | UI required: final UI phase |
| POST | `/shipments/{shipmentNumber}/sync` | A | - | `order.order.fulfil` | yes | params: shipmentNumberParamSchema | — | — | On hold (integration) |
| POST | `/users` | C | - | `system.user.create` | yes | body: adminUserCreateSchema | — | — | UI required: built |
| POST | `/users/{id}/password` | A | X | `system.user.update` | yes | params: idParamSchema; body: adminPasswordSetSchema | — | — | UI required: built |
| POST | `/users/{id}/roles` | A | - | `system.user.update` + `system.role.read` | yes | params: idParamSchema; body: assignRolesSchema | — | — | UI required: built |
| POST | `/webhooks/{id}/replay` | A | - | `order.order.update` | yes | params: idParamSchema | — | — | On hold (integration) |
| PUT | `/catalog/collections/{id}/products` | A | - | `catalog.collection.update` | yes | params: idParamSchema; body: collectionProductsSchema | — | — | UI required: built |
| PUT | `/catalog/products/{id}/attribute-values` | A | - | `catalog.product.update` | yes | params: idParamSchema; body: productAttributeValuesSchema | — | — | UI required: built |
| PUT | `/catalog/products/{id}/categories` | A | - | `catalog.product.update` | yes | params: idParamSchema; body: productCategoriesSchema | — | — | UI required: built |
| PUT | `/catalog/products/{id}/relations` | A | - | `catalog.product.update` | yes | params: idParamSchema; body: productRelationsSchema | — | — | UI required: final UI phase |
| PUT | `/catalog/settings` | u | - | `catalog.product.update` | yes | body: catalogSettingsUpdateSchema | — | — | UI required: final UI phase |
| PUT | `/content/settings` | u | - | `system.setting.update` | yes | body: contentSettingsSchema | — | — | UI required: final UI phase |
| PUT | `/notifications/templates` | u | - | `system.setting.update` | yes | body: notificationTemplateSchema | — | — | On hold (integration) |
| PUT | `/payments/settings` | u | - | `payment.settings.update` | yes | body: paymentSettingsSchema | — | — | On hold (integration) |
| PUT | `/pricing/price-lists/{id}/items` | A | - | `pricing.adjustment.update` | yes | params: idParamSchema; body: priceListItemsSchema | — | — | UI required: final UI phase |
| PUT | `/pricing/settings` | u | - | `pricing.tax.update` | yes | body: pricingSettingsUpdateSchema | — | — | UI required: final UI phase |

</details>

## 6. Missing backend capabilities (6)

Not offered by the API at `c553f92`. The admin shows none of them and imitates none of them.

| Area | Capability | What exists today | What it would need |
| --- | --- | --- | --- |
| Customers | Customer directory and search (F9) | customer groups add and remove members by customer id; a cart is read by customer id (GET /customers/{id}/cart) | an admin customer list/search endpoint behind order.customer.read |
| Business enquiries | A quote (amount or document) on an enquiry | status QUOTED plus one admin note; the customer then places a normal order on the storefront | a quote field or entity, and a decision on who issues quotes |
| Business enquiries | Discussion history on an enquiry | one admin note (adminNote), replaced on each save | an enquiry notes or messages endpoint |
| Business enquiries | Link an enquiry to the order it became | no reference between an enquiry and an order | an order reference on the enquiry, or a conversion endpoint |
| Orders | Orders created by an admin on a customer’s behalf | orders are created only by customers at checkout | an admin order-creation endpoint and a product decision |
| Media | Direct (presigned) uploads | POST /media/presign is classified internal; every upload goes through POST /media/upload | a completion endpoint that validates and processes the uploaded object |

## 7. OpenAPI coverage

The backend's OpenAPI document does not describe 172 of 437 routes (its ratchet list
`docs/openapi-debt.json`, which may only shrink): 142 of 318 admin routes, of which
89 are already used by the admin. The admin's contract is the pinned route inventory and the
vendored shared types, both checked on every build, so this is documentation debt rather than contract drift.
