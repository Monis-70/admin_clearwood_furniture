# ClearWood Admin — API Coverage

> **Generated** by `npm run coverage:doc` from `contracts/route-inventory.json` (backend `c553f92`),
> `src/config/api-coverage.ts` and `src/lib/api/endpoints.ts`. Do not edit by hand: change the
> classification and regenerate. `npm run coverage:check` (part of every build) fails when these sources disagree.

## 1. Summary

318 admin routes are mounted under `/api/v1/admin`; every one is classified. 282 have a screen, 36 are deliberately screen-less (§4).
Implemented through phase **P2**: routes marked ✓ are wired in the endpoint registry.

| Status | Meaning | Routes |
| --- | --- | --- |
| hold:email | MAIL_DRIVER=log: in production the message is only logged, never delivered | 4 |
| hold:payments | PAYMENT_DRIVER=mock and RAZORPAY_ENABLED=false; production offers cash on delivery only | 15 |
| hold:refunds | refund execution needs a live payment provider | 6 |
| hold:returns | FEATURE_CUSTOMER_RETURNS=false; no admin endpoint creates a return | 7 |
| hold:shipping | SHIPPING_DRIVER=manual, SHIPROCKET_ENABLED=false, SHIPPING_PROVIDER_VERIFIED=false | 3 |
| internal | no completion endpoint registers or processes a presigned upload | 1 |
| P0 | Foundation: session and sign-in | 5 |
| P1 | Access, account, admin users, roles, audit, dashboard | 16 |
| P2 | Catalogue management: products, variants, categories, attributes, brands, collections, inventory, price rules, tax classes, media, import/export | 106 |
| P3 | Categories, attributes, brands, catalog settings, tax classes (read) | 3 |
| P5 | Pricing, coupons, customer groups, tax & GST, delivery charges | 46 |
| P6 | Import/export, search, collection maintenance | 12 |
| P7 | Content (pages, banners, FAQs, help, testimonials, stores, navigation, settings) | 65 |
| P8 | Enquiries, carts & wishlists | 10 |
| P9 | Orders in limited (cash-on-delivery, manual shipping) mode | 19 |
| **Total** | | **318** |

## 2. Legend

- **Permission**: the backend guard on the route (`computed per request`: the handler decides, see notes).
- **Roles** that hold it by default: SA Super Admin · AD Admin · CM Catalog Manager · OM Order Manager · CO Content Manager (seed at the pinned commit).
- **Kind**: L list · G get · C create · U update (versioned, 409 on conflict) · u update · D delete · A action · P preview · R reorder · UP upload · DL download · AU auth.
- **Status**: build phase, `hold:*` integration on hold, `internal` never called by the UI. ✓ = wired in the endpoint registry.

## 3. Coverage by module

### Access · Session (10)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| POST | `/auth/login` | Sign in; sets httpOnly session cookies + readable CSRF cookie | — (public) | — | /login → Sign in | anyone | — | AU | **P0** ✓ | Ignore tokens.accessToken in the body; never store it; rate limit: admin-login |
| POST | `/auth/refresh` | Rotate the session using the httpOnly refresh cookie | — (public) | — | (API client) → Silent renewal after 401 | anyone | — | AU | **P0** ✓ | Single-flight + cross-tab Web Lock, empty body; CSRF-exempt; rate limit: admin-refresh |
| POST | `/auth/logout` | End this session and clear cookies | — (own account) | yes | User menu → Sign out | any admin | — | AU | **P0** ✓ |  |
| POST | `/auth/logout-all` | End every session of the signed-in admin | — (own account) | yes | /account → Sign out everywhere | any admin | Irreversible | AU | **P1** ✓ |  |
| GET | `/auth/me` | Who am I: user, roles, effective permissions, mustChangePassword | — (own account) | — | (Session provider) → Bootstrap / revalidate | any admin | — | AU | **P0** ✓ |  |
| POST | `/auth/change-password` | Change own password (clears mustChangePassword; other devices signed out) | — (own account) | yes | /change-password (forced; /account adds the voluntary change in P1) → Change password | any admin | — | AU | **P0** ✓ | 401 INVALID_CREDENTIALS here is a form error, not a session loss |
| GET | `/auth/sessions` | List own active sessions | — (own account) | — | /account → Sessions table | any admin | — | L | **P1** ✓ |  |
| DELETE | `/auth/sessions/{id}` | End one of own sessions | — (own account) | yes | /account → End session | any admin | Irreversible | A | **P1** ✓ |  |
| POST | `/auth/forgot-password` | Email a reset token | — (public) | — | (none) → Forgot password | anyone | — | AU | **hold:email** | MAIL_DRIVER=log: the token is never delivered in production; rate limit: admin-forgot |
| POST | `/auth/reset-password` | Redeem a reset/invite token | — (public) | — | (none) → Reset password | anyone | — | AU | **hold:email** | Tokens are only delivered by email; rate limit: admin-reset |

### System · Admin users & roles (13)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/users` | Search admin accounts | `system.user.read` | — | /system/users → Users table | SA AD | — | L | **P1** ✓ |  |
| POST | `/users` | Create an admin account with roles | `system.user.create` | yes | /system/users → Add admin | SA AD | — | C | **P1** ✓ | The password set here is temporary: the new admin must change it at first sign-in (mustChangePassword=true). Omitting it takes the invite-by-email path, which needs SMTP (on hold), so the UI always sends one |
| PATCH | `/users/{id}` | Edit name/phone or change status (activate/suspend/disable) | `system.user.update` | yes | /system/users → Edit / Suspend / Disable | SA AD | Reversible | u | **P1** ✓ | Non-ACTIVE status revokes all their sessions |
| DELETE | `/users/{id}` | Delete an admin account | `system.user.delete` | yes | /system/users → Delete admin | SA | Irreversible | D | **P1** ✓ | No restore endpoint |
| POST | `/users/{id}/roles` | Replace an admin's role set | `system.user.update` + `system.role.read` | yes | /system/users → Change roles | SA | — | A | **P1** ✓ | Seeded and custom role codes are accepted; unknown or inactive roles are refused (422). Needs system.user.update + system.role.read, and you can only grant what you hold |
| POST | `/users/{id}/password` | Set another admin's temporary password; ends their sessions and forces a change at next sign-in | `system.user.update` | yes | /system/users → Reset password | SA AD | Irreversible | A | **P1** ✓ | Not for your own account (use change-password). Only someone holding every permission the target holds, so a SUPER_ADMIN only by a SUPER_ADMIN (403 ADMIN_USER_NOT_MANAGEABLE). Audited CRITICAL |
| GET | `/roles` | List roles (name, system flag, permission count) | `system.role.read` | — | /system/roles → Roles table | SA | — | L | **P1** ✓ |  |
| GET | `/roles/{id}` | One role with the permission codes it grants | `system.role.read` | — | /system/roles?id= → Role details | SA | — | G | **P1** ✓ |  |
| POST | `/roles` | Create a custom role | `system.role.create` | yes | /system/roles → New role | SA | — | C | **P1** ✓ | Custom roles are assignable (roleCodeSchema). You can only grant permissions you hold (403 ROLE_NOT_GRANTABLE) |
| PATCH | `/roles/{id}` | Edit a role / replace its permission set | `system.role.update` | yes | /system/roles?id= → Edit role / permissions | SA | — | u | **P1** ✓ | Load the current grants with GET /roles/{id} first and send the full permission set. A system role cannot be deactivated; a role carrying permissions you do not hold cannot be changed (403 ROLE_NOT_MANAGEABLE) |
| DELETE | `/roles/{id}` | Delete an unassigned custom role | `system.role.delete` | yes | /system/roles?id= → Delete role | SA | Irreversible | D | **P1** ✓ | Custom roles only (system roles: 403); 409 while any admin still has the role |
| GET | `/permissions` | Permission registry grouped by area (with dangerous flag) | `system.role.read` | — | /system/roles → Permission reference | SA | — | L | **P1** ✓ |  |
| GET | `/audit-logs` | Search the audit trail | `system.audit.read` | — | /system/audit-log → Audit table + entity History tabs | SA AD | — | L | **P1** ✓ | Also feeds Dashboard "Recent activity" |

