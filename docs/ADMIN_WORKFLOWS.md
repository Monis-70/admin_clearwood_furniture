# ClearWood Admin — Workflows

Each workflow lists who can run it, the steps an operator sees, the API calls in order, and the
backend rules the screen must explain. Paths are relative to `/api/v1/admin` unless they start with
`/api/v1` or `/`. Error codes are the backend's own (catalogue in
[ADMIN_STATE_AND_ERROR_MODEL.md](ADMIN_STATE_AND_ERROR_MODEL.md)).

---

## A. Access and session

### A1 Sign in
- **Screen** `/login`: email, password, "Keep this device name" (sends `deviceLabel`, max 80,
  default "<Browser> on <OS>").
- **API** `POST /auth/login` → `AdminMe` (+ `tokens`, ignored). Cookies are set by the response.
- **Outcomes**
  - `mustChangePassword: true` → `/change-password` (every other admin route answers
    `403 PASSWORD_CHANGE_REQUIRED` until then).
  - otherwise → `next` (same-origin relative path only) or `/`.
  - `401 INVALID_CREDENTIALS` → "Email or password is incorrect." (identical for unknown, disabled,
    suspended and invited accounts — by design).
  - `401 ACCOUNT_LOCKED` + `details.lockedUntil` → "Too many failed attempts. You can try again at
    15:42 IST." (`LOGIN_MAX_ATTEMPTS` failures lock for `LOGIN_LOCK_MINUTES`; defaults 5 and 15).
  - `429 RATE_LIMITED` → "Too many attempts from this network. Wait a minute." (admin-login limiter).
- **Forgot password?** is an explanation, not a form: email reset is on hold, so a Super Admin (or
  anyone allowed to manage the account) sets a temporary password from Admin users (B6); the
  owner must replace it at next sign-in. Built in Phase 0.

### A2 Forced password change
- **Screen** `/change-password` (reachable only with a pending-change session).
- Fields: current password, new password, confirm. Hints mirror the server policy: at least
  `PASSWORD_MIN_LENGTH` characters (shared schema floor 10; the server may require more), not a
  common password, not your email or phone, not one repeated character, different from the current
  one.
- **API** `POST /auth/change-password` → then `GET /auth/me`.
- `401 INVALID_CREDENTIALS` here means **wrong current password** (field error; never a sign-out).
  `422` with `details.issues[]` → list every policy issue under the field.
- Success: "Password changed. Other devices were signed out." → dashboard.

### A3 Silent session renewal
- Access cookie lifetime `ADMIN_ACCESS_TOKEN_TTL` (default 15 min), refresh `ADMIN_REFRESH_TOKEN_TTL`
  (default 7 days).
- On `401 TOKEN_EXPIRED` or `401 NOT_AUTHENTICATED` from any non-auth call: take the cross-tab lock,
  replay the request once, else `POST /auth/refresh` (empty body), update the session from the
  response, replay. Refresh failure → sign-out flow A5 with reason "Your session ended".
- `401 TOKEN_REUSE` → "For your safety this session was ended because it was used from two places.
  Please sign in again."

### A4 Permissions changed while signed in
- A Super Admin changes your roles → your next call gets `401 TOKEN_EXPIRED` → renewal returns the
  new permission list → navigation updates and a toast says "Your access changed." If the current
  page is no longer permitted, it switches to the no-access state.

### A5 Sign out, sign out everywhere, end a session
- User menu → **Sign out**: `POST /auth/logout` → clear query cache → broadcast to other tabs →
  `/login`.
- `/account` → **Sessions**: `GET /auth/sessions` (device, IP, last used, current). **End session**:
  `DELETE /auth/sessions/{id}` (confirm). **Sign out everywhere**: `POST /auth/logout-all` (confirm;
  signs this device out too).
- Account suspended/disabled by someone else → the next renewal fails with `ACCOUNT_DISABLED` →
  "Your account is no longer active."

---

## B. Administration

### B1 Add an admin (`system.user.create`)
1. `/system/users` → **Add admin**: name, email, phone (optional, Indian mobile), roles (seeded or
   active custom roles; roles the actor cannot grant are disabled with "You can't give a role with
   permissions you don't have"), temporary password (required; **Generate** creates a strong one and
   offers Copy).
