# ClearWood Admin — Current State (pre-final closure, 26 Sep 2026)

Verified against the actual heads, not earlier reports. Generated detail lives in
[ADMIN_CAPABILITY_MATRIX.md](ADMIN_CAPABILITY_MATRIX.md) (every route by class, remaining UI work,
permission matrix, every admin mutation) and [ADMIN_API_COVERAGE.md](ADMIN_API_COVERAGE.md) (every
admin route with purpose and screen). Both are regenerated from pinned sources and checked by
`npm run verify`. The decisions of this pass: [ADMIN_ARCHITECTURE.md §21](ADMIN_ARCHITECTURE.md).

## 1. Repository state

| | State |
| --- | --- |
| Backend (`clearwood-backend-repo`) | `main` at `c553f92`, three local commits on `origin/main` (`3a81325`), **not pushed**: `a03a1b4` F13 low-stock fix, `127dd5d` F14 seed fix, `c553f92` minimum product image. Working tree clean |
| Admin (this repository) | git initialised in this pass (baseline `484cf95`); closure work committed locally, no remote |
| Pinned contracts | `contracts/manifest.json`: backend `c553f92`, `dirty: false`, 28 shared files, 437 routes (318 admin), OpenAPI debt list pinned. `contracts:check --against-backend`: matches the backend working tree |
| Deployment | none. Nothing pushed, no remote created, no production change |

## 2. Gates and exact test counts

| Gate | Result |
| --- | --- |
| `npm run verify` (contracts, coverage, both generated docs, typecheck, lint, format, unit/component tests, build, bundle budgets) | green |
| Unit and component tests (Vitest, MSW, axe) | **302 passed** in 49 files |
| Browser, fake API (`npx playwright test`) | **14 passed** |
| Browser, real local API (`npm run e2e:real`, desktop + mobile, axe with colour contrast) | **60 passed** in 9 files |
| Browser, real 429 (`npm run e2e:ratelimit`, test-only API with 3 uploads per 20 s) | **1 passed** (also on a repeat run) |
| Backend suite (`stack.ps1 backend-test`, Redis tests enabled) | **1157 tests in 81 files: 1152 passed, 5 skipped, 0 failed** (the 5 are opt-in performance and benchmark tests) |
| Backend catalog scale baseline (opt-in, 3000 products) | passed; figures in §7 |
| Backend static gates (`npm run check`, typecheck backend/shared, eslint) | green at `c553f92` |

## 3. Route and UI coverage (generated from the repository)

| Class | Admin routes | Other routes | Total |
| --- | ---: | ---: | ---: |
| UI required: built (wired in the endpoint registry) | 131 | 4 | 135 |
| UI required: final UI phase | 151 | 2 | 153 |
| On hold (payments 15, refunds 6, returns 7, courier 3, e-mail 4) | 35 | 0 | 35 |
| Internal / system (`POST /media/presign`) | 1 | 0 | 1 |
| Not applicable to the admin (storefront and customer API) | 0 | 113 | 113 |
| **Total** | **318** | **119** | **437** |
| Missing backend capability (no route; must not be imitated) | 6 capabilities | | |

Admin routes by planned phase: P0 5, P1 16, P2 106, P3 3, P5 46, P6 12, P7 65, P8 10, P9 19,
on hold 35, internal 1. Implemented through P2; four later routes are already wired (enquiry list
and detail, the page and banner lists used by the dashboard).

OpenAPI: 172 of 437 routes are not described by the backend's OpenAPI document (its ratchet list may
only shrink); 142 of the 318 admin routes, 89 of them already used here. The admin's contract is the
pinned route inventory plus the vendored shared types, so this is backend documentation debt, not drift.

## 4. Risk register

Status values: FIXED · STILL OPEN · INTENTIONALLY ACCEPTED · OUT OF SCOPE · NEEDS PRODUCT DECISION.