### Catalog · Categories (17)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/catalog/categories` | Paginated, filterable category list; includeDeleted=true adds soft-deleted rows | `catalog.category.read` | — | /catalog/categories (Recently deleted) → Search / Recently deleted | SA AD CM CO | — | L | **P2** ✓ | The hierarchy comes from /catalog/categories/tree |
| GET | `/catalog/categories/tree` | Whole admin tree (flat, inactive included, deleted excluded) | `catalog.category.read` | — | /catalog/categories → Tree | SA AD CM CO | — | L | **P2** ✓ | Primary category source for every picker |
| GET | `/catalog/categories/{id}` | One category | `catalog.category.read` | — | /catalog/categories?id= → Category editor | SA AD CM CO | — | G | **P2** ✓ |  |
| POST | `/catalog/categories` | Create a category | `catalog.category.create` | yes | /catalog/categories → Add category | SA AD CM | — | C | **P2** ✓ | Idempotency-Key supported; Idempotency-Key |
| PATCH | `/catalog/categories/{id}` | Edit a category (version) | `catalog.category.update` | yes | /catalog/categories?id= → Save | SA AD CM | — | U | **P2** ✓ | Deactivating hides the whole subtree on the storefront |
| DELETE | `/catalog/categories/{id}` | Delete with a strategy (BLOCK, SOFT, REASSIGN_CHILDREN, CASCADE_SOFT) | `catalog.category.delete` | yes | /catalog/categories?id= → Delete… | SA AD CM | Reversible | D | **P2** ✓ | Rate limited (catalog-destructive); show delete-impact first; rate limit: catalog-destructive |
| GET | `/catalog/categories/{id}/delete-impact` | What a delete strategy would touch | `catalog.category.delete` | — | /catalog/categories?id= → Delete dialog preview | SA AD CM | — | P | **P2** ✓ |  |
| POST | `/catalog/categories/{id}/move` | Move under a new parent / position (version) | `catalog.category.reorder` | yes | /catalog/categories → Drag to new parent | SA AD CM | — | A | **P2** ✓ |  |
| POST | `/catalog/categories/reorder` | Set sibling positions | `catalog.category.reorder` | yes | /catalog/categories → Drag to reorder | SA AD CM | — | R | **P2** ✓ |  |
| POST | `/catalog/categories/bulk` | Activate/deactivate many categories | `catalog.category.update` | yes | /catalog/categories → Bulk activate / deactivate | SA AD CM | Reversible | A | **P2** ✓ | Rate limited (catalog-bulk); rate limit: catalog-bulk |
| POST | `/catalog/categories/{id}/restore` | Restore a soft-deleted category | `catalog.category.update` | yes | /catalog/categories (Recently deleted) → Restore | SA AD CM | — | A | **P2** ✓ | No list of deleted categories is reachable (see DEFECT); ids come from the audit trail |
| GET | `/catalog/categories/{id}/redirects` | Old slugs that redirect here | `catalog.category.read` | — | /catalog/categories?id= → Redirects panel | SA AD CM CO | — | L | **P2** ✓ |  |
| GET | `/catalog/categories/{id}/products` | Products in curated (CURATED sort) order | `catalog.category.read` | — | /catalog/categories?id=&tab=products → Curated order | SA AD CM CO | — | L | **P2** ✓ |  |
| POST | `/catalog/categories/{id}/products/reorder` | Set product positions inside a category | `catalog.category.reorder` | yes | /catalog/categories?id=&tab=products → Drag to reorder | SA AD CM | — | R | **P2** ✓ |  |
| GET | `/catalog/categories/{id}/attributes` | Attributes attached to a category | `catalog.attribute.read` | — | /catalog/categories?id=&tab=attributes → Attributes panel | SA AD CM | — | L | **P2** ✓ |  |
| POST | `/catalog/categories/{id}/attributes` | Attach/override an attribute for a category | `catalog.attribute.update` | yes | /catalog/categories?id=&tab=attributes → Add / edit attribute link | SA AD CM | — | A | **P2** ✓ |  |
| DELETE | `/catalog/categories/{id}/attributes/{attributeId}` | Detach an attribute from a category | `catalog.attribute.update` | yes | /catalog/categories?id=&tab=attributes → Remove attribute | SA AD CM | Irreversible | D | **P2** ✓ |  |

### Media (22)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/media` | Browse/filter the media library | `media.asset.read` | — | /media → Library grid/list | SA AD CM CO | — | L | **P2** ✓ |  |
| GET | `/media/config` | Upload limits, allowed types, rendition ladder, driver | `media.asset.read` | — | /media → Uploader limits | SA AD CM CO | — | G | **P2** ✓ |  |
| GET | `/media/gc` | Storage integrity report (orphaned/missing files), read-only | `media.asset.delete` | — | /system/status → Run storage check | SA AD CM CO | — | P | **P6** | Scans the whole bucket; on demand only, never auto-loaded |
| GET | `/media/{id}` | One asset with renditions and usage list | `media.asset.read` | — | /media, product Media & Gallery → Asset drawer; usage impact before deleting a file | SA AD CM CO | — | G | **P2** ✓ |  |
| PATCH | `/media/{id}` | Edit alt text, title, tags, focal point, folder | `media.asset.update` | yes | /media → Save asset details | SA AD CM CO | — | u | **P2** ✓ |  |
| POST | `/media/upload` | Upload files (multipart "files") | `media.asset.upload` | yes | /media, MediaPicker, product Media & Gallery → Upload | SA AD CM CO | — | UP | **P2** ✓ | Rate limited (media-upload): one file per request, 2 at a time, queue pauses on 429 Retry-After; rate limit: media-upload |
| POST | `/media/presign` | Issue an S3 direct-upload ticket | `media.asset.upload` | yes | (not used) → — | SA AD CM CO | — | A | **internal** | No completion endpoint registers or processes the object; the UI always uses /media/upload; rate limit: media-presign |
| POST | `/media/{id}/replace` | Replace an asset's file in place | `media.asset.update` | yes | /media → Replace file | SA AD CM CO | — | UP | **P2** ✓ | Everything using the asset changes; rate limit: media-replace |
| POST | `/media/{id}/reprocess` | Regenerate renditions | `media.asset.update` | yes | /media → Regenerate sizes | SA AD CM CO | — | A | **P2** ✓ |  |
| DELETE | `/media/{id}` | Move an asset to trash (soft delete) | `media.asset.delete` | yes | /media, product Media & Gallery → Move to trash | SA AD CM CO | Reversible | D | **P2** ✓ |  |
| POST | `/media/{id}/restore` | Restore a trashed asset | `media.asset.delete` | yes | /media (Trash), product Media & Gallery → Restore | SA AD CM CO | — | A | **P2** ✓ |  |
| DELETE | `/media/{id}/permanent` | Permanently delete an asset and its files | `media.asset.delete` | yes | /media (Trash), product Media & Gallery → Delete permanently | SA AD CM CO | Irreversible | D | **P2** ✓ | 409 MEDIA_IN_USE; force=true detaches usages first |
| POST | `/media/bulk-delete` | Move up to 100 assets to trash | `media.asset.delete` | yes | /media → Bulk move to trash | SA AD CM CO | Reversible | D | **P2** ✓ |  |
| GET | `/media-folders` | Folder tree | `media.asset.read` | — | /media → Folder sidebar | SA AD CM CO | — | L | **P2** ✓ |  |
| POST | `/media-folders` | Create a folder | `media.asset.update` | yes | /media → New folder | SA AD CM CO | — | C | **P2** ✓ |  |
| PATCH | `/media-folders/{id}` | Rename/move a folder | `media.asset.update` | yes | /media → Rename / move folder | SA AD CM CO | — | u | **P2** ✓ |  |
| DELETE | `/media-folders/{id}` | Delete an empty, non-system folder | `media.asset.delete` | yes | /media → Delete folder | SA AD CM CO | Irreversible | D | **P2** ✓ |  |
| GET | `/products/{productId}/media` | Product gallery in admin order | `catalog.product.update` | — | /catalog/products/edit?id=&tab=media → Gallery | SA AD CM | — | L | **P2** ✓ |  |
| POST | `/products/{productId}/media` | Attach library assets to a product | `catalog.product.update` | yes | /catalog/products/edit?id=&tab=media → Add images | SA AD CM | — | A | **P2** ✓ |  |
| PATCH | `/products/{productId}/media/{id}` | Change role/alt/device/variant/option of a gallery item | `catalog.product.update` | yes | /catalog/products/edit?id=&tab=media → Edit image | SA AD CM | — | u | **P2** ✓ |  |
| PATCH | `/products/{productId}/media/reorder` | Reorder the gallery | `catalog.product.update` | yes | /catalog/products/edit?id=&tab=media → Drag to reorder | SA AD CM | — | R | **P2** ✓ |  |
| DELETE | `/products/{productId}/media/{id}` | Detach an image (asset stays in library) | `catalog.product.update` | yes | /catalog/products/edit?id=&tab=media → Remove from product | SA AD CM | Reversible | D | **P2** ✓ |  |

### Catalog · Settings (2)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/catalog/settings` | Page sizes, out-of-stock policy, new-arrival window, badges | `catalog.product.read` | — | /catalog/settings → Settings form | SA AD CM OM CO | — | G | **P3** |  |
| PUT | `/catalog/settings` | Change catalog settings (badges merge per code; null turns one off) | `catalog.product.update` | yes | /catalog/settings → Save settings | SA AD CM | — | u | **P3** |  |

