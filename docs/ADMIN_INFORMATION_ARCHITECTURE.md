# ClearWood Admin — Information Architecture

Built only from endpoints that exist at backend `b5861fd` (first written at `2fa6db0`). Every screen
below is backed by the routes listed in [ADMIN_API_COVERAGE.md](ADMIN_API_COVERAGE.md); nothing is a
placeholder. The navigation below is implemented in `src/config/navigation.ts` (unit-tested against
the seeded roles); entries appear once their phase is delivered.

## 1. Principles

1. **One screen per business job**, named in the operator's words ("Delivery charges", not
   "shipping-rates").
2. **Every page answers**: What is this? What can I do here? What happens if I do it? What status is
   this item in? What am I allowed to do? What should I do next? → a `PageHeader` with a one-line
   description, a status legend where statuses exist, and contextual next steps.
3. **Permission-aware**: a navigation entry appears only if the signed-in admin holds its read
   permission; actions inside follow their own permissions (hide / disable-with-reason / read-only).
4. **No empty areas**: sections without an admin API (customer directory, payments, returns) do not
   exist in the navigation. On-hold integrations are explained once, on System status.

## 2. Navigation

`Ph` = build phase from the implementation plan. Permission = what is needed to **see** the entry.

| Group | Entry | Route | Permission to see | Ph |
| --- | --- | --- | --- | --- |
| — | Dashboard | `/` | any admin | P0 → grows each phase |
| **Catalog** | Products | `/catalog/products` | `catalog.product.read` | P4 |
| | Categories | `/catalog/categories` | `catalog.category.read` | P3 |
| | Attributes | `/catalog/attributes` | `catalog.attribute.read` | P3 |
| | Attribute values | `/catalog/attribute-values` | `catalog.attribute.read` | P3 |
| | Brands | `/catalog/brands` | `catalog.product.read` | P3 |
| | Variants | `/catalog/variants` | `catalog.variant.read` | P4 |
| | Inventory | `/catalog/inventory` | `catalog.inventory.read` | P4 |
| | Collections | `/catalog/collections` | `catalog.collection.read` | P4 |
| | Merchandising | `/catalog/merchandising` | `catalog.product.read` | P4 |
| | Import & export | `/catalog/import-export` | any of `catalog.product.import`, `catalog.product.export`, `catalog.inventory.update`, `pricing.adjustment.create` | P6 |
| **Media** | Media library | `/media` | `media.asset.read` | P2 |
| **Pricing** | Price rules | `/pricing/price-rules` | `pricing.adjustment.read` | P5 |
| | Price lists & tiers | `/pricing/price-lists` | `pricing.adjustment.read` | P5 |
| | Automatic discounts | `/pricing/discount-rules` | `pricing.adjustment.read` | P5 |
| | Coupons | `/pricing/coupons` | `pricing.coupon.read` | P5 |
| | Customer groups | `/pricing/customer-groups` | `order.customer.read` | P5 |
| | Tax & GST | `/pricing/tax` | `pricing.tax.read` | P3 (read) / P5 |
| | Delivery charges | `/pricing/delivery` | `pricing.tax.read` | P5 |
| **Search** | Search insights | `/search/insights` | `catalog.product.update` | P6 |
| | Synonyms | `/search/synonyms` | `catalog.product.update` | P6 |
| | Index maintenance | `/search/index` | `catalog.product.update` | P6 |
| **Content** | Pages | `/content/pages` | `cms.page.read` | P7 |
| | Banners | `/content/banners` | `cms.banner.read` | P7 |
| | Announcements | `/content/announcements` | `cms.banner.read` | P7 |
| | FAQs | `/content/faqs` | `cms.faq.read` | P7 |
| | Help centre | `/content/help-centre` | `cms.page.read` | P7 |
| | Testimonials | `/content/testimonials` | `cms.page.read` | P7 |
| | Stores | `/content/stores` | `cms.page.read` | P7 |
| | Navigation menus | `/content/navigation` | `cms.navigation.read` | P7 |
| | Site & SEO settings | `/content/site-settings` | `system.setting.read` | P7 |
| **Customers** | Carts & wishlists | `/customers/carts` | `order.customer.read` | P8 |
| **Enquiries** | All enquiries | `/enquiries` | `lead.enquiry.read` | P8 |
| | Contract work | `/enquiries/contract-work` | `lead.enquiry.read` | P8 |
| **Orders** *(if approved)* | Orders | `/orders` | `order.order.read` | P9 |
| | Shipments | `/orders/shipments` | `order.order.read` | P9 |
| | Reports | `/orders/reports` | any of `order.order.export`, `catalog.inventory.read` (per report kind) | P9 |
| **System** | Status & integrations | `/system/status` | any admin | **P0 (built)** |
| | Admin users | `/system/users` | `system.user.read` | P1 |
| | Roles & permissions | `/system/roles` | `system.role.read` | P1 |
| | Audit log | `/system/audit-log` | `system.audit.read` | P1 |
| User menu | My account | `/account` | any admin | P1 |
| Public | Sign in / Change password | `/login`, `/change-password` | — / pending-password session | **P0 (built)** |

