# ClearWood Admin — Current State (master completion, 27 Sep 2026; updated 28 Oct 2026)

Verified against the actual heads, not earlier reports. Generated detail lives in
[ADMIN_CAPABILITY_MATRIX.md](ADMIN_CAPABILITY_MATRIX.md) (every route by class, permission matrix,
every admin mutation, missing backend capabilities) and [ADMIN_API_COVERAGE.md](ADMIN_API_COVERAGE.md)
(every admin route with purpose, screen and action). Both are regenerated from pinned sources and
checked by `npm run verify`. Decisions: [ADMIN_ARCHITECTURE.md §21](ADMIN_ARCHITECTURE.md) (pre-final
closure) and §22 (this pass).

## 1. Repository state

| | State |
| --- | --- |
| Backend (`clearwood-backend-repo`) | checked out on branch `feat/storefront-media-contract` at `cad49c2` (6 commits on top of `main` `c553f92`, made for the storefront, **not merged**). The admin runs against it: the real-backend specs passed on it on 8 Oct |
| Admin (this repository) | `main`, pushed to `origin` = `github.com/Monis-70/admin_clearwood_furniture` on 28 Oct |
| Pinned contracts | `contracts/manifest.json`: backend `c553f92`, 437 routes (318 admin). `contracts:check -- --against-backend` reports drift against `cad49c2` (shared schemas/types and route middleware): run `npm run contracts:sync` once that branch is merged |
| Deployment | none yet. Plan: [ADMIN_DEPLOYMENT_PLAN.md](ADMIN_DEPLOYMENT_PLAN.md) (static export behind nginx) |

## 2. Gates and exact test counts (final run of this pass)

| Gate | Result |
| --- | --- |
| `npm run verify` (contracts, coverage, both generated docs, typecheck, lint, format, unit/component tests, build, bundle budgets) | green |
| Unit and component tests (Vitest, MSW, axe) | **358 passed** in 60 files (28 Oct) |
| Browser, fake API (`npx playwright test`) | **14 passed** |
| Browser, real local API (`npx playwright test -c playwright.real.config.ts`, desktop + mobile, axe) | **76 passed** in 11 files (last full run 27 Sep; the specs touched on 8 Oct re-ran green: 62 passed) |
| Browser, real 429 (`npm run e2e:ratelimit`) | **1 passed** |
| Backend suite (`stack.ps1 backend-test`, Redis tests enabled) | **1157 tests in 81 files: 1152 passed, 5 skipped, 0 failed** (78 files passed, 3 opt-in files skipped) |
| Backend static gates | unchanged since `c553f92` (green in the pre-final closure) |

## 3. Route and UI coverage (generated from the repository)

| Class | Admin routes | Other routes | Total |
| --- | ---: | ---: | ---: |
| UI required: built (wired and used by a screen) | 282 | 6 | 288 |
| UI required: not wired yet | **0** | **0** | **0** |
| On hold (payments 15, refunds 6, returns 7, courier 3, e-mail 4) | 35 | 0 | 35 |
| Internal / system (`POST /media/presign`) | 1 | 0 | 1 |
| Not applicable to the admin (storefront and customer API) | 0 | 113 | 113 |
| **Total** | **318** | **119** | **437** |
| Missing backend capability (no route; must not be imitated) | 6 capabilities | | |

Implemented through phase P9. Admin routes by phase: P0 5, P1 16, P2 106, P3 3, P5 46, P6 12, P7 65,
P8 10, P9 19, on hold 35, internal 1. The 6 non-admin routes the admin calls: version, health,
readiness, the product gallery customers see, storefront search ("Try a search" on Synonyms) and the
storefront resolver ("Check an address" on product and category redirect panels).

OpenAPI: 172 of 437 routes are not described by the backend's OpenAPI document (a ratchet list that
may only shrink); 142 of them are admin routes and 139 of those are used here. The admin's contract is
the pinned route inventory plus the vendored shared types, so this is documentation debt, not drift.