### Catalog · Attributes (13)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/catalog/attribute-groups` | Attribute groups | `catalog.attribute.read` | — | /catalog/attributes → Groups panel | SA AD CM | — | L | **P2** ✓ |  |
| POST | `/catalog/attribute-groups` | Create a group | `catalog.attribute.create` | yes | /catalog/attributes → Add group | SA AD CM | — | C | **P2** ✓ |  |
| PATCH | `/catalog/attribute-groups/{id}` | Edit a group | `catalog.attribute.update` | yes | /catalog/attributes → Edit group | SA AD CM | — | u | **P2** ✓ |  |
| DELETE | `/catalog/attribute-groups/{id}` | Delete a group | `catalog.attribute.delete` | yes | /catalog/attributes → Delete group | SA AD CM | Irreversible | D | **P2** ✓ |  |
| GET | `/catalog/attributes` | Search attributes | `catalog.attribute.read` | — | /catalog/attributes → Attributes table | SA AD CM | — | L | **P2** ✓ |  |
| POST | `/catalog/attributes` | Create an attribute | `catalog.attribute.create` | yes | /catalog/attributes → Add attribute | SA AD CM | — | C | **P2** ✓ |  |
| GET | `/catalog/attributes/{id}` | One attribute with values | `catalog.attribute.read` | — | /catalog/attributes?id= → Attribute editor | SA AD CM | — | G | **P2** ✓ |  |
| PATCH | `/catalog/attributes/{id}` | Edit an attribute (version) | `catalog.attribute.update` | yes | /catalog/attributes?id= → Save | SA AD CM | — | U | **P2** ✓ |  |
| DELETE | `/catalog/attributes/{id}` | Delete an attribute (in-use guard) | `catalog.attribute.delete` | yes | /catalog/attributes?id= → Delete attribute | SA AD CM | Irreversible | D | **P2** ✓ | 409 ATTRIBUTE_IN_USE with counts |
| POST | `/catalog/attributes/reorder` | Reorder attributes | `catalog.attribute.update` | yes | /catalog/attributes → Drag to reorder | SA AD CM | — | R | **P2** ✓ |  |
| POST | `/catalog/attributes/{id}/values` | Add a value | `catalog.attribute.update` | yes | /catalog/attributes?id= → Add value | SA AD CM | — | C | **P2** ✓ |  |
| PATCH | `/catalog/attribute-values/{valueId}` | Edit a value (version) | `catalog.attribute.update` | yes | /catalog/attributes?id= → Edit value | SA AD CM | — | U | **P2** ✓ |  |
| DELETE | `/catalog/attribute-values/{valueId}` | Delete a value (in-use guard) | `catalog.attribute.delete` | yes | /catalog/attributes?id= → Delete value | SA AD CM | Irreversible | D | **P2** ✓ |  |

### Catalog · Brands (4)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/catalog/brands` | Search brands | `catalog.product.read` | — | /catalog/brands → Brands table | SA AD CM OM CO | — | L | **P2** ✓ |  |
| POST | `/catalog/brands` | Create a brand | `catalog.product.create` | yes | /catalog/brands → Add brand | SA AD CM | — | C | **P2** ✓ |  |
| PATCH | `/catalog/brands/{id}` | Edit a brand (version) | `catalog.product.update` | yes | /catalog/brands → Edit brand | SA AD CM | — | U | **P2** ✓ |  |
| DELETE | `/catalog/brands/{id}` | Delete a brand | `catalog.product.delete` | yes | /catalog/brands → Delete brand | SA AD CM | Irreversible | D | **P2** ✓ |  |

### Pricing · Tax & GST (6)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/catalog/tax-classes` | Tax classes (GST rates, HSN) | `pricing.tax.read` | — | /pricing/tax → Tax classes table | SA AD CM | — | L | **P2** ✓ | Also reference data for the product form |
| POST | `/catalog/tax-classes` | Create a tax class | `pricing.tax.update` | yes | /pricing/tax → Add tax class | SA AD | — | C | **P2** ✓ |  |
| PATCH | `/catalog/tax-classes/{id}` | Edit a tax class (no version) | `pricing.tax.update` | yes | /pricing/tax → Edit tax class | SA AD | — | u | **P2** ✓ |  |
| DELETE | `/catalog/tax-classes/{id}` | Delete a tax class | `pricing.tax.update` | yes | /pricing/tax → Delete tax class | SA AD | Irreversible | D | **P2** ✓ |  |
| GET | `/pricing/settings` | Pricing & GST settings | `pricing.tax.read` | — | /pricing/tax → Settings form | SA AD CM | — | G | **P5** |  |
| PUT | `/pricing/settings` | Change pricing & GST settings | `pricing.tax.update` | yes | /pricing/tax → Save settings | SA AD | — | u | **P5** |  |

### Catalog · Products (15)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/catalog/products` | Search products with the full admin filter set | `catalog.product.read` | — | /catalog/products → Products table | SA AD CM OM CO | — | L | **P2** ✓ | Also: Dashboard counts (limit=1), Merchandising presets |
| POST | `/catalog/products` | Create a product | `catalog.product.create` | yes | /catalog/products/new → Create product | SA AD CM | — | C | **P2** ✓ | Idempotency-Key; Idempotency-Key |
| GET | `/catalog/products/{id}` | Full product (variants, media, relations, completeness, blockers) | `catalog.product.read` | — | /catalog/products/edit?id= → Product editor | SA AD CM OM CO | — | G | **P2** ✓ |  |
| PATCH | `/catalog/products/{id}` | Edit product fields (version) | `catalog.product.update` | yes | /catalog/products/edit?id= → Save | SA AD CM | — | U | **P2** ✓ |  |
| DELETE | `/catalog/products/{id}` | Soft-delete a product | `catalog.product.delete` | yes | /catalog/products/edit?id= → Delete product | SA AD CM | Reversible | D | **P2** ✓ | Rate limited (catalog-destructive); restore available; rate limit: catalog-destructive |
| POST | `/catalog/products/{id}/restore` | Restore a deleted product | `catalog.product.update` | yes | /catalog/products (Deleted filter) → Restore | SA AD CM | — | A | **P2** ✓ |  |
| POST | `/catalog/products/{id}/duplicate` | Duplicate a product (variants/media/relations/rules optional) | `catalog.product.create` | yes | /catalog/products/edit?id= → Duplicate | SA AD CM | — | C | **P2** ✓ | Idempotency-Key; Idempotency-Key |
| POST | `/catalog/products/{id}/publish` | Publish now or schedule (publishAt); 422 lists all blockers | `catalog.product.publish` | yes | /catalog/products/edit?id=&tab=publishing → Publish / Schedule | SA AD CM | — | A | **P2** ✓ |  |
| POST | `/catalog/products/{id}/unpublish` | Take a product off the storefront | `catalog.product.publish` | yes | /catalog/products/edit?id=&tab=publishing → Unpublish | SA AD CM | Reversible | A | **P2** ✓ |  |
| GET | `/catalog/products/{id}/publish-blockers` | What stops publishing | `catalog.product.read` | — | /catalog/products/edit?id=&tab=publishing → Readiness checklist | SA AD CM OM CO | — | G | **P2** ✓ |  |
| GET | `/catalog/products/{id}/redirects` | Old slugs redirecting to this product | `catalog.product.read` | — | /catalog/products/edit?id=&tab=seo → Redirects panel | SA AD CM OM CO | — | L | **P2** ✓ |  |
| PUT | `/catalog/products/{id}/categories` | Set primary + additional categories | `catalog.product.update` | yes | /catalog/products/edit?id=&tab=categories → Save categories | SA AD CM | — | A | **P2** ✓ | 422 CATEGORY_NOT_PURCHASABLE for SERVICE categories |
| PUT | `/catalog/products/{id}/attribute-values` | Set specification values | `catalog.product.update` | yes | /catalog/products/edit?id=&tab=specifications → Save specifications | SA AD CM | — | A | **P2** ✓ |  |
| PUT | `/catalog/products/{id}/relations` | Replace curated relations (RELATED, SIMILAR, …) | `catalog.product.update` | yes | /catalog/products/edit?id=&tab=related → Save related products | SA AD CM | — | A | **P3** |  |
| POST | `/catalog/bulk` | One action on up to 500 products with per-id results | `catalog.product.read` | yes | /catalog/products → Bulk actions menu | SA AD CM OM CO | Reversible | A | **P2** ✓ | Rate limited (catalog-bulk); Idempotency-Key; ACTIVATE/PUBLISH need catalog.product.publish; rate limit: catalog-bulk; Idempotency-Key |

### Catalog · Variants (8)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/catalog/products/{id}/variants` | Variants of a product | `catalog.variant.read` | — | /catalog/products/edit?id=&tab=variants → Variants table | SA AD CM | — | L | **P2** ✓ |  |
| POST | `/catalog/products/{id}/variants` | Create a variant (unique option combination) | `catalog.variant.create` | yes | /catalog/products/edit?id=&tab=variants → Add variant | SA AD CM | — | C | **P2** ✓ | openingStock goes through the ledger |
| PATCH | `/catalog/products/{id}/variants/{variantId}` | Edit a variant (version) | `catalog.variant.update` | yes | /catalog/products/edit?id=&tab=variants → Edit variant | SA AD CM | — | U | **P2** ✓ |  |
| DELETE | `/catalog/products/{id}/variants/{variantId}` | Delete a variant | `catalog.variant.delete` | yes | /catalog/products/edit?id=&tab=variants → Delete variant | SA AD CM | Irreversible | D | **P2** ✓ |  |
| POST | `/catalog/products/{id}/variants/reorder` | Reorder variants | `catalog.variant.update` | yes | /catalog/products/edit?id=&tab=variants → Drag to reorder | SA AD CM | — | R | **P2** ✓ |  |
| POST | `/catalog/products/{id}/variants/{variantId}/set-default` | Make the single default variant | `catalog.variant.update` | yes | /catalog/products/edit?id=&tab=variants → Set as default | SA AD CM | — | A | **P2** ✓ |  |
| POST | `/catalog/products/{id}/variants/matrix/preview` | Preview option combinations (no writes) | `catalog.variant.read` | yes | /catalog/products/edit?id=&tab=variants → Generate variants — preview | SA AD CM | — | P | **P2** ✓ |  |
| POST | `/catalog/products/{id}/variants/matrix/generate` | Create the missing combinations | `catalog.variant.create` | yes | /catalog/products/edit?id=&tab=variants → Generate variants — confirm | SA AD CM | — | C | **P2** ✓ | 422 VARIANT_MATRIX_TOO_LARGE; Idempotency-Key; Idempotency-Key |