2. `POST /users` → 201 `AdminUserDto` with `mustChangePassword: true`.
3. Success panel: "Share the temporary password securely. They must choose their own password the
   first time they sign in."
- Errors: `409 CONFLICT` email exists; `403 ROLE_NOT_GRANTABLE`; `422` password policy, unknown or
  inactive role.
- The invite-by-email path (no password) is not offered: SMTP is on hold.

### B2 Change an admin's roles (`system.user.update` + `system.role.read` → SUPER_ADMIN only)
- **Change roles** → pick roles (seeded or active custom) → `POST /users/{id}/roles`. Copy: "Their
  access changes on their next click; they stay signed in."
- `403 LAST_SUPER_ADMIN`, `403 ADMIN_USER_NOT_MANAGEABLE`, `403 ROLE_NOT_GRANTABLE`, `422` inactive
  role shown verbatim with a plain explanation.

### B3 Suspend, disable, reactivate (`system.user.update`)
- `PATCH /users/{id}` `{ status }`. Suspend/Disable confirm: "They are signed out everywhere
  immediately." Reactivate has no confirm. The last active SUPER_ADMIN cannot be suspended/disabled.

### B4 Delete an admin (`system.user.delete` → SUPER_ADMIN)
- Typed confirmation (their email). `DELETE /users/{id}`. Not available on your own row. No restore.

### B5 Review activity (`system.audit.read`)
- `/system/audit-log`: filters actor, action, entity, entity id, severity, realm, date range →
  `GET /audit-logs`. Rows open a drawer with `changes` (before/after diff) and `meta`. Every entity
  editor has a **History** tab = the same query pre-filtered by `entity` + `entityId`.

### B6 Reset another admin's password (`system.user.update`; backend b5861fd)
- **Reset password** on a manageable admin (never on your own row: use My account) → temporary
  password with **Generate** + Copy → irreversible confirmation: "All of their sessions end now and
  they must choose a new password when they next sign in." → `POST /users/{id}/password`.
- Only someone holding every permission the target holds may do it, so a SUPER_ADMIN only by a
  SUPER_ADMIN (`403 ADMIN_USER_NOT_MANAGEABLE`); audited as CRITICAL.

### B7 Custom roles (`system.role.create|update|delete`; backend b5861fd)
- `/system/roles` → **New role**: code (UPPER_SNAKE), name, description, permissions grouped by area
  (dangerous ones flagged); only permissions you hold can be granted (`ROLE_NOT_GRANTABLE`).
- **Edit**: grants loaded from `GET /roles/{id}`; the full set is sent with `PATCH /roles/{id}`; a
  system role cannot be deactivated; a role carrying permissions you lack cannot be changed.
- **Delete**: custom roles only, and only when no admin holds them (409 otherwise).

---

## C. Catalog

### C0 As built in Phase 2 (backend `3a81325`)

Where the screens differ from the plan below, this is what they do now. Every step is tested
against the real local API (`e2e-real/catalog*.spec.ts`).

- **Workbench** beside the product, category and collection editors: state badges, completeness
  factors (each links to the tab that fixes it), live publish blockers from
  `GET /catalog/products/{id}/publish-blockers` with **Fix this**, next actions (only those the
  admin may perform), related counts, facts and recent activity (`system.audit.read` only).
- **Products** (`/catalog/products`): search, filters (status, publication, stock, images,
  completeness, visibility, made to order, customisable, deleted) kept in the URL; row menu (Open,
  Publishing checklist, Publish/Unpublish, Restore, Move to trash…); page selection → bulk actions
  through `POST /catalog/bulk` (Publish, Unpublish, Set back to draft, category, collection, brand,
  tax class, Restore, Move to trash) with a per-product result summary that stays until closed.
- **New product** (`/catalog/products/new`): name, SKU, URL slug, product type, base price, primary
  category → **Create draft** (Idempotency-Key) → editor.
- **Editor sections**, each saving on its own with the loaded `version` (a stale save opens
  "Someone else changed this record": **Compare** lists your value against theirs for every field
  you sent, **Reload latest** discards yours): General (+ categories), Pricing (+ the product's
  price rules), Inventory (stock per variant → Adjust), Specifications, Variants, Media,
  Fulfilment, SEO (+ old addresses), Publishing (checklist, Publish now, Schedule, Unpublish),
  History. **More** → Duplicate…, Move to trash….
