# ClearWood Admin — Role & Permission Matrix

Source of truth: `shared/src/enums.ts` (`PERMISSION_CODES`, 86 codes, `isDangerousPermission`),
`backend/prisma/seed/data/roles.ts` (5 seeded roles, resolved with the seed's own resolver),
route guards (`requirePermission`), and the permission checks inside handlers listed in §4.

## 1. Rules the admin follows

1. **The backend decides.** The UI reads `permissions` from `GET /admin/auth/me` (or the
   login/refresh response) and uses them only to shape the interface. Every 403 is rendered as a
   permission state and never retried.
2. **Permissions, not role names.** Guards check codes. SUPER_ADMIN needs no special case: the API
   already returns every code for it (`rbacService.effectivePermissions`).
3. **Grants are data.** Roles are editable in the database and the seed never restores a revoked
   grant, so the tables below describe a fresh install, not production. Nothing in the admin
   hardcodes a role→permission mapping.
4. **Stale permissions heal themselves.** A role or grant change bumps `permissionVersion`; the next
   request answers `401 TOKEN_EXPIRED`, the client refreshes once, receives the new permission list,
   and re-renders navigation.

## 2. Seeded roles

| Role | Description (from seed) | Grant patterns | Denied | Codes |
| --- | --- | --- | --- | --- |
| SUPER_ADMIN | Unrestricted access, including roles, payments and the audit trail | `*` | — | 86 |
| ADMIN | Runs the business day to day; cannot change roles or payment settings | `*` | `system.role.*`, `system.user.delete`, `payment.settings.update`, `payment.split.update` | 79 |
| CATALOG_MANAGER | Owns products, categories, attributes, media and price adjustments | `catalog.*`, `pricing.adjustment.*`, `pricing.tax.read`, `media.*`, `cms.navigation.read` | — | 36 |
| ORDER_MANAGER | Processes orders, inventory and customer records; cannot approve refunds | `order.order.*`, `order.customer.*`, `order.refund.read`, `order.refund.create`, `catalog.product.read`, `catalog.inventory.*`, `lead.enquiry.read` | — | 15 |
| CONTENT_MANAGER | Owns pages, banners, FAQs, navigation, media and enquiries | `cms.*`, `media.*`, `lead.enquiry.*`, `catalog.category.read`, `catalog.product.read` | — | 24 |

Only these five codes can be assigned (`adminRoleCodeSchema`). Production note: the bootstrap account
`admin@clearwood.local` was created as SUPER_ADMIN by an early seed; fresh installs create an ADMIN
(infra/README §3).

## 3. Permission × role (seeded) and what each unlocks

`⚠` = dangerous (`isDangerousPermission`: `system.role.*`, `system.user.delete`, `payment.*`,
`*.export`, `order.refund.approve`) — raised audit severity and a warning marker in the UI.
`Routes` = admin routes whose guard requires the code. SA SUPER_ADMIN · AD ADMIN · CM CATALOG_MANAGER ·
OM ORDER_MANAGER · CO CONTENT_MANAGER.

| Permission | ⚠ | SA | AD | CM | OM | CO | Routes | Used by (screens) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `catalog.category.read` |  | ✓ | ✓ | ✓ |  | ✓ | 5 | /catalog/categories; also the shadowed DEFECT route |
| `catalog.category.create` |  | ✓ | ✓ | ✓ |  |  | 1 | /catalog/categories |
| `catalog.category.update` |  | ✓ | ✓ | ✓ |  |  | 3 | /catalog/categories, /catalog/import-export (CATEGORY import) |
| `catalog.category.delete` |  | ✓ | ✓ | ✓ |  |  | 2 | /catalog/categories |
| `catalog.category.reorder` |  | ✓ | ✓ | ✓ |  |  | 3 | /catalog/categories |
| `catalog.attribute.read` |  | ✓ | ✓ | ✓ |  |  | 4 | /catalog/attributes, /catalog/categories |
| `catalog.attribute.create` |  | ✓ | ✓ | ✓ |  |  | 2 | /catalog/attributes |
| `catalog.attribute.update` |  | ✓ | ✓ | ✓ |  |  | 7 | /catalog/attributes, /catalog/categories, /catalog/import-export (ATTRIBUTE_VALUE import) |
| `catalog.attribute.delete` |  | ✓ | ✓ | ✓ |  |  | 3 | /catalog/attributes |
| `catalog.product.read` |  | ✓ | ✓ | ✓ | ✓ | ✓ | 8 | /catalog/brands, /catalog/products, /catalog/products/edit, /catalog/settings, /catalog/merchandising |
| `catalog.product.create` |  | ✓ | ✓ | ✓ |  |  | 3 | /catalog/brands, /catalog/products/new, duplicate |
| `catalog.product.update` |  | ✓ | ✓ | ✓ |  |  | 21 | /catalog/brands, /catalog/products(/edit), /catalog/settings, product media, /search/insights, /search/synonyms, /search/index |
| `catalog.product.delete` |  | ✓ | ✓ | ✓ |  |  | 2 | /catalog/brands, /catalog/products/edit |
| `catalog.product.publish` |  | ✓ | ✓ | ✓ |  |  | 2 | /catalog/products/edit (publish/unpublish); bulk ACTIVATE/PUBLISH/UNPUBLISH |
| `catalog.product.import` |  | ✓ | ✓ | ✓ |  |  | 3 | /catalog/import-export (templates, history, PRODUCT/VARIANT/CATEGORY/ATTRIBUTE_VALUE import) |
| `catalog.product.export` | ⚠ | ✓ | ✓ | ✓ |  |  | 1 | /catalog/import-export (export) |
| `catalog.variant.read` |  | ✓ | ✓ | ✓ |  |  | 2 | product Variants tab (list, matrix preview) |
| `catalog.variant.create` |  | ✓ | ✓ | ✓ |  |  | 2 | product Variants tab |
| `catalog.variant.update` |  | ✓ | ✓ | ✓ |  |  | 3 | product Variants tab, VARIANT import |
| `catalog.variant.delete` |  | ✓ | ✓ | ✓ |  |  | 1 | product Variants tab |
| `catalog.collection.read` |  | ✓ | ✓ | ✓ |  |  | 2 | /catalog/collections |
| `catalog.collection.create` |  | ✓ | ✓ | ✓ |  |  | 1 | /catalog/collections/new |
| `catalog.collection.update` |  | ✓ | ✓ | ✓ |  |  | 7 | /catalog/collections, rule preview/evaluate, /system/status (evaluate all), bulk ASSIGN_COLLECTION |
| `catalog.collection.delete` |  | ✓ | ✓ | ✓ |  |  | 1 | /catalog/collections/edit |
| `catalog.inventory.read` |  | ✓ | ✓ | ✓ | ✓ |  | 3 | /catalog/inventory |
| `catalog.inventory.update` |  | ✓ | ✓ | ✓ | ✓ |  | 2 | /catalog/inventory, INVENTORY import, bulk ADJUST_STOCK |
| `pricing.adjustment.read` |  | ✓ | ✓ | ✓ |  |  | 9 | /pricing/price-rules, /pricing/tier-prices, /pricing/price-lists, /pricing/discount-rules, /pricing/simulator |
| `pricing.adjustment.create` |  | ✓ | ✓ | ✓ |  |  | 4 | same screens; PRICE_ADJUSTMENT import (with update) |
| `pricing.adjustment.update` |  | ✓ | ✓ | ✓ |  |  | 5 | same screens; PRICE_ADJUSTMENT import (with create) |
| `pricing.adjustment.delete` |  | ✓ | ✓ | ✓ |  |  | 4 | same screens |
| `pricing.tax.read` |  | ✓ | ✓ | ✓ |  |  | 5 | /pricing/tax, /pricing/delivery, product form tax picker |
| `pricing.tax.update` |  | ✓ | ✓ |  |  |  | 14 | /pricing/tax, /pricing/delivery, bulk SET_TAX_CLASS |
| `pricing.coupon.read` |  | ✓ | ✓ |  |  |  | 3 | /pricing/coupons |
| `pricing.coupon.create` |  | ✓ | ✓ |  |  |  | 2 | /pricing/coupons |
| `pricing.coupon.update` |  | ✓ | ✓ |  |  |  | 1 | /pricing/coupons |
| `pricing.coupon.delete` |  | ✓ | ✓ |  |  |  | 1 | /pricing/coupons |
| `media.asset.read` |  | ✓ | ✓ | ✓ |  | ✓ | 4 | /media, MediaPicker |
| `media.asset.upload` |  | ✓ | ✓ | ✓ |  | ✓ | 2 | /media, MediaPicker (presign route is INT) |
| `media.asset.update` |  | ✓ | ✓ | ✓ |  | ✓ | 5 | /media |
| `media.asset.delete` |  | ✓ | ✓ | ✓ |  | ✓ | 6 | /media, /system/status (storage check) |
| `order.order.read` |  | ✓ | ✓ |  | ✓ |  | 13 | P9 /orders, /orders/shipments, /orders/notifications; on-hold routes |
| `order.order.update` |  | ✓ | ✓ |  | ✓ |  | 8 | P9 order status, invoice; on-hold routes |
| `order.order.cancel` |  | ✓ | ✓ |  | ✓ |  | 1 | P9 cancel order |
| `order.order.fulfil` |  | ✓ | ✓ |  | ✓ |  | 8 | P9 manual shipments, NDR; on-hold courier routes |
| `order.order.export` | ⚠ | ✓ | ✓ |  | ✓ |  | 0 | no route — no order export exists |
| `order.refund.read` |  | ✓ | ✓ |  | ✓ |  | 2 | on hold (refunds) |
| `order.refund.create` |  | ✓ | ✓ |  | ✓ |  | 2 | on hold (refunds, returns) |
| `order.refund.approve` | ⚠ | ✓ | ✓ |  |  |  | 3 | on hold (refunds) |
| `order.customer.read` |  | ✓ | ✓ |  | ✓ |  | 7 | /carts, /pricing/customer-groups |
| `order.customer.update` |  | ✓ | ✓ |  | ✓ |  | 6 | /carts (cleanup), /pricing/customer-groups |
| `order.customer.block` |  | ✓ | ✓ |  | ✓ |  | 0 | no route — no customer blocking API |
| `order.customer.export` | ⚠ | ✓ | ✓ |  | ✓ |  | 0 | no route |
| `payment.settings.read` | ⚠ | ✓ | ✓ |  |  |  | 3 | on-hold payment routes only (reports use per-kind permissions since b5861fd) |
| `payment.settings.update` | ⚠ | ✓ |  |  |  |  | 3 | on hold (payments) |
| `payment.split.read` | ⚠ | ✓ | ✓ |  |  |  | 3 | on hold (payments) |
| `payment.split.update` | ⚠ | ✓ |  |  |  |  | 4 | on hold (payments) |
| `cms.page.read` |  | ✓ | ✓ |  |  | ✓ | 10 | /content/pages(/edit), /content/help-centre, /content/testimonials, /content/stores, SEO preview |
| `cms.page.create` |  | ✓ | ✓ |  |  | ✓ | 6 | same |
| `cms.page.update` |  | ✓ | ✓ |  |  | ✓ | 17 | same + sitemap rebuild |
| `cms.page.delete` |  | ✓ | ✓ |  |  | ✓ | 5 | same |
| `cms.banner.read` |  | ✓ | ✓ |  |  | ✓ | 3 | /content/banners, /content/announcements |
| `cms.banner.create` |  | ✓ | ✓ |  |  | ✓ | 2 | same |
| `cms.banner.update` |  | ✓ | ✓ |  |  | ✓ | 3 | same |
| `cms.banner.delete` |  | ✓ | ✓ |  |  | ✓ | 2 | same |
| `cms.navigation.read` |  | ✓ | ✓ | ✓ |  | ✓ | 2 | /content/navigation |
| `cms.navigation.update` |  | ✓ | ✓ |  |  | ✓ | 4 | /content/navigation |
| `cms.faq.read` |  | ✓ | ✓ |  |  | ✓ | 2 | /content/faqs |
| `cms.faq.create` |  | ✓ | ✓ |  |  | ✓ | 2 | /content/faqs |
| `cms.faq.update` |  | ✓ | ✓ |  |  | ✓ | 3 | /content/faqs |
| `cms.faq.delete` |  | ✓ | ✓ |  |  | ✓ | 2 | /content/faqs |
| `lead.enquiry.read` |  | ✓ | ✓ |  | ✓ | ✓ | 2 | /enquiries |
| `lead.enquiry.update` |  | ✓ | ✓ |  |  | ✓ | 1 | /enquiries |
| `lead.enquiry.assign` |  | ✓ | ✓ |  |  | ✓ | 0 | checked inside `PATCH /enquiries/{id}` when the assignee changes |
| `lead.enquiry.export` | ⚠ | ✓ | ✓ |  |  | ✓ | 0 | no route — no enquiry export exists |
| `system.user.read` |  | ✓ | ✓ |  |  |  | 1 | /system/users |
| `system.user.create` |  | ✓ | ✓ |  |  |  | 1 | /settings/users |
| `system.user.update` |  | ✓ | ✓ |  |  |  | 2 | /settings/users (edit/status; role change also needs `system.role.read`) |
| `system.user.delete` | ⚠ | ✓ |  |  |  |  | 1 | /settings/users |
| `system.role.read` | ⚠ | ✓ |  |  |  |  | 3 | /settings/roles, role change on /settings/users |
| `system.role.create` | ⚠ | ✓ |  |  |  |  | 1 | P1 /system/roles (custom roles, assignable since b5861fd) |
| `system.role.update` | ⚠ | ✓ |  |  |  |  | 1 | P1 /system/roles (grants loaded from `GET /roles/{id}`) |
| `system.role.delete` | ⚠ | ✓ |  |  |  |  | 1 | P1 /system/roles (unassigned custom roles only) |
| `system.setting.read` |  | ✓ | ✓ |  |  |  | 2 | /content/site-settings; on-hold notification templates |
| `system.setting.update` |  | ✓ | ✓ |  |  |  | 2 | /content/site-settings; on-hold notification templates |
| `system.audit.read` |  | ✓ | ✓ |  |  |  | 1 | /settings/audit-log, History tabs, Recently deleted categories |
| `system.audit.export` | ⚠ | ✓ | ✓ |  |  |  | 0 | no route — no audit export exists |

Six codes guard no route at all (`order.order.export`, `order.customer.block`, `order.customer.export`,
`lead.enquiry.export`, `system.audit.export`, and `lead.enquiry.assign` which is checked in the
handler). The admin shows no export/block buttons for them.

## 4. Checks inside handlers (not visible in route guards)

| Where | Rule | UI consequence |
| --- | --- | --- |
| `POST /catalog/bulk` (route gate `catalog.product.read`) | per action: ACTIVATE, PUBLISH, UNPUBLISH → `catalog.product.publish`; DEACTIVATE, RESTORE, MOVE/ADD/REMOVE_CATEGORY, SET_BRAND, SET_MERCHANDISING → `catalog.product.update`; DELETE → `catalog.product.delete`; ASSIGN_COLLECTION → `catalog.collection.update`; SET_TAX_CLASS → `pricing.tax.update`; ADJUST_STOCK → `catalog.inventory.update` (`bulkAction.service.ts`) | bulk menu lists only actions the admin holds |
| `POST /catalog/import/{entity}`, commit | PRODUCT `catalog.product.import`; VARIANT + `catalog.variant.update`; CATEGORY + `catalog.category.update`; ATTRIBUTE_VALUE + `catalog.attribute.update`; PRICE_ADJUSTMENT `pricing.adjustment.create` + `.update`; INVENTORY `catalog.inventory.update` (`import.service.ts`) | entity picker lists only permitted entities; templates and history additionally need `catalog.product.import` |
| `PATCH /enquiries/{id}` | changing `assignedToId` needs `lead.enquiry.assign`; the assignee must be an active admin who can read enquiries (422 otherwise) | assignee picker from `GET /enquiries/assignees` (same rule, `lead.enquiry.assign`) |
| `GET /reports` | route gate: any of `order.order.export`, `order.refund.read`, `payment.split.read`, `catalog.inventory.read`; the handler then requires the kind's own permission (`REPORT_PERMISSIONS`) | only SALES_SUMMARY, GST_HSN_SUMMARY, TOP_PRODUCTS (`order.order.export`) and INVENTORY_MOVEMENT (`catalog.inventory.read`) are offered; refund and split-payout kinds are on hold |
| `POST /users/{id}/password` | `system.user.update` + holding every permission the target holds; never your own account; ends the target's sessions; audited CRITICAL | "Reset password" shown only on manageable accounts |
| Admin users | **no amplification**: a role is grantable only if the actor holds all its permissions (`403 ROLE_NOT_GRANTABLE`); an account is manageable only by an actor holding everything it holds (`403 ADMIN_USER_NOT_MANAGEABLE`) | role options the actor cannot grant are disabled with an explanation; SUPER_ADMIN accounts are read-only for everyone else |
| Admin users | the last active SUPER_ADMIN cannot be disabled, suspended, deleted or demoted (`403 LAST_SUPER_ADMIN`); nobody can delete themselves | destructive options disabled with the reason |
| Roles | system roles cannot be deactivated or deleted; a role carrying permissions you do not hold cannot be changed (`ROLE_NOT_MANAGEABLE`); you cannot grant what you do not hold (`ROLE_NOT_GRANTABLE`) | editor disables those actions with the reason (P1) |
| All admin routes except self-service | `403 PASSWORD_CHANGE_REQUIRED` while `mustChangePassword` | forced redirect to `/change-password` |
| Content settings | only 20 whitelisted keys are writable (`content.service.ts WRITABLE_SETTINGS`) | the form renders exactly those keys |

## 5. Screen visibility (seeded roles)

F = full · R = read-only · P = partial (see note) · — = not shown.

| Screen | SA | AD | CM | OM | CO | Note |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard | F | F | F | F | F | widgets per permission |
| Products | F | F | F | R | R | OM/CO: gallery and variants shown read-only from the product detail DTO (the gallery endpoint needs `catalog.product.update`, variants need `catalog.variant.read`) |
| Categories | F | F | F | — | R | |
| Attributes | F | F | F | — | — | |
| Collections | F | F | F | — | — | |
| Merchandising | F | F | F | R | R | |
| Brands | F | F | F | R | R | |
| Inventory | F | F | F | F | — | |
| Import & export | F | F | F | P | — | OM: INVENTORY import only; no templates/history (needs `catalog.product.import`) |
| Catalog settings | F | F | F | R | R | |
| Media library | F | F | F | — | F | |
| Price rules, tier prices, price lists, discounts, simulator | F | F | F | — | — | |
| Coupons | F | F | — | — | — | |
| Customer groups | F | F | — | F | — | |
| Tax & GST, Delivery charges | F | F | R | — | — | |
| Search insights, synonyms, index | F | F | F | — | — | all need `catalog.product.update` |
| Pages, help centre, testimonials, stores | F | F | — | — | F | product SEO preview needs `cms.page.read`, so CM does not see it |
| Banners, announcements, FAQs | F | F | — | — | F | |
| Navigation menus | F | F | R | — | F | |
| Site & SEO settings | F | F | — | — | — | needs `system.setting.read`; sitemap rebuild is also on the Pages toolbar for CO |
| Enquiries | F | F | — | R | F | assignee picker via `GET /enquiries/assignees` (no `system.user.read` needed) |
| Carts & wishlists | F | F | — | F | — | |
| Orders console (P9) | F | F | — | P | — | OM: sales/GST/top-products and inventory reports (report permissions are per kind since b5861fd) |
| Admin users | F | P | — | — | — | AD: create/edit/suspend/reset password of manageable admins; cannot delete, cannot change roles of an existing admin (needs `system.role.read`), cannot grant SUPER_ADMIN |
| Roles & permissions | F | — | — | — | — | custom roles assignable since b5861fd |
| Audit log | F | F | — | — | — | |
| System status | F | F | F | F | F | maintenance actions per permission |
| My account | F | F | F | F | F | |

Because ADMIN cannot call `GET /admin/roles`, the "Add admin" role picker offers the codes of the
shared `ADMIN_ROLE_CODES` enum except SUPER_ADMIN (only a Super Admin can grant it) with seed display
names (`STANDARD_ROLES` in `src/features/admin-users/model.ts`). Custom roles are not listed without
`system.role.read`. The API still decides: a role carrying permissions the actor lacks is refused with
`403 ROLE_NOT_GRANTABLE`, shown inside the form. "Change roles" on an existing admin is shown as
unavailable with the permission it needs.

## 6. Permission UX patterns

| Situation | Pattern |
| --- | --- |
| No read permission for an area | entry absent from navigation; direct URL → full-page "You don't have access to Products. Ask a Super Admin for the Catalog Manager role or equivalent." |
| Read but not write | page renders read-only: inputs disabled, primary actions hidden, a banner "View only — you can't change products" |
| Some actions not permitted | action visible but disabled with a tooltip naming the missing permission's plain-language label |
| Dangerous action permitted | ⚠ marker and a typed confirmation |
| Unexpected 403 from the API | toast "You don't have permission to do that" + `traceId`; session revalidated once in the background (`GET /auth/me`) |
| 403 `PASSWORD_CHANGE_REQUIRED` | redirect to `/change-password` |

## 7. Gaps raised with the backend owner

Status at backend `b5861fd`:

1. ~~Custom roles are unusable~~ — **fixed** (`roleCodeSchema`; inactive roles refused).
2. ~~Role grants cannot be read~~ — **fixed** (`GET /admin/roles/{id}` includes `permissions`).
3. **ADMIN can create users but not change their roles later** (role change needs `system.role.read`, which ADMIN is denied) — still open; confirm this is intended.
4. ~~No admin password reset for another admin~~ — **fixed** (`POST /admin/users/{id}/password`).
5. ~~Admin-set initial passwords are not forced to change~~ — **fixed** (`mustChangePassword=true`).
6. ~~Enquiry assignee picker needs `system.user.read`~~ — **fixed** (`GET /admin/enquiries/assignees`).
7. ~~Reports gated by `payment.settings.read`~~ — **fixed** (per-kind permissions).
8. **No customer directory API** (F9) — open; the admin shows no customer list.

> A generated permission-by-role matrix with route counts per permission is in [ADMIN_CAPABILITY_MATRIX.md](ADMIN_CAPABILITY_MATRIX.md) §4 (regenerated by `npm run matrix:doc`, checked by `npm run verify`).