### Catalog · Inventory (5)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/catalog/variants/{id}/inventory` | Stock ledger history of a variant | `catalog.inventory.read` | — | /catalog/inventory?variantId= → Stock history | SA AD CM OM | — | L | **P2** ✓ |  |
| GET | `/catalog/variants/{id}/inventory/snapshot` | Current stock, reserved, available | `catalog.inventory.read` | — | /catalog/inventory?variantId= → Stock card | SA AD CM OM | — | G | **P2** ✓ |  |
| POST | `/catalog/variants/{id}/inventory/adjust` | Move stock through the ledger (delta or absolute) | `catalog.inventory.update` | yes | /catalog/inventory?variantId=, product Variants tab → Adjust stock | SA AD CM OM | — | A | **P2** ✓ | Send expectedBalance + Idempotency-Key; 409 INVENTORY_CONFLICT; Idempotency-Key |
| POST | `/catalog/inventory/bulk-adjust` | Adjust up to 1,000 variants by id or SKU | `catalog.inventory.update` | yes | /catalog/inventory → Bulk adjust | SA AD CM OM | — | A | **P2** ✓ | Rate limited (inventory-bulk); Idempotency-Key; rate limit: inventory-bulk; Idempotency-Key |
| GET | `/catalog/inventory/low-stock` | Variants at or below threshold | `catalog.inventory.read` | — | /catalog/inventory → Low-stock table | SA AD CM OM | — | L | **P2** ✓ | Also: Dashboard widget. Made-to-order products are not listed; rows name the product and variant |

### Catalog · Collections (11)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/catalog/collections` | List collections (includeDeleted = trash) | `catalog.collection.read` | — | /catalog/collections → Collections table | SA AD CM | — | L | **P2** ✓ |  |
| POST | `/catalog/collections` | Create a MANUAL or AUTOMATIC collection | `catalog.collection.create` | yes | /catalog/collections/new → Create collection | SA AD CM | — | C | **P2** ✓ |  |
| GET | `/catalog/collections/{id}` | One collection | `catalog.collection.read` | — | /catalog/collections/edit?id= → Collection editor | SA AD CM | — | G | **P2** ✓ |  |
| PATCH | `/catalog/collections/{id}` | Edit a collection (version) | `catalog.collection.update` | yes | /catalog/collections/edit?id= → Save | SA AD CM | — | U | **P2** ✓ |  |
| DELETE | `/catalog/collections/{id}` | Soft-delete a collection | `catalog.collection.delete` | yes | /catalog/collections/edit?id= → Delete collection | SA AD CM | Reversible | D | **P2** ✓ |  |
| POST | `/catalog/collections/{id}/restore` | Restore (AUTOMATIC ones re-evaluated) | `catalog.collection.update` | yes | /catalog/collections (Trash) → Restore | SA AD CM | — | A | **P2** ✓ |  |
| PUT | `/catalog/collections/{id}/products` | Replace a MANUAL collection's products | `catalog.collection.update` | yes | /catalog/collections/edit?id=&tab=products → Save products | SA AD CM | — | A | **P2** ✓ |  |
| POST | `/catalog/collections/{id}/products/reorder` | Reorder collection products | `catalog.collection.update` | yes | /catalog/collections/edit?id=&tab=products → Drag to reorder | SA AD CM | — | R | **P2** ✓ |  |
| POST | `/collections/rules/preview` | Dry-run an AUTOMATIC rule tree | `catalog.collection.update` | yes | /catalog/collections/edit?id=&tab=rules → Preview matches | SA AD CM | — | P | **P2** ✓ |  |
| POST | `/collections/{id}/evaluate` | Materialise an AUTOMATIC collection now | `catalog.collection.update` | yes | /catalog/collections/edit?id=&tab=rules → Refresh membership | SA AD CM | — | A | **P2** ✓ |  |
| POST | `/collections/evaluate-all` | Re-evaluate every AUTOMATIC collection | `catalog.collection.update` | yes | /system/status (Maintenance) → Refresh all automatic collections | SA AD CM | — | A | **P6** | The reconciler also does this on schedule |

### Pricing · Price rules (22)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/catalog/price-adjustments` | List price adjustments | `pricing.adjustment.read` | — | /pricing/price-rules → Rules table | SA AD CM | — | L | **P2** ✓ | Also: product editor Pricing tab (productId filter) |
| GET | `/catalog/price-adjustments/conflicts` | Rules competing at the same scope/priority/window | `pricing.adjustment.read` | — | /pricing/price-rules → Conflicts panel | SA AD CM | — | L | **P2** ✓ |  |
| POST | `/catalog/price-adjustments` | Create a price adjustment | `pricing.adjustment.create` | yes | /pricing/price-rules → Add rule | SA AD CM | — | C | **P2** ✓ |  |
| PATCH | `/catalog/price-adjustments/{id}` | Edit a price adjustment (version) | `pricing.adjustment.update` | yes | /pricing/price-rules → Edit rule | SA AD CM | — | U | **P2** ✓ |  |
| DELETE | `/catalog/price-adjustments/{id}` | Delete a price adjustment | `pricing.adjustment.delete` | yes | /pricing/price-rules → Delete rule | SA AD CM | Irreversible | D | **P2** ✓ |  |
| GET | `/pricing/tier-prices` | Quantity tier prices | `pricing.adjustment.read` | — | /pricing/tier-prices → Tiers table | SA AD CM | — | L | **P5** |  |
| POST | `/pricing/tier-prices` | Create a tier price | `pricing.adjustment.create` | yes | /pricing/tier-prices → Add tier | SA AD CM | — | C | **P5** |  |
| PATCH | `/pricing/tier-prices/{id}` | Edit a tier price (no version) | `pricing.adjustment.update` | yes | /pricing/tier-prices → Edit tier | SA AD CM | — | u | **P5** |  |
| DELETE | `/pricing/tier-prices/{id}` | Delete a tier price | `pricing.adjustment.delete` | yes | /pricing/tier-prices → Delete tier | SA AD CM | Irreversible | D | **P5** |  |
| GET | `/pricing/price-lists` | Price lists | `pricing.adjustment.read` | — | /pricing/price-lists → Price lists table | SA AD CM | — | L | **P5** |  |
| POST | `/pricing/price-lists` | Create a price list | `pricing.adjustment.create` | yes | /pricing/price-lists → Add price list | SA AD CM | — | C | **P5** | Idempotency-Key; Idempotency-Key |
| PATCH | `/pricing/price-lists/{id}` | Edit a price list (version) | `pricing.adjustment.update` | yes | /pricing/price-lists → Edit price list | SA AD CM | — | U | **P5** |  |
| DELETE | `/pricing/price-lists/{id}` | Delete a price list | `pricing.adjustment.delete` | yes | /pricing/price-lists → Delete price list | SA AD CM | Irreversible | D | **P5** |  |
| GET | `/pricing/price-lists/{id}/items` | Items of a price list | `pricing.adjustment.read` | — | /pricing/price-lists?id= → Items editor | SA AD CM | — | L | **P5** |  |
| PUT | `/pricing/price-lists/{id}/items` | Replace price list items | `pricing.adjustment.update` | yes | /pricing/price-lists?id= → Save items | SA AD CM | — | A | **P5** |  |
| GET | `/pricing/discount-rules` | Automatic discount rules | `pricing.adjustment.read` | — | /pricing/discount-rules → Rules table | SA AD CM | — | L | **P5** |  |
| POST | `/pricing/discount-rules` | Create a discount rule (conditions + actions) | `pricing.adjustment.create` | yes | /pricing/discount-rules → Add rule | SA AD CM | — | C | **P5** |  |
| PATCH | `/pricing/discount-rules/{id}` | Edit a discount rule (version) | `pricing.adjustment.update` | yes | /pricing/discount-rules → Edit rule | SA AD CM | — | U | **P5** |  |
| DELETE | `/pricing/discount-rules/{id}` | Delete a discount rule | `pricing.adjustment.delete` | yes | /pricing/discount-rules → Delete rule | SA AD CM | Irreversible | D | **P5** |  |
| POST | `/pricing/discount-rules/evaluate` | Test discount rules against a sample cart | `pricing.adjustment.read` | yes | /pricing/discount-rules → Test rules | SA AD CM | — | P | **P5** |  |
| POST | `/pricing/simulate` | Price a hypothetical cart with the full rule trace | `pricing.adjustment.read` | yes | /pricing/simulator → Run simulation | SA AD CM | — | P | **P5** |  |
| GET | `/pricing/explain/{id}` | Every rule that could touch a product | `pricing.adjustment.read` | — | /pricing/simulator, product Pricing tab → Explain price | SA AD CM | — | G | **P5** |  |