- **Variants**: **Generate combinations** → tick option values → **Preview combinations** (new /
  already exist, SKUs) → **Create N variants**; **Add variant** refuses an existing combination
  ("That combination already exists"); row menu: Set as default, Move up/down, Edit, Delete….
- **Categories**: tree / search list / including deleted; **New category** (name, parent, kind);
  row menu Open, Add subcategory, Move up/down, Move to another parent…, Activate/Deactivate,
  Delete… (strategy + server impact preview + typed name). The editor is a sheet with the
  workbench and tabs Details, Attributes, Products (curated order), Old addresses.
- **Stock**: low-stock queue (made-to-order and trashed products excluded by the API), variant
  stock page with the ledger, **Adjust stock…** (add / remove / set to, reason, note) showing the
  exact before → after and sending `expectedBalance`; bulk adjust by selected rows or SKU lines.
- **Collections**: manual (add by search, move up/down, **Save this order**, remove) or rule-based
  (rule builder, preview, re-evaluate); workbench with Delete….
- **Media**: library (upload queue with per-file progress, folders, filters, selection → Move to
  trash…) and the product **Media & Gallery** section (C6).
- **Price rules** (E1) and **Tax & GST** classes (E8) are built; opening "New price rule" from a
  product's rules targets that product. Other pricing areas stay for Phase 5.
