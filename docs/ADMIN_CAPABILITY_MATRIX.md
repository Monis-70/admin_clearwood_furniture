# ClearWood Admin — Capability, Permission and Mutation Matrix

> **Generated** by `npm run matrix:doc` from `contracts/route-inventory.json` and
> `contracts/openapi-debt.json` (backend `c553f92`), `src/config/api-coverage.ts`, the endpoint
> registry and the seeded role grants. Do not edit by hand. `npm run matrix:doc -- --check` (part of
> `npm run verify`) fails when it is out of date. Per-route purpose and screen: [ADMIN_API_COVERAGE.md](ADMIN_API_COVERAGE.md).

## 1. Every backend route, by class

Implemented through phase **P9**.

| Class | Meaning | Admin routes | Other routes | Total |
| --- | --- | ---: | ---: | ---: |
| UI required: built | wired in the endpoint registry and used by a screen | 282 | 6 | 288 |
| UI required: final UI phase | classified for a screen (P3 and later), not wired yet | 0 | 0 | 0 |
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
| Catalog · Collections | 11 | 11 | 0 | 0 | 0 | 8 |
| Pricing · Price rules | 22 | 22 | 0 | 0 | 0 | 20 |
| Catalog · Products | 15 | 15 | 0 | 0 | 0 | 11 |
| Catalog · Variants | 8 | 8 | 0 | 0 | 0 | 4 |
| Pricing · Tax & GST | 6 | 6 | 0 | 0 | 0 | 5 |
| Content · Banners & announcements | 10 | 10 | 0 | 0 | 0 | 0 |
| Content · FAQs & help centre | 18 | 18 | 0 | 0 | 0 | 0 |
| Content · Pages | 19 | 19 | 0 | 0 | 0 | 0 |
| Content · Testimonials, stores, navigation, settings | 18 | 18 | 0 | 0 | 0 | 0 |
| Media | 22 | 21 | 0 | 0 | 1 | 14 |
| On hold · Payments | 13 | 0 | 0 | 13 | 0 | 0 |
| Pricing · Coupons & customer groups | 14 | 14 | 0 | 0 | 0 | 13 |
| Pricing · Delivery charges | 13 | 13 | 0 | 0 | 0 | 13 |
| System · Admin users & roles | 13 | 13 | 0 | 0 | 0 | 7 |
| Search | 10 | 10 | 0 | 0 | 0 | 5 |
| Carts & wishlists | 6 | 6 | 0 | 0 | 0 | 1 |
| Catalog · Import & export | 6 | 6 | 0 | 0 | 0 | 4 |
| Catalog · Inventory | 5 | 5 | 0 | 0 | 0 | 4 |
| Catalog · Settings | 2 | 2 | 0 | 0 | 0 | 0 |
| Orders (limited verification) | 25 | 19 | 0 | 6 | 0 | 0 |
| Enquiries | 4 | 4 | 0 | 0 | 0 | 0 |
| On hold · Notifications | 2 | 0 | 0 | 2 | 0 | 0 |
| On hold · Refunds & returns | 12 | 0 | 0 | 12 | 0 | 0 |

## 3. Remaining UI capabilities for the final UI phase (0 admin routes)