## 4. What an authorised admin controls

| Area | Screens | Notes |
| --- | --- | --- |
| Catalogue | products (all tabs, bulk actions, related products), merchandising, variants, inventory, categories, collections, attributes, brands, tax classes, import/export, catalog settings | publish blockers come from the API |
| Pricing | price rules, tier prices, price lists, discount rules, coupons, customer groups, delivery charges, pricing settings, explain price, simulator | the client never computes a price or GST |
| Media | library, upload queue, product gallery | minimum image size enforced by the API |
| Search | insights, synonyms (with a live storefront try), index jobs and rebuilds, popularity, per-product search document | reindex runs in the request (C6) |
| Content | pages with a generated block builder, banners, announcements, FAQs, help centre, testimonials, stores, navigation, site settings, sitemap | publish blockers from `422 PAGE_NOT_PUBLISHABLE` |
| Enquiries | list, detail, status, assignment, internal note (versioned) | E1 |
| Carts | stats, carts, a customer's cart, wishlists, clean-up | F9 |
| Orders | list, view, status (server-allowed steps), cancel (typed confirmation), manual shipments, AWB, invoice, documents, money check, shipments + NDR, notification log, reports (CSV) | E2 |
| System | admin users, roles and permissions, audit log, entity history on records, status and integrations, maintenance (storage report, collection re-evaluation), own account | |
| Dashboard | work queues: orders to prepare, delivery problems, new enquiries, low stock, not published yet, missing images, missing information, recent admin activity | links to the filtered lists |

## 5. Risk register

Status values: FIXED · STILL OPEN · INTENTIONALLY ACCEPTED · OUT OF SCOPE · NEEDS PRODUCT DECISION.

| # | Risk | Status | Evidence / reason |
| --- | --- | --- | --- |
| F1–F8, F10–F13, F14, M1–M3, R1–R6, G1, G2 | Earlier findings | FIXED | see ADMIN_ARCHITECTURE §12 and §21 |
| F9 | No admin customer directory or search | NEEDS PRODUCT DECISION | missing backend capability; groups and carts work by customer id; nothing is faked |
| F14-db | Databases seeded before `127dd5d` keep the old category links, so those products stay blocked | NEEDS PRODUCT DECISION | fix in the admin (link attributes on the categories) or a reviewed one-off data migration |
| M4–M8, S1, T1 | Accepted media, import and E2E behaviours | INTENTIONALLY ACCEPTED | unchanged from the pre-final closure |
| S2 | Four permission codes have no endpoint (`order.customer.block`, `order.customer.export`, `lead.enquiry.export`, `system.audit.export`) | NEEDS PRODUCT DECISION | roles may hold them; no UI is built for them |
| S3 | OpenAPI debt (172 routes) | OUT OF SCOPE | backend ratchet |
| B1 | Bundle budget broken since P5 (all routes and icons on every page) | FIXED | per-domain route modules, lazy icons and dialogs; every page within 280 KB, largest 278.1 KB (`/content/pages`). Headroom is small; the gate fails the build on growth |
| E1 | Business enquiries have no quote, no discussion history and no link to the resulting order | NEEDS PRODUCT DECISION | missing backend capabilities; flow today: enquiry → assign → status + one note → customer orders on the storefront |
| E2 | Orders console is built while payments, refunds and courier are on hold: a paid order's cancel creates a `REQUESTED` refund nobody can process in the admin; NDR re-attempt and return need the courier | NEEDS PRODUCT DECISION | go-live sign-off for orders; the screens show the on-hold notice and never call an on-hold route |
| C1 | Deleting an FAQ group keeps its questions, ungrouped | INTENTIONALLY ACCEPTED | backend behaviour; the confirmation states the count and the "Not grouped" filter lists them |
| C2 | A help category with articles and a navigation item with children cannot be deleted | INTENTIONALLY ACCEPTED | `409 HELP_CATEGORY_HAS_ARTICLES` / `NAVIGATION_HAS_CHILDREN`, shown as written |
| C3 | `site.usp_lines` is stored as JSON but `PUT /content/settings` accepts scalars only | STILL OPEN (backend) | shown read-only in Site settings |
| C4 | Unversioned writes: navigation items and reorders, product relations `PUT`, tier price `PATCH` (last write wins) | STILL OPEN (backend, low) | the admin cannot add a version the API does not check |
| C5 | Not audited by the backend: synonym changes, reindex, popularity recompute, delivery zone/rate/pincode operations, customer-group member changes | STILL OPEN (backend) | every other admin mutation is audited |
| C6 | Search reindex runs inside the request | INTENTIONALLY ACCEPTED | long timeout in the admin; fine at the measured catalogue size |
| C7 | Pincode ranges can be created but not listed or deleted | STILL OPEN (backend) | no route |
| C8 | `GET /pricing/settings` does not return `shippingTaxClassCode` | STILL OPEN (backend) | the form cannot show the current value |
| C9 | Cart clean-up has no dry run | INTENTIONALLY ACCEPTED | explicit acknowledgement required |
| C10 | "Try a search" is logged as a customer search; checking an old address counts one visit | INTENTIONALLY ACCEPTED | stated beside both tools; runs only on an explicit click |
| O1 | The order and shipment state machines live only in the backend | INTENTIONALLY ACCEPTED | the admin offers every status and shows the server's `details.allowed` on refusal |
| D1 | Production values (origins, cookies, storage/CDN, trust proxy) | OUT OF SCOPE | no deployment in this phase |