### Pricing · Coupons & customer groups (14)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/pricing/coupons` | Search coupons | `pricing.coupon.read` | — | /pricing/coupons → Coupons table | SA AD | — | L | **P5** |  |
| POST | `/pricing/coupons` | Create a coupon | `pricing.coupon.create` | yes | /pricing/coupons → Add coupon | SA AD | — | C | **P5** | Idempotency-Key; Idempotency-Key |
| GET | `/pricing/coupons/{id}` | One coupon with redemption counts | `pricing.coupon.read` | — | /pricing/coupons?id= → Coupon drawer | SA AD | — | G | **P5** |  |
| PATCH | `/pricing/coupons/{id}` | Edit a coupon (version) | `pricing.coupon.update` | yes | /pricing/coupons?id= → Save / Activate / Deactivate | SA AD | Reversible | U | **P5** |  |
| DELETE | `/pricing/coupons/{id}` | Delete a coupon | `pricing.coupon.delete` | yes | /pricing/coupons?id= → Delete coupon | SA AD | Irreversible | D | **P5** |  |
| GET | `/pricing/coupons/{id}/redemptions` | Redemption ledger of a coupon | `pricing.coupon.read` | — | /pricing/coupons?id=&tab=redemptions → Redemptions table | SA AD | — | L | **P5** |  |
| POST | `/pricing/coupons/bulk-generate` | Generate up to 500 codes from a template | `pricing.coupon.create` | yes | /pricing/coupons → Generate codes | SA AD | — | C | **P5** | Rate limited (coupon-bulk); Idempotency-Key; rate limit: coupon-bulk; Idempotency-Key |
| GET | `/pricing/customer-groups` | Customer groups | `order.customer.read` | — | /pricing/customer-groups → Groups table | SA AD OM | — | L | **P5** |  |
| POST | `/pricing/customer-groups` | Create a customer group | `order.customer.update` | yes | /pricing/customer-groups → Add group | SA AD OM | — | C | **P5** | Idempotency-Key; Idempotency-Key |
| PATCH | `/pricing/customer-groups/{id}` | Edit a customer group (version) | `order.customer.update` | yes | /pricing/customer-groups → Edit group | SA AD OM | — | U | **P5** |  |
| DELETE | `/pricing/customer-groups/{id}` | Delete a customer group | `order.customer.update` | yes | /pricing/customer-groups → Delete group | SA AD OM | Irreversible | D | **P5** |  |
| GET | `/pricing/customer-groups/{id}/members` | Members of a group | `order.customer.read` | — | /pricing/customer-groups?id= → Members table | SA AD OM | — | L | **P5** |  |
| POST | `/pricing/customer-groups/{id}/members` | Add customers by id | `order.customer.update` | yes | /pricing/customer-groups?id= → Add members | SA AD OM | — | A | **P5** | No customer search API exists: ids must be pasted or picked from Carts |
| DELETE | `/pricing/customer-groups/{id}/members` | Remove customers by id | `order.customer.update` | yes | /pricing/customer-groups?id= → Remove members | SA AD OM | — | A | **P5** |  |

### Pricing · Delivery charges (13)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/pricing/shipping-zones` | Delivery zones | `pricing.tax.read` | — | /pricing/delivery → Zones table | SA AD CM | — | L | **P5** | Internal delivery pricing, not a courier integration |
| POST | `/pricing/shipping-zones` | Create a zone | `pricing.tax.update` | yes | /pricing/delivery → Add zone | SA AD | — | C | **P5** |  |
| PATCH | `/pricing/shipping-zones/{id}` | Edit a zone (version) | `pricing.tax.update` | yes | /pricing/delivery → Edit zone | SA AD | — | U | **P5** |  |
| DELETE | `/pricing/shipping-zones/{id}` | Delete a zone | `pricing.tax.update` | yes | /pricing/delivery → Delete zone | SA AD | Irreversible | D | **P5** |  |
| GET | `/pricing/shipping-rates` | Delivery rates | `pricing.tax.read` | — | /pricing/delivery → Rates table | SA AD CM | — | L | **P5** |  |
| POST | `/pricing/shipping-rates` | Create a rate | `pricing.tax.update` | yes | /pricing/delivery → Add rate | SA AD | — | C | **P5** |  |
| PATCH | `/pricing/shipping-rates/{id}` | Edit a rate (version) | `pricing.tax.update` | yes | /pricing/delivery → Edit rate | SA AD | — | U | **P5** |  |
| DELETE | `/pricing/shipping-rates/{id}` | Delete a rate | `pricing.tax.update` | yes | /pricing/delivery → Delete rate | SA AD | Irreversible | D | **P5** |  |
| GET | `/pricing/shipping-pincodes` | Serviceable pincodes (optional zoneId query) | `pricing.tax.read` | — | /pricing/delivery?zone= → Pincodes table | SA AD CM | — | L | **P5** | zoneId is read unvalidated by the controller; not paginated |
| POST | `/pricing/shipping-pincodes` | Add a pincode to a zone | `pricing.tax.update` | yes | /pricing/delivery?zone= → Add pincode | SA AD | — | C | **P5** |  |
| DELETE | `/pricing/shipping-pincodes/{id}` | Remove a pincode | `pricing.tax.update` | yes | /pricing/delivery?zone= → Remove pincode | SA AD | Irreversible | D | **P5** |  |
| POST | `/pricing/shipping-pincode-ranges` | Add a pincode range to a zone | `pricing.tax.update` | yes | /pricing/delivery?zone= → Add range | SA AD | — | C | **P5** |  |
| POST | `/pricing/shipping-zones/{id}/pincodes/import` | Import pincodes from CSV (multipart "files" or csv field) | `pricing.tax.update` | yes | /pricing/delivery?zone= → Import pincodes | SA AD | — | UP | **P5** | Rate limited (pincode-import); rate limit: pincode-import |

### Catalog · Import & export (6)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/catalog/export/{entity}` | Stream a CSV export (formula-injection safe) | `catalog.product.export` | — | /catalog/import-export → Export CSV | SA AD CM | — | DL | **P2** ✓ | Rate limited (catalog-export); download as blob; rate limit: catalog-export |
| GET | `/catalog/import/templates/{entity}` | Download a CSV template | `catalog.product.import` | — | /catalog/import-export → Download template | SA AD CM | — | DL | **P2** ✓ |  |
| POST | `/catalog/import/{entity}` | Upload a CSV; dry run by default (validates, writes nothing) | — (own account) | yes | /catalog/import-export → Validate file | any admin | — | UP | **P2** ✓ | Entity-specific permissions checked server-side; rate limited (catalog-import); rate limit: catalog-import |
| POST | `/catalog/import/jobs/{id}/commit` | Commit a validated job (re-attach the same file) | — (own account) | yes | /catalog/import-export?job= → Import now | any admin | Irreversible | A | **P2** ✓ | Re-attach exactly the validated file: the server compares its sha256 and answers 409 IMPORT_FILE_MISMATCH otherwise (jobs validated before that check existed must be validated again); rate limit: catalog-import; Idempotency-Key |
| GET | `/catalog/import/jobs` | Import job history | `catalog.product.import` | — | /catalog/import-export → History table | SA AD CM | — | L | **P2** ✓ |  |
| GET | `/catalog/import/jobs/{id}` | One job with row errors | `catalog.product.import` | — | /catalog/import-export?job= → Job result | SA AD CM | — | G | **P2** ✓ |  |

### Search (10)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/search/analytics` | Top/zero-result queries, CTR, 30-day trend | `catalog.product.update` | — | /search/insights → Insights | SA AD CM | — | G | **P6** | Also: Dashboard zero-results widget |
| GET | `/search/synonyms` | Synonym sets | `catalog.product.update` | — | /search/synonyms → Synonyms table | SA AD CM | — | L | **P6** |  |
| POST | `/search/synonyms` | Create a synonym set | `catalog.product.update` | yes | /search/synonyms, /search/insights → Add synonym | SA AD CM | — | C | **P6** |  |
| PATCH | `/search/synonyms/{term}` | Edit a synonym set | `catalog.product.update` | yes | /search/synonyms → Edit synonym | SA AD CM | — | u | **P6** |  |
| DELETE | `/search/synonyms/{term}` | Delete a synonym set | `catalog.product.update` | yes | /search/synonyms → Delete synonym | SA AD CM | Irreversible | D | **P6** |  |
| POST | `/search/reindex` | Start a (partial or full) reindex job | `catalog.product.update` | yes | /search/index → Rebuild index | SA AD CM | — | A | **P6** | 202 + job; poll the job while visible |
| GET | `/search/jobs` | Recent reindex jobs | `catalog.product.update` | — | /search/index → Jobs table | SA AD CM | — | L | **P6** |  |
| GET | `/search/jobs/{id}` | Reindex job progress | `catalog.product.update` | — | /search/index → Progress | SA AD CM | — | G | **P6** |  |
| POST | `/search/popularity/recompute` | Recompute popularity scores | `catalog.product.update` | yes | /search/index → Recompute popularity | SA AD CM | — | A | **P6** |  |
| GET | `/catalog/products/{id}/search-document` | What search indexed for a product | `catalog.product.read` | — | /catalog/products/edit?id=&tab=seo → What search sees | SA AD CM OM CO | — | G | **P6** |  |