Grouped by module; the status is the planned phase. Screens and actions come from the coverage table.

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
| `catalog.product.read` | ✓ | ✓ | ✓ | ✓ | ✓ | 8 | 8 | 0 | 0 |
| `catalog.product.create` | ✓ | ✓ | ✓ |  |  | 3 | 3 | 0 | 0 |
| `catalog.product.update` | ✓ | ✓ | ✓ |  |  | 21 | 21 | 0 | 0 |
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
| `catalog.collection.update` | ✓ | ✓ | ✓ |  |  | 7 | 7 | 0 | 0 |
| `catalog.collection.delete` | ✓ | ✓ | ✓ |  |  | 1 | 1 | 0 | 0 |
| `catalog.inventory.read` | ✓ | ✓ | ✓ | ✓ |  | 3 | 3 | 0 | 0 |
| `catalog.inventory.update` | ✓ | ✓ | ✓ | ✓ |  | 2 | 2 | 0 | 0 |
| `pricing.adjustment.read` | ✓ | ✓ | ✓ |  |  | 9 | 9 | 0 | 0 |
| `pricing.adjustment.create` | ✓ | ✓ | ✓ |  |  | 4 | 4 | 0 | 0 |
| `pricing.adjustment.update` | ✓ | ✓ | ✓ |  |  | 5 | 5 | 0 | 0 |
| `pricing.adjustment.delete` | ✓ | ✓ | ✓ |  |  | 4 | 4 | 0 | 0 |
| `pricing.tax.read` | ✓ | ✓ | ✓ |  |  | 5 | 5 | 0 | 0 |
| `pricing.tax.update` | ✓ | ✓ |  |  |  | 14 | 14 | 0 | 0 |
| `pricing.coupon.read` | ✓ | ✓ |  |  |  | 3 | 3 | 0 | 0 |
| `pricing.coupon.create` | ✓ | ✓ |  |  |  | 2 | 2 | 0 | 0 |
| `pricing.coupon.update` | ✓ | ✓ |  |  |  | 1 | 1 | 0 | 0 |
| `pricing.coupon.delete` | ✓ | ✓ |  |  |  | 1 | 1 | 0 | 0 |
| `media.asset.read` | ✓ | ✓ | ✓ |  | ✓ | 4 | 4 | 0 | 0 |
| `media.asset.upload` | ✓ | ✓ | ✓ |  | ✓ | 2 | 1 | 0 | 1 |
| `media.asset.update` | ✓ | ✓ | ✓ |  | ✓ | 5 | 5 | 0 | 0 |
| `media.asset.delete` | ✓ | ✓ | ✓ |  | ✓ | 6 | 6 | 0 | 0 |
| `order.order.read` | ✓ | ✓ |  | ✓ |  | 13 | 10 | 0 | 3 |
| `order.order.update` | ✓ | ✓ |  | ✓ |  | 8 | 2 | 0 | 6 |
| `order.order.cancel` | ✓ | ✓ |  | ✓ |  | 1 | 1 | 0 | 0 |
| `order.order.fulfil` | ✓ | ✓ |  | ✓ |  | 8 | 5 | 0 | 3 |
| `order.refund.read` | ✓ | ✓ |  | ✓ |  | 2 | 0 | 0 | 2 |
| `order.refund.create` | ✓ | ✓ |  | ✓ |  | 2 | 0 | 0 | 2 |
| `order.refund.approve` | ✓ | ✓ |  |  |  | 3 | 0 | 0 | 3 |
| `order.customer.read` | ✓ | ✓ |  | ✓ |  | 7 | 7 | 0 | 0 |
| `order.customer.update` | ✓ | ✓ |  | ✓ |  | 6 | 6 | 0 | 0 |
| `payment.settings.read` | ✓ | ✓ |  |  |  | 2 | 0 | 0 | 2 |
| `payment.settings.update` | ✓ |  |  |  |  | 3 | 0 | 0 | 3 |
| `payment.split.read` | ✓ | ✓ |  |  |  | 3 | 0 | 0 | 3 |
| `payment.split.update` | ✓ |  |  |  |  | 4 | 0 | 0 | 4 |
| `cms.page.read` | ✓ | ✓ |  |  | ✓ | 10 | 10 | 0 | 0 |
| `cms.page.create` | ✓ | ✓ |  |  | ✓ | 6 | 6 | 0 | 0 |
| `cms.page.update` | ✓ | ✓ |  |  | ✓ | 17 | 17 | 0 | 0 |
| `cms.page.delete` | ✓ | ✓ |  |  | ✓ | 5 | 5 | 0 | 0 |
| `cms.banner.read` | ✓ | ✓ |  |  | ✓ | 3 | 3 | 0 | 0 |
| `cms.banner.create` | ✓ | ✓ |  |  | ✓ | 2 | 2 | 0 | 0 |
| `cms.banner.update` | ✓ | ✓ |  |  | ✓ | 3 | 3 | 0 | 0 |
| `cms.banner.delete` | ✓ | ✓ |  |  | ✓ | 2 | 2 | 0 | 0 |
| `cms.navigation.read` | ✓ | ✓ | ✓ |  | ✓ | 2 | 2 | 0 | 0 |
| `cms.navigation.update` | ✓ | ✓ |  |  | ✓ | 4 | 4 | 0 | 0 |
| `cms.faq.read` | ✓ | ✓ |  |  | ✓ | 2 | 2 | 0 | 0 |
| `cms.faq.create` | ✓ | ✓ |  |  | ✓ | 2 | 2 | 0 | 0 |
| `cms.faq.update` | ✓ | ✓ |  |  | ✓ | 3 | 3 | 0 | 0 |
| `cms.faq.delete` | ✓ | ✓ |  |  | ✓ | 2 | 2 | 0 | 0 |
| `lead.enquiry.read` | ✓ | ✓ |  | ✓ | ✓ | 2 | 2 | 0 | 0 |
| `lead.enquiry.update` | ✓ | ✓ |  |  | ✓ | 1 | 1 | 0 | 0 |
| `lead.enquiry.assign` | ✓ | ✓ |  |  | ✓ | 1 | 1 | 0 | 0 |
| `system.user.read` | ✓ | ✓ |  |  |  | 1 | 1 | 0 | 0 |
| `system.user.create` | ✓ | ✓ |  |  |  | 1 | 1 | 0 | 0 |
| `system.user.update` | ✓ | ✓ |  |  |  | 3 | 3 | 0 | 0 |
| `system.user.delete` | ✓ |  |  |  |  | 1 | 1 | 0 | 0 |
| `system.role.read` | ✓ |  |  |  |  | 4 | 4 | 0 | 0 |
| `system.role.create` | ✓ |  |  |  |  | 1 | 1 | 0 | 0 |
| `system.role.update` | ✓ |  |  |  |  | 1 | 1 | 0 | 0 |
| `system.role.delete` | ✓ |  |  |  |  | 1 | 1 | 0 | 0 |
| `system.setting.read` | ✓ | ✓ |  |  |  | 2 | 1 | 0 | 1 |
| `system.setting.update` | ✓ | ✓ |  |  |  | 2 | 1 | 0 | 1 |
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
| DELETE | `/cms/announcements/{id}` | D | X | `cms.banner.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/cms/banners/{id}` | D | X | `cms.banner.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/cms/faq-categories/{id}` | D | X | `cms.faq.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/cms/faqs/{id}` | D | X | `cms.faq.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/cms/help/articles/{id}` | D | X | `cms.page.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/cms/help/categories/{id}` | D | X | `cms.page.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/cms/pages/{id}` | D | X | `cms.page.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/cms/pages/{id}/blocks/{blockId}` | D | R | `cms.page.update` | yes | — | — | — | UI required: built |
| DELETE | `/cms/stores/{id}` | D | X | `cms.page.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/cms/testimonials/{id}` | D | X | `cms.page.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/media-folders/{id}` | D | X | `media.asset.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/media/{id}` | D | R | `media.asset.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/media/{id}/permanent` | D | X | `media.asset.delete` | yes | params: idParamSchema; query: mediaHardDeleteQuerySchema | — | — | UI required: built |
| DELETE | `/navigation/items/{id}` | D | X | `cms.navigation.update` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/payments/split-rules/{id}` | D | X | `payment.split.update` | yes | params: idParamSchema | — | — | On hold (integration) |
| DELETE | `/pricing/coupons/{id}` | D | X | `pricing.coupon.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/pricing/customer-groups/{id}` | D | X | `order.customer.update` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/pricing/customer-groups/{id}/members` | A | - | `order.customer.update` | yes | params: idParamSchema; body: customerGroupMembersSchema | — | — | UI required: built |
| DELETE | `/pricing/discount-rules/{id}` | D | X | `pricing.adjustment.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/pricing/price-lists/{id}` | D | X | `pricing.adjustment.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/pricing/shipping-pincodes/{id}` | D | X | `pricing.tax.update` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/pricing/shipping-rates/{id}` | D | X | `pricing.tax.update` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/pricing/shipping-zones/{id}` | D | X | `pricing.tax.update` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/pricing/tier-prices/{id}` | D | X | `pricing.adjustment.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/products/{productId}/media/{id}` | D | R | `catalog.product.update` | yes | params: productMediaItemParamsSchema | — | — | UI required: built |
| DELETE | `/roles/{id}` | D | X | `system.role.delete` | yes | params: idParamSchema | — | — | UI required: built |
| DELETE | `/search/synonyms/{term}` | D | X | `catalog.product.update` | yes | params: synonymTermParamSchema | — | — | UI required: built |
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
| PATCH | `/cms/announcements/{id}` | U | R | `cms.banner.update` | yes | params: idParamSchema; body: announcementUpdateSchema | — | — | UI required: built |
| PATCH | `/cms/banners/{id}` | U | R | `cms.banner.update` | yes | params: idParamSchema; body: bannerUpdateSchema | — | — | UI required: built |
| PATCH | `/cms/faq-categories/{id}` | U | - | `cms.faq.update` | yes | params: idParamSchema; body: faqCategoryUpdateSchema | — | — | UI required: built |
| PATCH | `/cms/faqs/{id}` | U | R | `cms.faq.update` | yes | params: idParamSchema; body: faqUpdateSchema | — | — | UI required: built |
| PATCH | `/cms/help/articles/{id}` | U | R | `cms.page.update` | yes | params: idParamSchema; body: helpArticleUpdateSchema | — | — | UI required: built |
| PATCH | `/cms/help/categories/{id}` | U | - | `cms.page.update` | yes | params: idParamSchema; body: helpCategoryUpdateSchema | — | — | UI required: built |
| PATCH | `/cms/pages/{id}` | U | - | `cms.page.update` | yes | params: idParamSchema; body: pageUpdateSchema | — | — | UI required: built |
| PATCH | `/cms/pages/{id}/blocks/{blockId}` | u | - | `cms.page.update` | yes | body: blockUpdateSchema | — | — | UI required: built |
| PATCH | `/cms/stores/{id}` | U | R | `cms.page.update` | yes | params: idParamSchema; body: storeUpdateSchema | — | — | UI required: built |
| PATCH | `/cms/testimonials/{id}` | U | R | `cms.page.update` | yes | params: idParamSchema; body: testimonialUpdateSchema | — | — | UI required: built |
| PATCH | `/enquiries/{id}` | U | - | `lead.enquiry.update` | yes | params: idParamSchema; body: enquiryUpdateSchema | — | — | UI required: built |
| PATCH | `/media-folders/{id}` | u | - | `media.asset.update` | yes | params: idParamSchema; body: mediaFolderUpdateSchema | — | — | UI required: built |
| PATCH | `/media/{id}` | u | - | `media.asset.update` | yes | params: idParamSchema; body: mediaUpdateSchema | — | — | UI required: built |
| PATCH | `/navigation/items/{id}` | u | R | `cms.navigation.update` | yes | params: idParamSchema; body: navigationItemUpdateSchema | — | — | UI required: built |
| PATCH | `/payments/split-accounts/{id}` | U | - | `payment.settings.update` | yes | params: idParamSchema; body: splitAccountUpdateSchema | — | — | On hold (integration) |
| PATCH | `/payments/split-rules/{id}` | u | - | `payment.split.update` | yes | params: idParamSchema; body: splitRuleUpdateSchema | — | — | On hold (integration) |
| PATCH | `/pricing/coupons/{id}` | U | R | `pricing.coupon.update` | yes | params: idParamSchema; body: couponUpdateSchema | — | — | UI required: built |
| PATCH | `/pricing/customer-groups/{id}` | U | - | `order.customer.update` | yes | params: idParamSchema; body: customerGroupUpdateSchema | — | — | UI required: built |
| PATCH | `/pricing/discount-rules/{id}` | U | - | `pricing.adjustment.update` | yes | params: idParamSchema; body: discountRuleUpdateSchema | — | — | UI required: built |
| PATCH | `/pricing/price-lists/{id}` | U | - | `pricing.adjustment.update` | yes | params: idParamSchema; body: priceListUpdateSchema | — | — | UI required: built |
| PATCH | `/pricing/shipping-rates/{id}` | U | - | `pricing.tax.update` | yes | params: idParamSchema; body: shippingRateUpdateSchema | — | — | UI required: built |
| PATCH | `/pricing/shipping-zones/{id}` | U | - | `pricing.tax.update` | yes | params: idParamSchema; body: shippingZoneUpdateSchema | — | — | UI required: built |
| PATCH | `/pricing/tier-prices/{id}` | u | - | `pricing.adjustment.update` | yes | params: idParamSchema; body: tierPriceUpdateSchema | — | — | UI required: built |
| PATCH | `/products/{productId}/media/{id}` | u | - | `catalog.product.update` | yes | params: productMediaItemParamsSchema; body: productMediaUpdateSchema | — | — | UI required: built |
| PATCH | `/products/{productId}/media/reorder` | R | - | `catalog.product.update` | yes | params: productMediaParamsSchema; body: productMediaReorderSchema | — | — | UI required: built |
| PATCH | `/roles/{id}` | u | - | `system.role.update` | yes | params: idParamSchema; body: roleUpdateSchema | — | — | UI required: built |
| PATCH | `/search/synonyms/{term}` | u | - | `catalog.product.update` | yes | params: synonymTermParamSchema; body: synonymUpdateSchema | — | — | UI required: built |
| PATCH | `/users/{id}` | u | R | `system.user.update` | yes | params: idParamSchema; body: adminUserUpdateSchema | — | — | UI required: built |
| POST | `/auth/change-password` | AU | - | own session | yes | body: changePasswordSchema | — | — | UI required: built |
| POST | `/auth/forgot-password` | AU | - | public | **no** | body: forgotPasswordSchema | — | admin-forgot | On hold (integration) |
| POST | `/auth/login` | AU | - | public | **no** | body: adminLoginSchema | — | admin-login | UI required: built |
| POST | `/auth/logout` | AU | - | own session | yes | — | — | — | UI required: built |
| POST | `/auth/logout-all` | AU | X | own session | yes | — | — | — | UI required: built |
| POST | `/auth/refresh` | AU | - | public | **no** | body: refreshSchema | — | admin-refresh | UI required: built |
| POST | `/auth/reset-password` | AU | - | public | **no** | body: resetPasswordSchema | — | admin-reset | On hold (integration) |
| POST | `/carts/cleanup` | A | X | `order.customer.update` | yes | body: cartCleanupSchema | — | — | UI required: built |
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
| POST | `/cms/announcements` | C | - | `cms.banner.create` | yes | body: announcementCreateSchema | — | — | UI required: built |
| POST | `/cms/banners` | C | - | `cms.banner.create` | yes | body: bannerCreateSchema | — | — | UI required: built |
| POST | `/cms/banners/reorder` | R | - | `cms.banner.update` | yes | body: cmsReorderSchema | — | — | UI required: built |
| POST | `/cms/faq-categories` | C | - | `cms.faq.create` | yes | body: faqCategoryCreateSchema | — | — | UI required: built |
| POST | `/cms/faqs` | C | - | `cms.faq.create` | yes | body: faqCreateSchema | — | — | UI required: built |
| POST | `/cms/faqs/reorder` | R | - | `cms.faq.update` | yes | body: cmsReorderSchema | — | — | UI required: built |
| POST | `/cms/help/articles` | C | - | `cms.page.create` | yes | body: helpArticleCreateSchema | — | — | UI required: built |
| POST | `/cms/help/articles/reorder` | R | - | `cms.page.update` | yes | body: cmsReorderSchema | — | — | UI required: built |
| POST | `/cms/help/categories` | C | - | `cms.page.create` | yes | body: helpCategoryCreateSchema | — | — | UI required: built |
| POST | `/cms/pages` | C | - | `cms.page.create` | yes | body: pageCreateSchema | — | — | UI required: built |
| POST | `/cms/pages/{id}/blocks` | C | - | `cms.page.update` | yes | params: idParamSchema; body: blockCreateSchema | — | — | UI required: built |
| POST | `/cms/pages/{id}/blocks/reorder` | R | - | `cms.page.update` | yes | params: idParamSchema; body: blockReorderSchema | — | — | UI required: built |
| POST | `/cms/pages/{id}/duplicate` | C | - | `cms.page.create` | yes | params: idParamSchema; body: pageDuplicateSchema | — | — | UI required: built |
| POST | `/cms/pages/{id}/preview` | P | - | `cms.page.read` | yes | params: idParamSchema | — | — | UI required: built |
| POST | `/cms/pages/{id}/publish` | A | - | `cms.page.update` | yes | params: idParamSchema | — | — | UI required: built |
| POST | `/cms/pages/{id}/revisions/{version}/restore` | A | - | `cms.page.update` | yes | — | — | — | UI required: built |
| POST | `/cms/pages/{id}/schedule` | A | - | `cms.page.update` | yes | params: idParamSchema; body: pageScheduleSchema | — | — | UI required: built |
| POST | `/cms/pages/{id}/unpublish` | A | R | `cms.page.update` | yes | params: idParamSchema | — | — | UI required: built |
| POST | `/cms/stores` | C | - | `cms.page.create` | yes | body: storeCreateSchema | — | — | UI required: built |
| POST | `/cms/stores/reorder` | R | - | `cms.page.update` | yes | body: cmsReorderSchema | — | — | UI required: built |
| POST | `/cms/testimonials` | C | - | `cms.page.create` | yes | body: testimonialCreateSchema | — | — | UI required: built |
| POST | `/cms/testimonials/reorder` | R | - | `cms.page.update` | yes | body: cmsReorderSchema | — | — | UI required: built |
| POST | `/collections/{id}/evaluate` | A | - | `catalog.collection.update` | yes | params: idParamSchema | — | — | UI required: built |
| POST | `/collections/evaluate-all` | A | - | `catalog.collection.update` | yes | — | — | — | UI required: built |
| POST | `/collections/rules/preview` | P | - | `catalog.collection.update` | yes | body: collectionRulePreviewSchema | — | — | UI required: built |
| POST | `/media-folders` | C | - | `media.asset.update` | yes | body: mediaFolderCreateSchema | — | — | UI required: built |
| POST | `/media/{id}/replace` | UP | - | `media.asset.update` | yes | params: idParamSchema | — | media-replace | UI required: built |
| POST | `/media/{id}/reprocess` | A | - | `media.asset.update` | yes | params: idParamSchema | — | — | UI required: built |
| POST | `/media/{id}/restore` | A | - | `media.asset.delete` | yes | params: idParamSchema | — | — | UI required: built |
| POST | `/media/bulk-delete` | D | R | `media.asset.delete` | yes | body: mediaBulkDeleteSchema | — | — | UI required: built |
| POST | `/media/presign` | A | - | `media.asset.upload` | yes | body: mediaPresignSchema | — | media-presign | Internal / system |
| POST | `/media/upload` | UP | - | `media.asset.upload` | yes | — | — | media-upload | UI required: built |
| POST | `/navigation/{key}/items` | C | - | `cms.navigation.update` | yes | params: menuKeyParamSchema; body: navigationItemCreateSchema | — | — | UI required: built |
| POST | `/navigation/{key}/reorder` | R | - | `cms.navigation.update` | yes | params: menuKeyParamSchema; body: cmsReorderSchema | — | — | UI required: built |
| POST | `/ndr/{id}/action` | A | - | `order.order.fulfil` | yes | params: idParamSchema; body: ndrActionSchema | — | — | UI required: built |
| POST | `/orders/{id}/cancel` | A | X | `order.order.cancel` | yes | params: idParamSchema; body: orderCancelSchema | — | — | UI required: built |
| POST | `/orders/{id}/retry-transfers` | A | - | `payment.split.update` | yes | params: idParamSchema | — | — | On hold (integration) |
| POST | `/orders/{id}/status` | A | - | `order.order.update` | yes | params: idParamSchema; body: adminOrderStatusSchema | — | — | UI required: built |
| POST | `/orders/{orderNumber}/documents/invoice` | A | X | `order.order.update` | yes | params: orderNumberParamSchema | yes | — | UI required: built |
| POST | `/orders/{orderNumber}/refunds` | C | - | `order.refund.create` | yes | params: orderNumberParamSchema; body: refundRequestSchema | yes | — | On hold (integration) |
| POST | `/orders/{orderNumber}/refunds/preview` | P | - | `order.refund.read` | yes | params: orderNumberParamSchema; body: refundPreviewSchema | — | — | On hold (integration) |
| POST | `/orders/{orderNumber}/shipments` | C | - | `order.order.fulfil` | yes | params: orderNumberParamSchema; body: shipmentCreateSchema | yes | — | UI required: built |
| POST | `/orders/reconcile` | A | - | `order.order.update` | yes | body: reconcileSchema | — | — | On hold (integration) |
| POST | `/payments/split-accounts` | C | - | `payment.settings.update` | yes | body: splitAccountCreateSchema | — | — | On hold (integration) |
| POST | `/payments/split-rules` | C | - | `payment.split.update` | yes | body: splitRuleCreateSchema | — | — | On hold (integration) |
| POST | `/payments/split-simulate` | P | - | `payment.split.read` | yes | body: splitSimulateSchema | — | — | On hold (integration) |
| POST | `/pricing/coupons` | C | - | `pricing.coupon.create` | yes | body: couponCreateSchema | yes | — | UI required: built |
| POST | `/pricing/coupons/bulk-generate` | C | - | `pricing.coupon.create` | yes | body: couponBulkGenerateSchema | yes | coupon-bulk | UI required: built |
| POST | `/pricing/customer-groups` | C | - | `order.customer.update` | yes | body: customerGroupCreateSchema | yes | — | UI required: built |
| POST | `/pricing/customer-groups/{id}/members` | A | - | `order.customer.update` | yes | params: idParamSchema; body: customerGroupMembersSchema | — | — | UI required: built |
| POST | `/pricing/discount-rules` | C | - | `pricing.adjustment.create` | yes | body: discountRuleCreateSchema | — | — | UI required: built |
| POST | `/pricing/discount-rules/evaluate` | P | - | `pricing.adjustment.read` | yes | body: simulateSchema | — | — | UI required: built |
| POST | `/pricing/price-lists` | C | - | `pricing.adjustment.create` | yes | body: priceListCreateSchema | yes | — | UI required: built |
| POST | `/pricing/shipping-pincode-ranges` | C | - | `pricing.tax.update` | yes | body: shippingPincodeRangeCreateSchema | — | — | UI required: built |
| POST | `/pricing/shipping-pincodes` | C | - | `pricing.tax.update` | yes | body: shippingPincodeCreateSchema | — | — | UI required: built |
| POST | `/pricing/shipping-rates` | C | - | `pricing.tax.update` | yes | body: shippingRateCreateSchema | — | — | UI required: built |
| POST | `/pricing/shipping-zones` | C | - | `pricing.tax.update` | yes | body: shippingZoneCreateSchema | — | — | UI required: built |
| POST | `/pricing/shipping-zones/{id}/pincodes/import` | UP | - | `pricing.tax.update` | yes | params: idParamSchema | — | pincode-import | UI required: built |
| POST | `/pricing/simulate` | P | - | `pricing.adjustment.read` | yes | body: simulateSchema | — | — | UI required: built |
| POST | `/pricing/tier-prices` | C | - | `pricing.adjustment.create` | yes | body: tierPriceCreateSchema | — | — | UI required: built |
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
| POST | `/search/popularity/recompute` | A | - | `catalog.product.update` | yes | — | — | — | UI required: built |
| POST | `/search/reindex` | A | - | `catalog.product.update` | yes | query: reindexQuerySchema | — | — | UI required: built |
| POST | `/search/synonyms` | C | - | `catalog.product.update` | yes | body: synonymCreateSchema | — | — | UI required: built |
| POST | `/seo/sitemap/rebuild` | A | - | `cms.page.update` | yes | — | — | — | UI required: built |
| POST | `/shipments/{shipmentNumber}/awb` | A | - | `order.order.fulfil` | yes | params: shipmentNumberParamSchema; body: assignAwbSchema | yes | — | UI required: built |
| POST | `/shipments/{shipmentNumber}/cancel` | A | X | `order.order.fulfil` | yes | params: shipmentNumberParamSchema; body: shipmentCancelSchema | — | — | UI required: built |
| POST | `/shipments/{shipmentNumber}/pickup` | A | - | `order.order.fulfil` | yes | params: shipmentNumberParamSchema; body: schedulePickupSchema | — | — | On hold (integration) |
| POST | `/shipments/{shipmentNumber}/status` | A | - | `order.order.fulfil` | yes | params: shipmentNumberParamSchema; body: shipmentStatusSchema | — | — | UI required: built |
| POST | `/shipments/{shipmentNumber}/sync` | A | - | `order.order.fulfil` | yes | params: shipmentNumberParamSchema | — | — | On hold (integration) |
| POST | `/users` | C | - | `system.user.create` | yes | body: adminUserCreateSchema | — | — | UI required: built |
| POST | `/users/{id}/password` | A | X | `system.user.update` | yes | params: idParamSchema; body: adminPasswordSetSchema | — | — | UI required: built |
| POST | `/users/{id}/roles` | A | - | `system.user.update` + `system.role.read` | yes | params: idParamSchema; body: assignRolesSchema | — | — | UI required: built |
| POST | `/webhooks/{id}/replay` | A | - | `order.order.update` | yes | params: idParamSchema | — | — | On hold (integration) |
| PUT | `/catalog/collections/{id}/products` | A | - | `catalog.collection.update` | yes | params: idParamSchema; body: collectionProductsSchema | — | — | UI required: built |
| PUT | `/catalog/products/{id}/attribute-values` | A | - | `catalog.product.update` | yes | params: idParamSchema; body: productAttributeValuesSchema | — | — | UI required: built |
| PUT | `/catalog/products/{id}/categories` | A | - | `catalog.product.update` | yes | params: idParamSchema; body: productCategoriesSchema | — | — | UI required: built |
| PUT | `/catalog/products/{id}/relations` | A | - | `catalog.product.update` | yes | params: idParamSchema; body: productRelationsSchema | — | — | UI required: built |
| PUT | `/catalog/settings` | u | - | `catalog.product.update` | yes | body: catalogSettingsUpdateSchema | — | — | UI required: built |
| PUT | `/content/settings` | u | - | `system.setting.update` | yes | body: contentSettingsSchema | — | — | UI required: built |
| PUT | `/notifications/templates` | u | - | `system.setting.update` | yes | body: notificationTemplateSchema | — | — | On hold (integration) |
| PUT | `/payments/settings` | u | - | `payment.settings.update` | yes | body: paymentSettingsSchema | — | — | On hold (integration) |
| PUT | `/pricing/price-lists/{id}/items` | A | - | `pricing.adjustment.update` | yes | params: idParamSchema; body: priceListItemsSchema | — | — | UI required: built |
| PUT | `/pricing/settings` | u | - | `pricing.tax.update` | yes | body: pricingSettingsUpdateSchema | — | — | UI required: built |

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
139 are already used by the admin. The admin's contract is the pinned route inventory and the
vendored shared types, both checked on every build, so this is documentation debt rather than contract drift.