- **Import & export** (F): Download (export or empty template), Import (**Check file** → rows with
  errors or "Checked: ready to apply" → **Apply N rows**; after a reload the same file must be
  attached again; a different file is refused with the API's message). No polling.
- Not built in Phase 2: merchandising (C9, Phase 4), catalog settings (C10), related products,
  tier prices and "Explain price".

### C1 Build the category tree (`catalog.category.*`)
1. `/catalog/categories` loads `GET /catalog/categories/tree` (flat list → tree client-side;
   inactive shown dimmed; soft-deleted rows are not returned).
2. **Add category** → name (slug auto-generated, editable, lowercase-dashes), parent, kind (each
   explained; *Service* = enquiry form instead of products and needs a lead form key such as
   `contract-work`), active, show in menu, menu column (1–12), featured, short/long description,
   icon/banner/mobile banner via MediaPicker, SEO fields → `POST /catalog/categories` with an
   `Idempotency-Key`.
3. **Move / reorder** by drag: new parent → `POST /catalog/categories/{id}/move` `{parentId, position, version}`;
   same parent → `POST /catalog/categories/reorder` `{items:[{id, position}]}`. The tree updates
   optimistically and rolls back on error.
4. **Edit** in the side panel → `PATCH /catalog/categories/{id}` with dirty fields + `version`.
   Deactivating warns: "Hides this category, its N sub-categories and their products from the
   storefront, menus and search. Nothing is deleted."
- Rules to surface: a category holding products cannot become *Service* (`409 CATEGORY_HAS_PRODUCTS`);
  cannot restore under a deleted parent (`409 CATEGORY_PARENT_DELETED`); a slug rename creates a
  permanent redirect (Redirects panel: `GET /catalog/categories/{id}/redirects`).

### C2 Delete a category
1. **Delete…** opens a dialog with the four strategies in plain words. Selecting one calls
   `GET /catalog/categories/{id}/delete-impact?strategy=` and shows children, descendants, products
   and whether it is blocked (`blockReason`).
2. Confirm → `DELETE /catalog/categories/{id}?strategy=` (CASCADE_SOFT requires typing the category
   name). `409 CATEGORY_IN_USE` explains what blocks it.
3. **Recently deleted** (needs `system.audit.read`): built from `GET /audit-logs?entity=Category&action=DELETE`
   → **Restore** `POST /catalog/categories/{id}/restore` (the paginated trash list is unreachable —
   backend F1).

### C3 Attributes and values (`catalog.attribute.*`)
- `/catalog/attributes`: groups panel (`/catalog/attribute-groups`), attribute table
  (`GET /catalog/attributes`, filters: group, variant-defining, filterable).
- Attribute editor: code (UPPER_SNAKE, immutable after use), name, group, input type (select, multi,
  colour swatch, image swatch, text, textarea, number, yes/no), data type, unit, flags (variant-defining,
  filterable, searchable, required, comparable, show as swatch), help text → create/`PATCH` with version.
- Values: code, label, description, colour hex or swatch image, numeric value, order →
  `POST /catalog/attributes/{id}/values`, `PATCH /catalog/attribute-values/{valueId}` (version),
  reorder, delete (`409 ATTRIBUTE_IN_USE` lists where it is used).
- Category links: category editor → Attributes tab → attach with per-category overrides
  (`POST /catalog/categories/{id}/attributes`). The admin endpoint returns direct links only;
  inherited attributes come from ancestors, shown read-only by walking the tree.

### C4 Create a product and take it live (`catalog.product.create`, `.update`, `.publish`)
1. `/catalog/products/new`: SKU, name, product type, visibility, brand, tax class, base price (₹ →
   paise), compare-at and cost price, primary category + extra categories (Service categories are
   excluded — `422 CATEGORY_NOT_PURCHASABLE`), made-to-order + lead time, customisation allowed,
   in-house manufacturing note, warranty, care, dimensions (mm) and weight (g), min/max order qty →
   `POST /catalog/products` (Idempotency-Key) → redirect to `/catalog/products/edit?id=…`. The
   product starts as **Draft**.
2. Editor tabs, each saving independently:
   - **Overview** → `PATCH /catalog/products/{id}` (dirty fields + version).
   - **Categories** → `PUT /catalog/products/{id}/categories`.
   - **Specifications** → `PUT /catalog/products/{id}/attribute-values`. When the live publish
     blockers include `INVALID_CATEGORY_ATTRIBUTES`, the specifications it names
     (`details.attributeIds`) are listed in a warning and marked "Not in the primary category"; the
     fix is to remove them or to link the attribute to the category (or an ancestor).
   - **Variants** → C5.
   - **Media** → C6.
   - **Pricing** → price rules scoped to this product (`GET /catalog/price-adjustments?productId=`),
     tier prices, and **Explain price** (`GET /pricing/explain/{id}`).
   - **Merchandising** → featured (+ until), new arrival, special collection, best seller, badge text
     and colour (PATCH).
   - **Related** → `PUT /catalog/products/{id}/relations` (types RELATED, SIMILAR [mirrored],
     ALTERNATIVE, REPLACEMENT, COMPLEMENTARY, FREQUENTLY_BOUGHT, CROSS_SELL, UPSELL, BUNDLE_ITEM,
     VARIANT_OF_STYLE; no self-relations, no duplicates per type, no deleted products).
   - **SEO & search** → SEO fields, redirects, "What search sees"
     (`GET /catalog/products/{id}/search-document`), meta preview (`GET /seo/preview/PRODUCT/{id}`,
     needs `cms.page.read`).
   - **Publishing** → readiness checklist from `GET /catalog/products/{id}/publish-blockers` and the
     completeness score; **Publish now** or **Schedule** (`POST …/publish` with optional `publishAt`);
     `422 PRODUCT_NOT_PUBLISHABLE` lists every blocker at once; **Unpublish** → `POST …/unpublish`.
   - **History** → audit entries for the product.
3. **Duplicate** (`POST …/duplicate`, choose what to copy) and **Delete** (soft; restorable from the
   Deleted filter via `POST …/restore`).

### C5 Variants
- Variant-defining attributes are those flagged globally or linked as variant-defining on the
  primary category; siblings must use the same attributes (`422 ATTRIBUTE_NOT_VARIANT_DEFINING`,
  `VARIANT_OPTIONS_INCONSISTENT`).
- **Generate variants**: choose attributes (≤5) and values → `POST …/variants/matrix/preview` shows
  total, new, existing, orphaned combinations and generated SKUs (pattern `{PRODUCT_SKU}-{INDEX}` by
  default) → **Create N variants** → `POST …/variants/matrix/generate` (Idempotency-Key).
  `422 VARIANT_MATRIX_TOO_LARGE` above `VARIANT_MATRIX_MAX` (default 200).
- Single variant: add (`409 VARIANT_COMBINATION_EXISTS`), edit (version), set default (exactly one),
  reorder, delete (`409 VARIANT_RESERVED` while stock is reserved).
- Opening stock at creation goes through the ledger (`openingStock`); later changes use C7.

### C6 Product gallery (Media & Gallery section, as built)
- "These are the images customers will see." A status line (primary set / no primary image, image
  count against the API's "three or more" factor, variant-specific images, images processing or in
  the trash) sits above two entry points: **Upload new images** (drop zone + native multi-file input;
  a phone opens its photo picker) and **Select from media library** (multi-select; images already in
  this gallery are shown but cannot be chosen; files are linked, never copied).
- Uploads: limits and types from `GET /media/config`; obvious refusals (type, size, empty) are
  listed before sending; each file is its own `POST /media/upload` (XHR, real byte progress), two at
  a time, in the chosen order; per-file Cancel (while queued or sending), Retry (network or server
  failures), Remove (finished rows); "3 uploaded successfully / 1 failed" with the API's reason. A
  `429` puts the file back in line and pauses the queue for `Retry-After` ("Uploading resumes in N
  s"). Leaving the page while uploads run asks first.
- Each finished upload is attached with its own `POST /products/{productId}/media` in the chosen
  order (a file still uploading holds back the ones after it; failed ones are skipped); the first
  image becomes Primary when the product has none. A file the library already had ("This image is
  already in your media library.") waits for **Use existing image**; `409` reads "Already in this
  gallery".
- Editing is staged until **Save gallery** (Discard reverts; leaving asks first): drag by the handle
  or Move earlier/later/first/last, **Make primary** (the old primary shows as Gallery), alt text on
  the card, and **Details** (sheet): focal point (click or percentages), alt text on this product,
  title in the media library, role, **Shown for** (all variants / one variant of this product / one
  option value its variants use), device. Save sends `PATCH /media/{id}` for file fields, `PATCH
  …/media/{id}` per changed item (a promotion to Primary last) and one `PATCH …/media/reorder`.
- **Preview** (large rendition, previous/next and arrow keys, zoom, position, role, scope, alt text,
  file facts). **What customers see** (live products only) asks the storefront's
  `GET /catalog/products/{slug}/gallery` for a chosen variant and device.
- **Remove from this product…** → `DELETE …/media/{id}` (the file stays in the library). **Delete
  media file…** lists every usage from `GET /media/{id}`, then offers **Move file to trash**
  (`DELETE /media/{id}`; restorable, and the card offers **Restore file**) or **Delete permanently…**
  (typed DELETE → `DELETE /media/{id}/permanent`; the API refuses with `409 MEDIA_IN_USE` while
  anything uses the file, shown in the dialog).
- The workbench shows a **Media** block ("Primary image configured" / "No primary image — Add
  primary image", count, processing) and the Publishing tab a media checklist with **Add image**
  links; both read the API's completeness factors and publish blockers.

### C7 Stock (`catalog.inventory.*`)
- `/catalog/inventory`: low-stock queue (`GET /catalog/inventory/low-stock`, threshold filter).
- Variant stock card: `GET /catalog/variants/{id}/inventory/snapshot` (on hand, reserved, available)
  + ledger (`GET …/inventory`, reason filter).
- **Adjust**: add/remove (`delta`) or set to (`absolute`), reason (manual adjustment, initial stock,
  purchase, production, return, damage, correction, cancellation), note →
  `POST …/inventory/adjust` with `expectedBalance` = the on-hand value shown and an
  Idempotency-Key. `409 INVENTORY_CONFLICT` → "Stock changed while you were editing" + reload.
  Reserved stock cannot be undercut (`409 STOCK_BELOW_RESERVED`).
- **Bulk adjust** (≤1,000 lines by variant id or SKU) → `POST /catalog/inventory/bulk-adjust`;
  per-line results shown.

### C8 Collections (`catalog.collection.*`)
- **Manual**: pick products (product search) → `PUT /catalog/collections/{id}/products`, drag order →
  `POST …/products/reorder`.
- **Automatic**: rule builder (match ALL/ANY; groups of rules; fields such as category, category path,
  brand, price, attribute value, flags, stock status; operators equals, between, in, contains…) →
  **Preview** `POST /collections/rules/preview` (matched count + sample) → save → **Refresh
  membership** `POST /collections/{id}/evaluate`. The backend also re-evaluates on schedule.
- Date window (`startsAt`/`endsAt`), active flag, images/banners; delete → Trash; restore from
  Trash (`GET /catalog/collections?includeDeleted=true`, `POST …/restore`).

### C9 Merchandising
- `/catalog/merchandising`: product list presets (Featured, New arrivals, Special collection, Best
  sellers) using the list filters; select rows → **Set merchandising** → `POST /catalog/bulk`
  `{action: SET_MERCHANDISING, ids, merchandising:{…}}` with per-product results.
- Links to Catalog settings (badges, new-arrival days) and to category curated order.
- New arrivals = flagged products plus products published within `newArrivalDays` (0 = flag only).

### C10 Catalog settings
- `GET/PUT /catalog/settings`: default/max page size (default ≤ max), show out-of-stock products,
  new-arrival days (0–365), badges per code (label + colour; clear to switch one off). The form sends
  only changed fields (the schema requires at least one).

---

## D. Media

### D1 Upload
1. Browse or drop files, in the media library and in a product gallery. Limits come from
   `GET /media/config` (`maxUploadSizeMb`, `maxUploadFiles` per selection, allowed types,
   `minProductImageDimension`).
2. Client pre-check (UX only): type and size; rejected files are listed with the reason. In a
   product gallery a JPEG/PNG/WebP/AVIF whose shortest side is below `minProductImageDimension`
   (1024 px by default) is refused before it is sent, with its measured size; the picker shows such
   library images as "Too small" and does not offer them. The API enforces the same rule on attach
   (`422 IMAGE_TOO_SMALL`); uploads to the library itself (icons, swatches, logos) have no minimum.
3. Files are sent **one per request** (the API validates a multipart batch as a whole, so one bad
   file would fail its neighbours), two at a time, to `POST /media/upload` (multipart `files`,
   optional folder) with XHR byte progress. The endpoint allows 10 requests/minute per network in
   production: a `429` pauses the queue for `Retry-After` and resumes on its own.
4. Result per file: new, **Already in library** (deduplicated by checksum), or failed:
   `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_FILE_TYPE` "The file's contents are not a supported
   type", `422 UNSAFE_SVG`, network/server failures (retryable).

### D2 Edit, organise, replace
- Asset drawer (`GET /media/{id}`): preview, renditions with sizes, **Used by** list, alt text,
  title, tags, focal point (click on image; stored in basis points), folder → `PATCH /media/{id}`.
- Folders: create, rename/move, delete (empty and non-system only).
- **Replace file** (`POST /media/{id}/replace`) warns: "Every page using this image will show the new
  file."
- **Regenerate sizes** (`POST /media/{id}/reprocess`).

### D3 Delete
- **Move to trash** (single or up to 100) → restorable. In **Trash**: **Restore**, or **Delete
  permanently** → `DELETE /media/{id}/permanent`; `409 MEDIA_IN_USE` is shown as "Image still in
  use". The admin never sends `force=true` (detach everywhere); a file is removed from its products
  first (C6).

---

## E. Pricing & promotions

Copy on every pricing screen: *"Previews are calculated by the server. The storefront always
recalculates prices; nothing here changes an order already placed."*

- **E1 Price rules** — scope (global, category, product, variant, attribute value, customisation),
  type (fixed amount, percent, per unit, multiplier), basis (base or running subtotal), value (₹ or
  %), priority, quantity range, date window, active. Conflicts panel
  (`GET /catalog/price-adjustments/conflicts`).
- **E2 Tier prices** — product or variant, optional customer group, minimum quantity, **either** a
  price **or** a discount %.
- **E3 Price lists** — code, customer group, channel, priority, window; items editor (product/variant,
  min qty, price) saved as a whole (`PUT …/items`, ≤2,000 rows).
- **E4 Automatic discounts** — conditions (whitelisted fields/operators) and actions (percent, fixed,
  free shipping, cap), priority, stop further rules, window, usage limit; **Test** against a sample
  cart (`POST /pricing/discount-rules/evaluate`).
- **E5 Coupons** — code, type (percent, fixed, free shipping, tiered), value, minimum subtotal, cap,
  usage and per-customer limits, window, stackable, auto-apply, first order only, applies to
  (products, variants, categories, collections, customer groups, exclusions), terms; activate /
  deactivate via PATCH; redemptions tab; **Generate codes** (≤500 from a template, prefix).
- **E6 Customer groups** — code, name, default, priority, group discount %; members added/removed by
  customer id (no customer search API — ids are copied from Carts).
- **E7 Simulator** — build a cart (products, options, qty), coupon, pincode, channel, shipping
  method, optional customer group/customer and "price as of" date → `POST /pricing/simulate`; the
  result shows the component waterfall (base, adjustments, discounts, coupon, shipping, tax,
  rounding) and the rule trace.
- **E8 Tax & GST** — tax classes (code, name, rate %, HSN, default); pricing settings (prices include
  tax, seller state, default place of supply, shipping taxable + class, round to rupee, free shipping
  threshold, minimum order value, savings badge).
- **E9 Delivery charges** — zones → rates (method, condition by price/weight/items, ranges, base/per
  unit, free above, ETA days) → serviceable pincodes (single, ranges, CSV import). Label: *"Used to
  price delivery at checkout. It does not book couriers."*

---

## F. Import & export (`catalog.product.import` / `.export` + entity permissions)

| Step | Screen | API |
| --- | --- | --- |
| 1 Select what | entity cards the admin may import (Products, Variants, Categories, Attribute values, Price rules, Stock) | — |
| 2 Template | **Download template** | `GET /catalog/import/templates/{entity}` |
| 3 Upload | choose a CSV (≤ `IMPORT_MAX_ROWS`, default 20,000); the client stores its SHA-256 | — |
| 4 Validate | **Check file** (dry run; writes nothing) | `POST /catalog/import/{entity}` multipart `files`, `dryRun=true` |
| 5 Show errors | table of `errors[]` (row, column, message), counts, summary; download errors as CSV (client-side) | response `ImportJob` |
| 6 Preview | totals to create/update from `summary` | — |
| 7 Commit | **Import N rows** — enabled only when status is VALIDATED; the same file must be re-selected (the API compares its sha256 and answers `409 IMPORT_FILE_MISMATCH` otherwise, since b5861fd); typed confirmation for > 500 rows | `POST /catalog/import/jobs/{id}/commit` multipart `files` + Idempotency-Key |
| 8 Result | success/error rows; link to affected list | response `ImportJob` |
| 9 History | jobs by entity/status | `GET /catalog/import/jobs`, `GET …/jobs/{id}` |

Irreversibility copy: *"Import updates existing records matched by SKU, slug or code and creates new
ones. It cannot be undone automatically — export first if you may need to roll back."* Export:
`GET /catalog/export/{entity}` with filters (search, category, status, brand, include deleted,
limit), downloaded as a file; spreadsheet formulas are neutralised by the server.

---

## G. Search

- **G1 Insights** — `GET /search/analytics?days=` (top queries, zero-result queries, CTR, trend).
  Each zero-result query offers **Create synonym** (pre-filled).
- **G2 Synonyms** — term + synonyms list; create/edit/delete; optional live test with the public
  search endpoint.
- **G3 Index** — **Rebuild index** (entity type or all; full or incremental) →
  `POST /search/reindex` → job progress polled via `GET /search/jobs/{id}` while the page is visible;
  job history; **Recompute popularity**.

---

## H. Content

- **H1 Page lifecycle** — create (slug, title, type, template, excerpt, hero/OG image, SEO,
  canonical, no-index) → build blocks → **Preview** (draft render, data view) → **Publish**
  (`422 PAGE_NOT_PUBLISHABLE` lists every blocker, e.g. `BLOCK_REFERENCE_MISSING`) or **Schedule**
  (start, optional expiry) → **Unpublish**. Duplicate with new slug/title. Delete (no restore).
- **H2 Block builder** — palette from `GET /cms/block-types` (22 types, categories Hero, Commerce,
  Content, Social, Layout; `maxPerPage` enforced); each block has a typed form generated from the
  shared `blockRegistry` config schema (draft-tolerant) and is checked against the stricter publish
  schema before publishing; device visibility, schedule window, anchor id; add/edit/remove/reorder.
  `RICH_TEXT` and `CUSTOM_HTML` are sanitised by the server; the admin previews them only inside a
  sandboxed iframe and edits `CUSTOM_HTML` as plain text.
- **H3 Revisions** — list; **Restore this version** writes a new revision (history never shrinks).
- **H4 Banners** — placement (home hero, home strip, category top, PDP sidebar, cart promo,
  checkout, announcement bar, popup, footer), desktop/mobile image, texts, CTA (relative or https
  URL only), colours, window, device, targeting categories/collections; reorder; impressions/clicks.
- **H5 Announcement bars** — message, link, colours, dismissible, window, device, order.
- **H6 Navigation** — five menus (Main, Footer primary, Footer secondary, Mobile, Top bar); item types
  Category, Collection, Page, URL, Lead form; the server verifies targets (live category/collection,
  published page, relative/https URL; no `//host`), depth ≤ 3, badges, highlight, new tab; drag to
  reorder. Deleting an item with children is refused (`409 NAVIGATION_HAS_CHILDREN`).
- **H7 FAQs** — categories + questions (visibility: global, product, category, order, shipping,
  payment, warranty, care; targeting products/categories); reorder.
- **H8 Help centre** — category tree + Markdown articles (draft/published/archived, related
  articles, SEO); reorder.
- **H9 Testimonials, store locations** — CRUD + reorder; stores include address, state code,
  pincode, map link, coordinates, opening hours, images, flagship.
- **H10 Site & SEO settings** (`system.setting.*`) — the 20 whitelisted keys (contact phone,
  WhatsApp number, support email, address, GSTIN display, five social links, business hours,
  announcement/newsletter toggles, USP lines, title template, default description, default OG image,
  robots extra, Google site verification, allowed iframe hosts). **Rebuild sitemap** on the Pages
  toolbar and here.

---

## I. Enquiries (`lead.enquiry.*`)

1. Queue: `GET /enquiries` with status tabs (New, Contacted, Quoted, Closed, Spam), form, category,
   assignee, search.
2. Drawer: contact details, form answers (`details`), budget (₹), quantity, source category/product,
   internal note, history.
3. Actions (`PATCH /enquiries/{id}` with version): move status; assign (needs
   `lead.enquiry.assign`; the picker lists eligible admins from `GET /enquiries/assignees`, which
   needs the same permission and no `system.user.read`); internal note.
   `409 STALE_RESOURCE` if a colleague changed it.
- Copy: *"Enquiries are requests, not orders — nothing is priced, reserved or charged. Email alerts
  are not active yet, so check this queue regularly."*

## J. Carts & wishlists (`order.customer.*`)

- Carts table with filters (status, has customer, abandoned, minimum value, updated since, search);
  stats header; cart drawer with event timeline and a live re-quote (current prices, not the stored
  snapshot); customer cart lookup by id; wishlist insights.
- **Run cart cleanup** (`POST /carts/cleanup`, optional thresholds) — confirm: "Marks idle carts as
  abandoned and expires old guest/customer carts. Expired carts cannot be recovered."

## K. Orders console (P9 — only if approved)

- Permanent banner: *"Online payments, refunds, returns and courier booking are not active. Orders
  here are cash-on-delivery or manual."*
- Orders list and detail; **Change status** (backend enforces allowed transitions; refusals show the
  allowed next states from `details.allowed`); **Cancel** (reason, note; typed confirmation).
- Fulfilment: **Create manual shipment** (`manual: true`; over-shipping refused), **Record docket
  number** (`manualAwb`, courier name), **Update status** by hand, **Cancel shipment**; failed-delivery
  decisions (reattempt, return, contact buyer).
- Documents: **Issue GST invoice** (once, never regenerated; confirm), download PDFs.
- Notification log (read-only; shows SKIPPED because delivery is on hold). Reports: sales, GST/HSN
  and top products for admins holding `order.order.export`; inventory movement for
  `catalog.inventory.read` (per-kind permissions since b5861fd). Refund and split-payout reports stay
  hidden (on hold).

## L. System status (any admin)

- API health (`/health`, `/ready` incl. `degraded` when Redis is down), version and active drivers
  (`/api/v1/version`), the on-hold integrations table, and maintenance actions shown only with the
  permission: **Storage check** (`GET /media/gc`, read-only report), **Refresh all automatic
  collections** (`POST /collections/evaluate-all`), **Recompute search popularity**.