### Content · Pages (19)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/cms/pages` | List pages | `cms.page.read` | — | /content/pages → Pages table | SA AD CO | — | L | **P7** ✓ |  |
| POST | `/cms/pages` | Create a page | `cms.page.create` | yes | /content/pages → New page | SA AD CO | — | C | **P7** |  |
| GET | `/cms/pages/{id}` | One page with blocks | `cms.page.read` | — | /content/pages/edit?id= → Page builder | SA AD CO | — | G | **P7** |  |
| PATCH | `/cms/pages/{id}` | Edit page settings (version) | `cms.page.update` | yes | /content/pages/edit?id=&tab=settings → Save | SA AD CO | — | U | **P7** |  |
| DELETE | `/cms/pages/{id}` | Soft-delete a page | `cms.page.delete` | yes | /content/pages/edit?id= → Delete page | SA AD CO | Irreversible | D | **P7** | No restore endpoint |
| POST | `/cms/pages/{id}/publish` | Publish; 422 lists every blocker | `cms.page.update` | yes | /content/pages/edit?id= → Publish | SA AD CO | — | A | **P7** |  |
| POST | `/cms/pages/{id}/unpublish` | Unpublish | `cms.page.update` | yes | /content/pages/edit?id= → Unpublish | SA AD CO | Reversible | A | **P7** |  |
| POST | `/cms/pages/{id}/schedule` | Schedule publish (and optional expiry) | `cms.page.update` | yes | /content/pages/edit?id= → Schedule | SA AD CO | — | A | **P7** |  |
| POST | `/cms/pages/{id}/duplicate` | Duplicate with a new slug/title | `cms.page.create` | yes | /content/pages → Duplicate | SA AD CO | — | C | **P7** |  |
| POST | `/cms/pages/{id}/preview` | Render including drafts (data, not HTML) | `cms.page.read` | yes | /content/pages/edit?id=&tab=preview → Preview | SA AD CO | — | P | **P7** |  |
| GET | `/cms/pages/{id}/revisions` | Revision history | `cms.page.read` | — | /content/pages/edit?id=&tab=history → Revisions | SA AD CO | — | L | **P7** |  |
| POST | `/cms/pages/{id}/revisions/{version}/restore` | Restore a revision (writes a new revision) | `cms.page.update` | yes | /content/pages/edit?id=&tab=history → Restore this version | SA AD CO | — | A | **P7** |  |
| POST | `/cms/pages/{id}/blocks` | Add a block | `cms.page.update` | yes | /content/pages/edit?id= → Add block | SA AD CO | — | C | **P7** |  |
| PATCH | `/cms/pages/{id}/blocks/{blockId}` | Edit a block | `cms.page.update` | yes | /content/pages/edit?id= → Save block | SA AD CO | — | u | **P7** |  |
| DELETE | `/cms/pages/{id}/blocks/{blockId}` | Remove a block | `cms.page.update` | yes | /content/pages/edit?id= → Remove block | SA AD CO | Reversible | D | **P7** | Recoverable via revision restore |
| POST | `/cms/pages/{id}/blocks/reorder` | Reorder blocks | `cms.page.update` | yes | /content/pages/edit?id= → Drag to reorder | SA AD CO | — | R | **P7** |  |
| GET | `/cms/block-types` | Block registry: defaults + media/reference paths | `cms.page.read` | — | /content/pages/edit?id= → Block palette | SA AD CO | — | L | **P7** |  |
| GET | `/seo/preview/{type}/{id}` | Meta tags an entity will render with | `cms.page.read` | — | /content/pages/edit?id=&tab=seo, product SEO tab → SEO preview | SA AD CO | — | G | **P7** |  |
| POST | `/seo/sitemap/rebuild` | Rebuild the sitemap cache | `cms.page.update` | yes | /content/pages (SEO tools), /content/site-settings → Rebuild sitemap | SA AD CO | — | A | **P7** | on the Pages toolbar because CO cannot open Site settings |

### Content · Banners & announcements (10)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/cms/banners` | List banners | `cms.banner.read` | — | /content/banners → Banners table | SA AD CO | — | L | **P7** ✓ | isActive=true\|false filters correctly (booleanQuerySchema) |
| POST | `/cms/banners` | Create a banner | `cms.banner.create` | yes | /content/banners → Add banner | SA AD CO | — | C | **P7** |  |
| PATCH | `/cms/banners/{id}` | Edit a banner (version) | `cms.banner.update` | yes | /content/banners → Edit banner | SA AD CO | Reversible | U | **P7** |  |
| DELETE | `/cms/banners/{id}` | Delete a banner | `cms.banner.delete` | yes | /content/banners → Delete banner | SA AD CO | Irreversible | D | **P7** |  |
| POST | `/cms/banners/reorder` | Reorder banners | `cms.banner.update` | yes | /content/banners → Drag to reorder | SA AD CO | — | R | **P7** |  |
| GET | `/cms/banners/{id}/stats` | Impressions and clicks | `cms.banner.read` | — | /content/banners?id= → Performance | SA AD CO | — | G | **P7** |  |
| GET | `/cms/announcements` | Announcement bars | `cms.banner.read` | — | /content/announcements → Announcements table | SA AD CO | — | L | **P7** |  |
| POST | `/cms/announcements` | Create an announcement bar | `cms.banner.create` | yes | /content/announcements → Add announcement | SA AD CO | — | C | **P7** |  |
| PATCH | `/cms/announcements/{id}` | Edit an announcement bar (version) | `cms.banner.update` | yes | /content/announcements → Edit announcement | SA AD CO | Reversible | U | **P7** |  |
| DELETE | `/cms/announcements/{id}` | Delete an announcement bar | `cms.banner.delete` | yes | /content/announcements → Delete announcement | SA AD CO | Irreversible | D | **P7** |  |

### Content · FAQs & help centre (18)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/cms/faqs` | List FAQs | `cms.faq.read` | — | /content/faqs → FAQs table | SA AD CO | — | L | **P7** |  |
| POST | `/cms/faqs` | Create a FAQ | `cms.faq.create` | yes | /content/faqs → Add FAQ | SA AD CO | — | C | **P7** |  |
| PATCH | `/cms/faqs/{id}` | Edit a FAQ (version) | `cms.faq.update` | yes | /content/faqs → Edit FAQ | SA AD CO | Reversible | U | **P7** |  |
| DELETE | `/cms/faqs/{id}` | Delete a FAQ | `cms.faq.delete` | yes | /content/faqs → Delete FAQ | SA AD CO | Irreversible | D | **P7** |  |
| POST | `/cms/faqs/reorder` | Reorder FAQs | `cms.faq.update` | yes | /content/faqs → Drag to reorder | SA AD CO | — | R | **P7** |  |
| GET | `/cms/faq-categories` | FAQ categories | `cms.faq.read` | — | /content/faqs → Categories panel | SA AD CO | — | L | **P7** |  |
| POST | `/cms/faq-categories` | Create a FAQ category | `cms.faq.create` | yes | /content/faqs → Add category | SA AD CO | — | C | **P7** |  |
| PATCH | `/cms/faq-categories/{id}` | Edit a FAQ category (version) | `cms.faq.update` | yes | /content/faqs → Edit category | SA AD CO | — | U | **P7** |  |
| DELETE | `/cms/faq-categories/{id}` | Delete a FAQ category | `cms.faq.delete` | yes | /content/faqs → Delete category | SA AD CO | Irreversible | D | **P7** |  |
| GET | `/cms/help/categories` | Help category tree | `cms.page.read` | — | /content/help-centre → Category tree | SA AD CO | — | L | **P7** |  |
| POST | `/cms/help/categories` | Create a help category | `cms.page.create` | yes | /content/help-centre → Add category | SA AD CO | — | C | **P7** |  |
| PATCH | `/cms/help/categories/{id}` | Edit a help category (version) | `cms.page.update` | yes | /content/help-centre → Edit category | SA AD CO | — | U | **P7** |  |
| DELETE | `/cms/help/categories/{id}` | Delete a help category | `cms.page.delete` | yes | /content/help-centre → Delete category | SA AD CO | Irreversible | D | **P7** |  |
| GET | `/cms/help/articles` | Help articles | `cms.page.read` | — | /content/help-centre → Articles table | SA AD CO | — | L | **P7** |  |
| POST | `/cms/help/articles` | Create a help article (Markdown) | `cms.page.create` | yes | /content/help-centre → New article | SA AD CO | — | C | **P7** |  |
| PATCH | `/cms/help/articles/{id}` | Edit a help article (version) | `cms.page.update` | yes | /content/help-centre?article= → Save / Publish / Archive | SA AD CO | Reversible | U | **P7** |  |
| DELETE | `/cms/help/articles/{id}` | Delete a help article | `cms.page.delete` | yes | /content/help-centre?article= → Delete article | SA AD CO | Irreversible | D | **P7** |  |
| POST | `/cms/help/articles/reorder` | Reorder help articles | `cms.page.update` | yes | /content/help-centre → Drag to reorder | SA AD CO | — | R | **P7** |  |