The price simulator, catalog settings and the notification log are reached from their parent pages
(Price rules, Products, Orders) rather than the sidebar, to keep the navigation short.

What each seeded role sees is tabulated in [ADMIN_ROLE_PERMISSION_MATRIX.md](ADMIN_ROLE_PERMISSION_MATRIX.md#5-screen-visibility-seeded-roles).

## 3. Route map (static export)

Query parameters carry identifiers because a static export cannot contain unknown dynamic segments.

| Route | Params | Content |
| --- | --- | --- |
| `/catalog/products` | `q, categoryId, collectionId, status, publication, visibility, brandId, stock, isFeatured, isNewArrival, customizable, madeToOrder, includeDeleted, page, limit, sort, order` | list, filters, bulk actions |
| `/catalog/products/new` | — | create form |
| `/catalog/products/edit` | `id`, `tab` = overview · categories · specifications · variants · media · pricing · merchandising · related · seo · publishing · history | product editor |
| `/catalog/categories` | `id`, `tab` = details · attributes · products · redirects | tree + side editor |
| `/catalog/attributes` | `id` | list + attribute editor with values |
| `/catalog/collections`, `/catalog/collections/new`, `/catalog/collections/edit` | `id`, `tab` = details · products · rules | |
| `/catalog/inventory` | `variantId` | low stock, bulk adjust, variant ledger |
| `/catalog/import-export` | `job` | wizard + history |
| `/media` | `folder`, `asset`, `view=trash` | library |
| `/pricing/*` | `id` where an item drawer applies; `/pricing/delivery?zone=` | |
| `/content/pages/edit` | `id`, `tab` = builder · settings · seo · preview · history | page builder |
| `/content/navigation` | `menu` = MAIN · FOOTER_PRIMARY · FOOTER_SECONDARY · MOBILE · TOP_BAR | menu editor |
| `/content/help-centre` | `article` | |
| `/enquiries` | `id, status, formKey, categoryId, assignedToId, q` | queue + drawer |
| `/carts` | `id, customer, tab=wishlists` | |
| `/settings/audit-log` | `entity, entityId, actorId, action, severity, from, to` | also embedded as History tabs |
| `/orders/view` | `id`, `tab` | P9 only |

## 4. Section briefs

Each brief is the copy the `PageHeader` and empty states will use.

### Dashboard
*What it is*: today's work, from real data only. *Do*: jump to queues (new enquiries, low stock,
drafts). Widgets in §5.

### Catalog › Products
*What*: everything customers can buy. *Statuses*: publication **Draft / Scheduled / Live / Archived**
(derived by the API from status + publish date), visibility **Public / Catalog only / Search only /
Hidden**. *Do*: create, edit, duplicate, publish now or schedule, unpublish, delete (restorable), bulk
actions on up to 500. *Next*: the Publishing tab lists every blocker the API reports.

### Catalog › Categories
*What*: the storefront tree (menus, listings, breadcrumbs). *Statuses*: Active/Inactive (inactive
hides the whole subtree), Shown in menu, Featured; kinds (Standard, All-products, Special collection,
Make-your-own, New arrivals, Interior solution, Service). *Do*: create, drag to move/reorder, attach
attributes, curate product order, delete with an explained strategy, view slug redirects.