## 6. Remaining items

| Class | Items |
| --- | --- |
| BLOCKER | none |
| PRODUCT DECISION | F9 customer directory; E1 enquiry quote/history/order link; E2 orders go-live while payments, refunds and courier are on hold; admin-created orders (missing capability); S2 permissions without endpoints; F14-db for databases seeded earlier |
| OPTIONAL (backend hardening) | C3, C4, C5, C7, C8; background reindex (C6); presigned uploads; OpenAPI debt (S3) |
| OUT OF SCOPE | the 35 on-hold integration routes; deployment and production configuration (D1); review and push of the three backend commits by the owner |

## 7. Security and data integrity of admin mutations

211 admin mutations (every one listed in ADMIN_CAPABILITY_MATRIX §5):

- CSRF: 207; the 4 without are the public sign-in, refresh and password-reset pair.
- Permission: 201 guarded on the route, 2 checked in the controller (imports, S1), 8 act on the
  caller's own session. The registry's access for every wired route is checked against the backend
  guard by `coverage:check` (an optional-customer storefront route counts as public: the admin holds
  no customer session).
- Versioned updates: 25 (stale version → conflict dialog). Idempotency-Key: 18, one key per logical
  attempt. Rate limited: 16.
- Destructive and financial actions need confirmation; irreversible ones need typing (order cancel)
  or an acknowledgement (clean-ups). No on-hold route is callable. No `dangerouslySetInnerHTML`,
  `innerHTML` or `eval`; no token in script-readable storage.

## 8. Performance

- Shared JS 197.8 KB gzip; every page ≤ 280 KB, largest `/content/pages` 278.1 KB,
  `/catalog/products` 277.7 KB, `/catalog/categories` 277.6 KB, `/orders/shipments` 275.5 KB.
- Lists are paginated by the API; dialogs, sheets, editors and forms are lazy chunks; list screens
  do not load zod.
- Backend scale baseline (3000 products) unchanged from the pre-final closure.

## 9. Verdict

**READY FOR FINAL ADMIN RELEASE**, on the local heads above: every admin route that is not on hold or
internal is controllable from a screen, every gate is green with the counts in §2, and no BLOCKER
remains. The PRODUCT DECISION items in §6 limit what the business can do (orders go-live, enquiry
quotes, customer directory), not what the admin exposes of the backend. Nothing is deployed or pushed.