### Content · Testimonials, stores, navigation, settings (18)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/cms/testimonials` | Testimonials | `cms.page.read` | — | /content/testimonials → Testimonials table | SA AD CO | — | L | **P7** |  |
| POST | `/cms/testimonials` | Create a testimonial | `cms.page.create` | yes | /content/testimonials → Add testimonial | SA AD CO | — | C | **P7** |  |
| PATCH | `/cms/testimonials/{id}` | Edit a testimonial (version) | `cms.page.update` | yes | /content/testimonials → Edit testimonial | SA AD CO | Reversible | U | **P7** |  |
| DELETE | `/cms/testimonials/{id}` | Delete a testimonial | `cms.page.delete` | yes | /content/testimonials → Delete testimonial | SA AD CO | Irreversible | D | **P7** |  |
| POST | `/cms/testimonials/reorder` | Reorder testimonials | `cms.page.update` | yes | /content/testimonials → Drag to reorder | SA AD CO | — | R | **P7** |  |
| GET | `/cms/stores` | Store locations | `cms.page.read` | — | /content/stores → Stores table | SA AD CO | — | L | **P7** |  |
| POST | `/cms/stores` | Create a store | `cms.page.create` | yes | /content/stores → Add store | SA AD CO | — | C | **P7** |  |
| PATCH | `/cms/stores/{id}` | Edit a store (version) | `cms.page.update` | yes | /content/stores → Edit store | SA AD CO | Reversible | U | **P7** |  |
| DELETE | `/cms/stores/{id}` | Delete a store | `cms.page.delete` | yes | /content/stores → Delete store | SA AD CO | Irreversible | D | **P7** |  |
| POST | `/cms/stores/reorder` | Reorder stores | `cms.page.update` | yes | /content/stores → Drag to reorder | SA AD CO | — | R | **P7** |  |
| GET | `/navigation` | Navigation menus | `cms.navigation.read` | — | /content/navigation → Menu list | SA AD CM CO | — | L | **P7** |  |
| GET | `/navigation/{key}` | One menu with items | `cms.navigation.read` | — | /content/navigation?menu= → Menu editor | SA AD CM CO | — | G | **P7** |  |
| POST | `/navigation/{key}/items` | Add a menu item (target verified; depth ≤ 3) | `cms.navigation.update` | yes | /content/navigation?menu= → Add item | SA AD CO | — | C | **P7** |  |
| PATCH | `/navigation/items/{id}` | Edit a menu item | `cms.navigation.update` | yes | /content/navigation?menu= → Edit item | SA AD CO | Reversible | u | **P7** | menuColumn 0..NAVIGATION_MENU_COLUMN_MAX (10). Rows seeded earlier with 11-13 must be corrected here; send changed fields only |
| DELETE | `/navigation/items/{id}` | Delete a menu item | `cms.navigation.update` | yes | /content/navigation?menu= → Delete item | SA AD CO | Irreversible | D | **P7** |  |
| POST | `/navigation/{key}/reorder` | Reorder a menu | `cms.navigation.update` | yes | /content/navigation?menu= → Drag to reorder | SA AD CO | — | R | **P7** |  |
| GET | `/content/settings` | Site contact, social, SEO and CMS settings | `system.setting.read` | — | /content/site-settings → Settings form | SA AD | — | G | **P7** |  |
| PUT | `/content/settings` | Write whitelisted content settings (20 keys) | `system.setting.update` | yes | /content/site-settings → Save settings | SA AD | — | u | **P7** |  |

### Enquiries (4)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/enquiries` | Enquiry queue (status, form, category, assignee, search) | `lead.enquiry.read` | — | /enquiries → Queue | SA AD OM CO | — | L | **P8** ✓ | Also: Dashboard "New enquiries" |
| GET | `/enquiries/assignees` | Admins an enquiry can be assigned to (id and name only) | `lead.enquiry.assign` | — | /enquiries?id= → Assignee picker | SA AD CO | — | L | **P8** | Requires lead.enquiry.assign; the same rule PATCH applies to assignedToId |
| GET | `/enquiries/{id}` | One enquiry with details and context | `lead.enquiry.read` | — | /enquiries?id= → Enquiry drawer | SA AD OM CO | — | G | **P8** ✓ |  |
| PATCH | `/enquiries/{id}` | Move status, assign, add note (version) | `lead.enquiry.update` | yes | /enquiries?id= → Update status / Assign / Note | SA AD CO | — | U | **P8** | Changing the assignee needs lead.enquiry.assign; pick from GET /enquiries/assignees (eligible admins only, else 422) |

### Carts & wishlists (6)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/carts` | Browse carts incl. abandoned | `order.customer.read` | — | /carts → Carts table | SA AD OM | — | L | **P8** |  |
| GET | `/carts/stats` | Abandonment rate, average value, top abandoned products | `order.customer.read` | — | /carts → Stats header | SA AD OM | — | G | **P8** |  |
| GET | `/carts/{id}` | Cart with event timeline and live re-quote | `order.customer.read` | — | /carts?id= → Cart drawer | SA AD OM | — | G | **P8** |  |
| POST | `/carts/cleanup` | Mark abandoned and expire stale carts | `order.customer.update` | yes | /carts → Run cart cleanup | SA AD OM | Irreversible | A | **P8** |  |
| GET | `/customers/{id}/cart` | A customer's active cart | `order.customer.read` | — | /carts?customer= → Customer cart | SA AD OM | — | G | **P8** |  |
| GET | `/wishlists/stats` | Most-wishlisted products and price-drop candidates | `order.customer.read` | — | /carts?tab=wishlists → Wishlist insights | SA AD OM | — | G | **P8** |  |

### Orders (limited verification) (25)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/orders` | Browse orders | `order.order.read` | — | /orders → Orders table | SA AD OM | — | L | **P9** |  |
| GET | `/orders/{id}` | Order with payments, allocations and ledger check | `order.order.read` | — | /orders/view?id= → Order detail | SA AD OM | — | G | **P9** |  |
| GET | `/orders/{id}/ledger-check` | Does the order's money balance? | `order.order.read` | — | /orders/view?id= → Ledger check (advanced) | SA AD OM | — | G | **P9** |  |
| POST | `/orders/{id}/status` | Guarded status transition | `order.order.update` | yes | /orders/view?id= → Change status | SA AD OM | — | A | **P9** | Allowed transitions live only in the backend state machine |
| POST | `/orders/{id}/cancel` | Cancel an order | `order.order.cancel` | yes | /orders/view?id= → Cancel order | SA AD OM | Irreversible | A | **P9** |  |
| GET | `/orders/{id}/split-preview` | What the payout split would allocate | `payment.split.read` | — | (hidden) → — | SA AD | — | G | **hold:payments** |  |
| POST | `/orders/{id}/retry-transfers` | Retry failed payout legs | `payment.split.update` | yes | (hidden) → — | SA | — | A | **hold:payments** |  |
| POST | `/orders/reconcile` | Payment reconciliation sweep | `order.order.update` | yes | (hidden) → — | SA AD OM | — | A | **hold:payments** | Pending online payments only exist when Razorpay is live |
| GET | `/orders/{orderNumber}/shipments` | Shipments and unshipped quantities of an order | `order.order.read` | — | /orders/view?id=&tab=fulfilment → Fulfilment panel | SA AD OM | — | G | **P9** |  |
| POST | `/orders/{orderNumber}/shipments` | Draft a shipment (manual: true) | `order.order.fulfil` | yes | /orders/view?id=&tab=fulfilment → Create manual shipment | SA AD OM | — | C | **P9** | UI always sends manual: true while the courier integration is on hold; Idempotency-Key; Idempotency-Key |
| GET | `/orders/{orderNumber}/serviceability` | Courier options for an order | `order.order.fulfil` | — | (hidden) → — | SA AD OM | — | G | **hold:shipping** |  |
| GET | `/shipments` | List shipments | `order.order.read` | — | /orders/shipments → Shipments table | SA AD OM | — | L | **P9** |  |
| GET | `/shipments/{shipmentNumber}` | Shipment with full timeline | `order.order.read` | — | /orders/shipments?n= → Shipment drawer | SA AD OM | — | G | **P9** |  |
| POST | `/shipments/{shipmentNumber}/awb` | Assign an AWB (courier) or record a manual docket | `order.order.fulfil` | yes | /orders/shipments?n= → Record docket number | SA AD OM | — | A | **P9** | Only manualAwb + manualCourierName; the courierId path is HOLD-SHIP; Idempotency-Key |
| POST | `/shipments/{shipmentNumber}/pickup` | Schedule a courier pickup | `order.order.fulfil` | yes | (hidden) → — | SA AD OM | — | A | **hold:shipping** |  |
| POST | `/shipments/{shipmentNumber}/cancel` | Cancel a shipment | `order.order.fulfil` | yes | /orders/shipments?n= → Cancel shipment | SA AD OM | Irreversible | A | **P9** |  |
| POST | `/shipments/{shipmentNumber}/status` | Move a shipment by hand (state machine) | `order.order.fulfil` | yes | /orders/shipments?n= → Update status | SA AD OM | — | A | **P9** |  |
| POST | `/shipments/{shipmentNumber}/sync` | Pull current state from the courier | `order.order.fulfil` | yes | (hidden) → — | SA AD OM | — | A | **hold:shipping** |  |
| GET | `/ndr` | Failed deliveries awaiting a decision | `order.order.read` | — | /orders/shipments?tab=ndr → Failed deliveries | SA AD OM | — | L | **P9** | Decisions are recorded locally when no courier can act |
| POST | `/ndr/{id}/action` | Reattempt / return / contact buyer | `order.order.fulfil` | yes | /orders/shipments?tab=ndr → Decide | SA AD OM | — | A | **P9** |  |
| GET | `/orders/{orderNumber}/documents` | Documents issued for an order | `order.order.read` | — | /orders/view?id=&tab=documents → Documents | SA AD OM | — | L | **P9** |  |
| POST | `/orders/{orderNumber}/documents/invoice` | Issue the GST tax invoice (once; never regenerated) | `order.order.update` | yes | /orders/view?id=&tab=documents → Issue invoice | SA AD OM | Irreversible | A | **P9** | Idempotency-Key; Idempotency-Key |
| GET | `/documents/{documentNumber}/download` | Download a checksum-verified document | `order.order.read` | — | /orders/view?id=&tab=documents → Download PDF | SA AD OM | — | DL | **P9** |  |
| GET | `/notifications/logs` | What was sent / skipped / failed | `order.order.read` | — | /orders/notifications → Notification log | SA AD OM | — | L | **P9** | Read-only; delivery is on hold (MAIL_DRIVER=log) |
| GET | `/reports` | Operational reports (CSV or JSON totals) | computed per request | — | /orders/reports → Generate report | per kind (see notes) | — | DL | **P9** | Permission per kind: SALES_SUMMARY, GST_HSN_SUMMARY, TOP_PRODUCTS need order.order.export; INVENTORY_MOVEMENT needs catalog.inventory.read. REFUND_SUMMARY and SPLIT_PAYOUT belong to on-hold domains and are never offered |