| # | Risk | Status | Evidence / reason |
| --- | --- | --- | --- |
| F1–F8, F10–F12 | Backend findings from the analysis (duplicate route, OpenAPI mismatches, custom roles, role permissions, temporary passwords, admin password reset, import file check, banner filter, assignee picker, report permissions, menu columns) | FIXED | backend `b5861fd`; see ADMIN_ARCHITECTURE §12 |
| F9 | No admin customer directory or search | NEEDS PRODUCT DECISION | missing backend capability; groups manage members by id; nothing is faked |
| F13 | Trashed products filled the low-stock queue | FIXED | `a03a1b4`, `tests/low-stock.test.ts` |
| F14 | 66 of 71 seeded products failed the publish gate (`INVALID_CATEGORY_ATTRIBUTES`) | FIXED (seed) | `127dd5d`, `tests/seed-publish-gate.test.ts`; gate unchanged; admin marks foreign specifications |
| F14-db | Databases seeded **before** `127dd5d` (including any production database seeded earlier) keep the old category links, so the same products stay blocked there | NEEDS PRODUCT DECISION | create-only seeding never overwrites admin data. Options: link the attributes on the categories in the admin, or a reviewed one-off data migration |
| M1 | No minimum size for product images | FIXED | `c553f92` (`MIN_PRODUCT_IMAGE_DIMENSION` 1024, `422 IMAGE_TOO_SMALL` on attach) + admin pre-check and picker; `media-api.test.ts`, `media.spec.ts` |
| M2 | 429 pause/resume only unit-tested | FIXED | `e2e-ratelimit/upload-rate-limit.spec.ts` against a real limiter |
| M3 | Media library had no drag-and-drop | FIXED | library dropzone; component test and `media.spec.ts` |
| M4 | Seeded demo images (1200×900, 800×1000) are below the minimum | INTENTIONALLY ACCEPTED | the rule applies to new attachments; replacing seed files would create new media rows on re-seed |
| M5 | Soft-deleted files stay attached to products | INTENTIONALLY ACCEPTED | gallery marks them "In trash"; `MEDIA_NOT_READY` blocks publishing |
| M6 | A cancel after all bytes were sent cannot be recalled | INTENTIONALLY ACCEPTED | cancel offered only while queued or sending |
| M7 | Oversized images are downscaled (`MAX_IMAGE_DIMENSION`), not refused | INTENTIONALLY ACCEPTED | backend behaviour; renditions stay bounded |
| M8 | The upload limiter keys on the network address (multipart bodies carry no identifier), so one office shares one allowance | INTENTIONALLY ACCEPTED | the queue waits for `Retry-After`; proven by M2 |
| R1 | Price windows opening/closing without a write | FIXED | `catalog-correctness.test.ts` "re-prices when a rule window opens and when it closes", `catalog-hardening.test.ts` collection and new-arrival windows |
| R2 | Visibility semantics differing between public paths | FIXED | "one visibility rule on every public path", `storefront-listing.test.ts` "never lists drafts, scheduled, hidden or deleted products", effective category visibility |
| R3 | Customer-group prices leaking between audiences | FIXED | "shows each audience its own price…", "shares one grid between identically priced shoppers and isolates every other audience", `pricing-engine.test.ts` tier of another group ignored |
| R4 | Cache invalidation (stale reads, multi-worker) | FIXED | `cache-invalidation.test.ts`, `cache-driver.test.ts` invalidation replay, `redis-integration.test.ts` cross-process |
| R5 | Product and CMS caches invalidated together | FIXED | "caches a CMS page per pricing audience…", CSV import and media writes invalidate only what they affect |
| R6 | Large-catalog behaviour | FIXED (measured) | scale baseline, §7 |
| S1 | Import upload and commit check the permission in the controller, after multipart parsing | INTENTIONALLY ACCEPTED (low) | caller is an authenticated admin, CSRF and `catalog-import` rate limit apply; the commit refuses before reading the job (backend test) |
| S2 | Four permission codes have no endpoint (`order.customer.block`, `order.customer.export`, `lead.enquiry.export`, `system.audit.export`); `order.order.export` is used inside `GET /reports` | NEEDS PRODUCT DECISION | roles may hold them; no UI is built for them |
| S3 | OpenAPI debt (172 routes) | OUT OF SCOPE | backend ratchet with a scheduled burn-down |
| B1 | Bundle headroom: `/pricing/price-rules` 279.7 KB and `/catalog/products` 279.5 KB of the 280 KB budget | STILL OPEN | the final UI phase must lazy-load new screens and dialogs; the budget gate fails the build otherwise |
| E1 | Business enquiries have no quote amount, no discussion history and no link to the resulting order | NEEDS PRODUCT DECISION | flow today: enquiry → assign → status CONTACTED/QUOTED with one note → the customer places a normal order |
| E2 | Orders console (P9) while order verification is limited | NEEDS PRODUCT DECISION | unchanged from ADMIN_ARCHITECTURE §15 |
| T1 | E2E runs leave soft-deleted, run-labelled rows in the local database (API deletes are soft) | INTENTIONALLY ACCEPTED | local only; `stack.ps1 reset` starts clean; no live E2E record remains |
| G1 | `.gitignore` pattern `coverage/` also hid `scripts/coverage/` (the coverage gate's source), so a clone could not run `coverage:check` or build | FIXED | pattern anchored to `/coverage/`; the sources are committed |
| G2 | With `core.autocrlf=true` a fresh clone checked out CRLF files and `format:check` failed | FIXED | `.gitattributes` (`* text=auto eol=lf`); every non-build `verify` step passed in a fresh clone (the build step cannot use a linked `node_modules`; it passed in the working copy) |
| D1 | Production values (origins, cookies, storage/CDN, trust proxy) | OUT OF SCOPE | no deployment in this phase (ADMIN_ARCHITECTURE §15) |

## 5. Remaining capabilities for the final UI phase

**Catalogue** (no backend change needed):

| Capability | Routes | Status |
| --- | --- | --- |
| Merchandising (featured, new arrival, special collection, best seller, badges; bulk "Set merchandising") | `POST /catalog/bulk` (built for other actions) with `SET_MERCHANDISING`; product `PATCH` fields | UI required, final UI phase |
| Related products (curated relations) | `PUT /catalog/products/{id}/relations` | final UI phase (P3) |
| Catalog settings (page sizes, out-of-stock policy, new-arrival window, badges) | `GET/PUT /catalog/settings` | final UI phase (P3) |
| Tier prices | `GET/POST/PATCH/DELETE /pricing/tier-prices` | final UI phase (P5) |
| Explain price, simulator, discount-rule test | `GET /pricing/explain/{id}`, `POST /pricing/simulate`, `POST /pricing/discount-rules/evaluate` | final UI phase (P5) |
| Price lists, discount rules, coupons, customer groups, delivery charges, pricing settings | 39 routes | final UI phase (P5) |
| Search insights, synonyms, reindex, popularity; collection re-evaluation; storage report | 12 routes | final UI phase (P6) |
| Attributes, brands, tax classes | built | component tests and real E2E added in this pass |

**Other areas:**

| Area | State |
| --- | --- |
| System (admin users, roles, audit log, status, account) | built (P0–P1) |
| Content (pages, banners, announcements, navigation, FAQs, help, testimonials, stores, settings) | 65 routes, 2 built, 63 final UI phase (P7) |
| Business enquiries | list and detail built; status, assignment and note (`PATCH /enquiries/{id}`, assignee picker) final UI phase (P8); E1 above |
| Carts and wishlists | 6 routes, final UI phase (P8) |
| Customers | no directory (F9); customer groups by id (P5); a cart by customer id (P8) |
| Orders (limited) | 19 routes, P9, needs sign-off (E2) |
| On hold | 35 routes hidden, classified `hold:*`; the coverage gate fails if the UI calls one; System status shows each integration's state from `GET /api/v1/version` |

Catalogue bulk actions (`POST /catalog/bulk`) are unrelated to business bulk orders: those arrive
as enquiries and never become orders inside the admin.

## 6. Security and data integrity of admin mutations

211 admin mutations (every one listed in ADMIN_CAPABILITY_MATRIX §5):

- CSRF: 207; the 4 without are the public sign-in, refresh and password-reset pair.
- Permission: 201 guarded on the route, 2 checked in the controller (imports, S1); the other 8 act
  on the caller's own session or account. Generation fails if an unexplained unguarded mutation appears.
- Validation: 202 have a request schema; POST/PUT/PATCH without a body schema are multipart uploads
  or path-only actions (listed).
- Versioned updates (409 on a stale version): 25; verified end to end for brands (`taxonomy.spec.ts`).
- Idempotency-Key: 18; rate limited: 16.
- The admin never sends `force=true` on media deletion, never calls an on-hold route, and keeps no
  token in script-readable storage (fake-API E2E).

## 7. Performance

- Lists are paginated by the API; search inputs are debounced; query stale times come from
  `cachePolicy`; dialogs, editors and the media stack are separate lazy chunks.
- Budgets: every page ≤ 280 KB JS gzip (largest 279.7 KB, B1), shared 200.5 KB.
- A signed-out visitor makes no API request at all (`e2e/auth.spec.ts`).
- Backend scale baseline, 3000 products in one category (test database): admin product list 31 ms
  (8 queries), deep price-sorted admin page 34 ms (10), admin variants 11 ms (5); storefront listing
  page 1 127 ms (39), page 60 106 ms (33), price-sorted 94 ms, filters 52 ms, product detail 101 ms
  (51), category tree 14 ms.

## 8. Readiness for the final admin UI phase

Ready, with the conditions above: contracts are pinned to a clean backend commit with no drift,
every route is classified, the remaining UI work is enumerated route by route, backend gaps found in
this pass are closed and committed, and every gate is green. Before or during the final UI phase:
decide F14-db for already-seeded databases, E1/E2/F9/S2 (product decisions), and keep new screens
within the bundle budget (B1). The backend commits are local and still need review and a push by
the owner.