### Catalog › Attributes
*What*: the specification dictionary (colour, fabric, seater…). Variant-defining attributes create
variant options; filterable ones become storefront filters. *Do*: groups, attributes, values
(swatches), ordering; deletion blocked while in use.

### Catalog › Collections
*What*: curated or rule-based product sets. *Types*: Manual (you pick products) and Automatic (rules
select products; refreshed by the backend on schedule). *Statuses*: Active/Inactive, date window,
Deleted (restorable). *Do*: build rules with live preview, refresh membership, order products.

### Catalog › Merchandising
*What*: which products carry Featured, New arrival, Special collection, Best seller and badges.
Backed by the product list filters and `SET_MERCHANDISING` bulk action, plus the badge settings and
the new-arrival window in Catalog settings.

### Catalog › Brands, Inventory, Import & export, Catalog settings
Brands CRUD. Inventory: every stock movement goes through the ledger (reason + note), reserved stock
is shown separately, low-stock queue. Import & export: guided CSV wizard with dry run. Settings: page
sizes, out-of-stock policy, new-arrival days, storefront badges.

### Media
*What*: every image, video and PDF used anywhere. *Statuses*: Ready, Processing, Failed, Quarantined;
Trash (restorable) vs permanently deleted; "In use by N" from the usage ledger. *Do*: upload, organise
folders, alt text and focal point, replace, regenerate sizes, trash/restore/permanent delete.