### On hold · Payments (13)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/payments/settings` | Payment settings | `payment.settings.read` | — | (hidden) → — | SA AD | — | G | **hold:payments** |  |
| PUT | `/payments/settings` | Update payment settings | `payment.settings.update` | yes | (hidden) → — | SA | — | u | **hold:payments** |  |
| GET | `/payments/split-accounts` | Payout accounts | `payment.settings.read` | — | (hidden) → — | SA AD | — | L | **hold:payments** |  |
| POST | `/payments/split-accounts` | Add a payout account | `payment.settings.update` | yes | (hidden) → — | SA | — | C | **hold:payments** |  |
| PATCH | `/payments/split-accounts/{id}` | Update a payout account | `payment.settings.update` | yes | (hidden) → — | SA | — | U | **hold:payments** |  |
| GET | `/payments/split-rules` | Split rules | `payment.split.read` | — | (hidden) → — | SA AD | — | L | **hold:payments** |  |
| POST | `/payments/split-rules` | Create a split rule | `payment.split.update` | yes | (hidden) → — | SA | — | C | **hold:payments** |  |
| PATCH | `/payments/split-rules/{id}` | Update a split rule | `payment.split.update` | yes | (hidden) → — | SA | — | u | **hold:payments** |  |
| DELETE | `/payments/split-rules/{id}` | Delete a split rule | `payment.split.update` | yes | (hidden) → — | SA | Irreversible | D | **hold:payments** |  |
| POST | `/payments/split-simulate` | Simulate a split | `payment.split.read` | yes | (hidden) → — | SA AD | — | P | **hold:payments** |  |
| GET | `/payments/attention` | Refunds and reversals needing a decision | `order.refund.read` | — | (hidden) → — | SA AD OM | — | L | **hold:refunds** |  |
| GET | `/webhooks` | Stored provider events | `order.order.read` | — | (hidden) → — | SA AD OM | — | L | **hold:payments** |  |
| POST | `/webhooks/{id}/replay` | Re-process a stored event | `order.order.update` | yes | (hidden) → — | SA AD OM | — | A | **hold:payments** |  |

### On hold · Refunds & returns (12)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| POST | `/orders/{orderNumber}/refunds` | Raise a refund (records it; moves no money) | `order.refund.create` | yes | (hidden) → — | SA AD OM | — | C | **hold:refunds** | Idempotency-Key |
| POST | `/orders/{orderNumber}/refunds/preview` | Preview refund maths | `order.refund.read` | yes | (hidden) → — | SA AD OM | — | P | **hold:refunds** |  |
| POST | `/refunds/{id}/approve` | Approve a refund | `order.refund.approve` | yes | (hidden) → — | SA AD | — | A | **hold:refunds** |  |
| POST | `/refunds/{id}/execute` | Send the refund to the provider | `order.refund.approve` | yes | (hidden) → — | SA AD | Irreversible | A | **hold:refunds** | Idempotency-Key |
| POST | `/refunds/{id}/credit-note` | Issue the credit note for a processed refund | `order.refund.approve` | yes | (hidden) → — | SA AD | Irreversible | A | **hold:refunds** | Idempotency-Key |
| GET | `/returns` | Return requests | `order.order.read` | — | (hidden) → — | SA AD OM | — | L | **hold:returns** |  |
| GET | `/returns/{returnNumber}` | One return request | `order.order.read` | — | (hidden) → — | SA AD OM | — | G | **hold:returns** |  |
| POST | `/returns/{returnNumber}/approve` | Approve a return | `order.order.update` | yes | (hidden) → — | SA AD OM | — | A | **hold:returns** |  |
| POST | `/returns/{returnNumber}/reject` | Reject a return | `order.order.update` | yes | (hidden) → — | SA AD OM | — | A | **hold:returns** |  |
| POST | `/returns/{returnNumber}/receive` | Mark goods received | `order.order.update` | yes | (hidden) → — | SA AD OM | — | A | **hold:returns** |  |
| POST | `/returns/{returnNumber}/inspect` | Record inspection | `order.order.update` | yes | (hidden) → — | SA AD OM | — | A | **hold:returns** |  |
| POST | `/returns/{returnNumber}/complete` | Close, restock and raise the refund | `order.refund.create` | yes | (hidden) → — | SA AD OM | Irreversible | A | **hold:returns** |  |

### On hold · Notifications (2)

| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/notifications/templates` | Notification templates | `system.setting.read` | — | (hidden) → — | SA AD | — | L | **hold:email** | Templates only matter once a delivery channel is live |
| PUT | `/notifications/templates` | Create/update a template | `system.setting.update` | yes | (hidden) → — | SA AD | — | u | **hold:email** |  |

## 4. Routes without a screen (36)

| Status | Routes | Why | Re-enable when |
| --- | --- | --- | --- |
| hold:payments | 15 | PAYMENT_DRIVER=mock and RAZORPAY_ENABLED=false; production offers cash on delivery only | the Razorpay account is validated and RAZORPAY_ENABLED=true |
| hold:refunds | 6 | refund execution needs a live payment provider | payments are live and the refund policy is approved |
| hold:returns | 7 | FEATURE_CUSTOMER_RETURNS=false; no admin endpoint creates a return | FEATURE_CUSTOMER_RETURNS=true |
| hold:shipping | 3 | SHIPPING_DRIVER=manual, SHIPROCKET_ENABLED=false, SHIPPING_PROVIDER_VERIFIED=false | Shiprocket is verified against a live account |
| hold:email | 4 | MAIL_DRIVER=log: in production the message is only logged, never delivered | SMTP is configured |
| internal | 1 | no completion endpoint registers or processes a presigned upload | the API offers a completion endpoint that validates and processes the object |

## 5. Non-admin endpoints the admin calls

| Endpoint | Why | From phase |
| --- | --- | --- |
| `GET /api/v1/version` | App version and active drivers (integration status) | P0 |
| `GET /health` | API liveness on System status | P0 |
| `GET /ready` | Database and cache readiness on System status | P0 |
| `GET /api/v1/search` | Live storefront search test on Synonyms | P6 |
| `GET /api/v1/catalog/resolve` | "Check this old URL" on redirect panels | P3 |
| `GET /api/v1/catalog/products/{slug}/gallery` | "What customers see" on a live product's Media & Gallery section | P2 |

## 6. Keeping this true

1. When the backend changes: `npm run contracts:sync -- --backend <dir>` (pins `shared/src` and the route inventory).
2. `npm run coverage:check` lists every new, removed or changed route; classify it in `src/config/api-coverage.ts`.
3. `npm run coverage:doc` regenerates this document; review the diff with the backend change.
4. `npm run contracts:check -- --against-backend` in CI (with a backend checkout) fails on silent drift.