### Pricing
Price rules (adjustments by scope), tier prices (quantity breaks), price lists (fixed prices per
group/channel), automatic discounts (condition → action rules), coupons (codes, limits, dates,
applicability, bulk codes, redemptions), customer groups, the simulator (full rule trace, "explain
this product"), Tax & GST (tax classes, seller state, inclusive pricing, rounding), Delivery charges
(zones, rates, serviceable pincodes — internal pricing, **not** a courier integration).
Copy on every pricing screen: *"Prices shown here are previews; the storefront always recalculates
on the server."*

### Search
Insights (top and zero-result queries → one-click synonym), synonyms, index maintenance (rebuild with
live progress, recompute popularity), and per-product "What search sees".

### Content
Pages with a block builder generated from `GET /admin/cms/block-types` (22 block types), publish gate,
scheduling, revisions; banners by placement with impressions/clicks; announcement bars; five
navigation menus; FAQs and categories; help centre (Markdown); testimonials; store locations; site &
SEO settings (20 whitelisted keys) and sitemap rebuild. Page statuses: **Draft / Scheduled /
Published / Archived**.

### Customers › Enquiries
*What*: contract work and lead-form requests; never orders. *Statuses*: **New → Contacted → Quoted →
Closed**, or **Spam**. *Do*: filter, assign, add internal notes, move status. Email notification is
on hold (SMTP), so the queue is the only place enquiries appear.

### Customers › Carts & wishlists
Abandonment stats, cart timeline with a live re-quote, most-wishlisted products, and the cleanup
sweep. There is no customer directory API; customer ids appear here and in orders.

### Orders (P9, only if approved)
Order list/detail with guarded status changes and cancellation, **manual** shipments (docket number,
status by hand), failed-delivery decisions, GST invoice issue/download, notification log (read-only),
reports. A permanent banner states that online payments, refunds, returns and courier booking are on
hold.

### Settings
Admin users (create with initial password, roles, suspend/disable/delete), roles (read-only list +
permission reference; editing hidden, see F3/F4), audit log (searchable, also embedded as History),
System status (API health, version and drivers, on-hold integrations, maintenance actions),
My account (profile, change password, sessions, sign out everywhere).

## 5. Dashboard widgets (real data only)

Loaded lazily when visible, `staleTime` 5 min, manual refresh, no polling.

| Widget | Endpoint(s) | Permission | Shows |
| --- | --- | --- | --- |
| Catalog at a glance | `GET /admin/catalog/products?limit=1&publication=LIVE` / `DRAFT` / `SCHEDULED`, `&stock=OUT_OF_STOCK` | `catalog.product.read` | four counts from `meta.total`, each linking to the filtered list |
| New enquiries | `GET /admin/enquiries?status=NEW&limit=5` | `lead.enquiry.read` | count + five newest |
| Low stock | `GET /admin/catalog/inventory/low-stock?limit=5` | `catalog.inventory.read` | five variants |
| Content drafts | `GET /admin/cms/pages?status=DRAFT&limit=1`, `…SCHEDULED` | `cms.page.read` | two counts |
| Search gaps | `GET /admin/search/analytics?days=7&limit=5` | `catalog.product.update` | zero-result queries |
| Abandoned carts | `GET /admin/carts/stats` | `order.customer.read` | abandonment rate, average value |
| Recent imports | `GET /admin/catalog/import/jobs?limit=3` | `catalog.product.import` | status of last jobs |
| Recent activity | `GET /admin/audit-logs?limit=8` | `system.audit.read` | audit entries |
| System | `GET /ready`, `GET /api/v1/version` | any admin | health + driver badges (on-hold integrations) |

No revenue, order or traffic KPIs: orders are not production-verified and no analytics API exists.

## 6. Global UI

- **Topbar**: environment badge (from `NEXT_PUBLIC_APP_ENV`), breadcrumb, help link for the current
  page, user menu (name, roles, My account, Sign out).
- **Sidebar**: groups above, collapsible, keyboard navigable, remembers collapsed state locally
  (UI preference only).
- **Command menu** (`Ctrl/⌘ K`): client-side jump to screens the user can see; no server search.
- **Status legend** popovers on every table with statuses.

## 7. Terminology (API value → operator label)

| API field | Values → labels |
| --- | --- |
| `publication` | DRAFT Draft · SCHEDULED Scheduled · LIVE Live · ARCHIVED Archived |
| `status` (product) | DRAFT Draft · ACTIVE Active · ARCHIVED Archived |
| `visibility` | PUBLIC Everywhere · CATALOG_ONLY Listings only (not in search) · SEARCH_ONLY Search only (not in listings) · HIDDEN Hidden |
| `productType` | SIMPLE Simple · VARIABLE With variants · CONFIGURABLE Configurable · MADE_TO_ORDER Made to order · BUNDLE Bundle |
| Category `kind` | STANDARD Standard · ALL All products · SPECIAL_COLLECTION Special collection · MAKE_YOUR_OWN Make your own · NEW_ARRIVALS New arrivals · INTERIOR_SOLUTION Interior solution · SERVICE Service (enquiry only) |
| Delete strategy | BLOCK Only if empty · SOFT Delete this category · REASSIGN_CHILDREN Move children up, then delete · CASCADE_SOFT Delete with everything below |
| Collection `type` | MANUAL Hand-picked · AUTOMATIC Rule-based |
| Media `status` | UPLOADING Uploading · PROCESSING Processing · READY Ready · FAILED Failed · QUARANTINED Quarantined |
| Page `status` | DRAFT Draft · SCHEDULED Scheduled · PUBLISHED Published · ARCHIVED Archived |
| Enquiry `status` | NEW New · CONTACTED Contacted · QUOTED Quoted · CLOSED Closed · SPAM Spam |
| Admin user `status` | ACTIVE Active · INVITED Invited · SUSPENDED Suspended · DISABLED Disabled |
| Audit `severity` | INFO Info · NOTICE Notice · WARNING Warning · CRITICAL Critical |
| Cart `status` | ACTIVE Active · MERGED Merged · CONVERTED Ordered · ABANDONED Abandoned · EXPIRED Expired |
| Stock `stockStatus` | IN_STOCK In stock · LOW_STOCK Low · OUT_OF_STOCK Out of stock · PREORDER Pre-order · MADE_TO_ORDER Made to order |

Labels live in one module (`lib/format/labels.ts`) keyed by the shared enums, so a new enum value is a
compile error until it has a label.

## 8. Explicitly not in the navigation

| Area | Reason |
| --- | --- |
| Customers directory | no admin customer list/search/detail API |
| Payments, payouts, webhooks | Razorpay on hold (15 routes hidden) |
| Refunds, returns | on hold (13 routes hidden) |
| Courier booking/tracking | Shiprocket on hold (3 routes + courier AWB path hidden) |
| Notification templates, invites, password reset by email | SMTP on hold |
| Custom role editor | backend gaps F3/F4 |
