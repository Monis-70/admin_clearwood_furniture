# ClearWood Admin — State & Error Model

## 1. Where state lives

| Kind | Owner | Examples | Persistence |
| --- | --- | --- | --- |
| Server state | TanStack Query | lists, details, reference data | memory only; cleared on sign-out |
| Session | `SessionProvider` (React context) | user, roles, permission set, mustChangePassword | memory only; rebuilt from `/auth/me` or refresh responses |
| URL state | Next router search params | filters, page, sort, selected `id`, `tab` | the URL (shareable) |
| Form state | React Hook Form | dirty fields, validation | component; guarded by `UnsavedChangesGuard` |
| UI preferences | `localStorage` | sidebar collapsed, table column visibility/density | device; **never** auth data or business data |
| Cross-tab | `BroadcastChannel('cw-admin')` + Web Locks | signed-in/out, session-updated, refresh lock | ephemeral |

No token, permission list or entity data is written to browser storage.

## 2. Query keys and cache policy

Keys: `[module, entity, scope, params?]` built by per-module factories, e.g.
`catalogKeys.products.list(params)`, `catalogKeys.products.detail(id)`.

| Data | Examples | `staleTime` | Notes |
| --- | --- | --- | --- |
| Session | `/auth/me` | 5 min, and on every refresh response | revalidated after unexpected 403 |
| Reference | category tree, attribute groups/attributes, brands, tax classes, media config, permissions registry, block types, navigation menus list | 5 min | shared by pickers; invalidated by their own mutations |
| Lists | products, media, enquiries, coupons, audit | 30 s | `placeholderData: keepPreviousData`; no refetch on focus |
| Details | product, page, collection, enquiry | 60 s | replaced from mutation responses |
| Heavy/diagnostic | search analytics, cart stats, low stock, storage check | 5 min / manual | storage check never automatic |
| Job progress | reindex job | poll 5 s → 15 s backoff while visible; stop on COMPLETED/FAILED | only justified polling |

Global defaults (implemented in `src/lib/query/query-client.ts` and `policies.ts`):
`refetchOnWindowFocus: true` (it only refetches data that is already stale, so a list older than
30 s refreshes when the operator comes back, reference data rarely does), switched off for config,
probes and diagnostics; `refetchOnReconnect: true`; `retry`: 1 for GET on network errors, timeouts
and 502/503/504 only, never for 4xx or 429; mutations `retry: 0`. Queries pause while offline.

## 3. Invalidation map

| Mutation | Invalidate / update |
| --- | --- |
| Category create/update/move/reorder/delete/restore/bulk | category tree; that category's detail; product lists (category filter labels) |
| Category attribute attach/detach | that category's attributes |
| Curated product reorder | that category's products list |
| Attribute / value / group changes | attributes list + detail; attribute groups |
| Product create/duplicate | products lists; navigate to detail |
| Product update/publish/unpublish/categories/specs/relations/restore | write detail from the response; products lists; publish blockers |
| Product delete | products lists; remove detail |
| Bulk action | products lists; details of the ids that succeeded |
| Variant changes / matrix generate | product detail (variants), variants list, inventory queries of those variants |
| Stock adjust / bulk adjust | inventory snapshot + ledger of the variant(s); low-stock list; product detail stock |
| Gallery attach/update/reorder/detach | product media list; product detail; media asset usage |
| Media upload/replace/reprocess/update/delete/restore/folders | media lists; asset detail; folder tree |
| Collection changes / evaluate / products | collections list + detail; collection products |
| Pricing entity changes | that entity's list/detail; price-rule conflicts; "explain" of affected product |
| Coupon changes / bulk generate | coupons list; coupon detail/redemptions |
| Import commit | lists of the imported entity (products, variants, categories, attributes, price rules, inventory); import jobs |
| Synonym changes / reindex | synonyms list; search jobs |
| Page, block, revision changes | page detail (from response), pages list, revisions |
| Banners/announcements/FAQs/help/testimonials/stores/menus | their list; reorder is optimistic |
| Content settings | settings query |
| Enquiry update | enquiry detail (from response); queue |
| Admin user changes | users list; if it is the current user → `/auth/me` |
| Sign-out / session lost | `queryClient.clear()` |

## 4. Mutation patterns

- **Pessimistic by default**: the UI waits for the server and renders its response (the server
  normalises slugs, derives publication state, sanitises HTML, computes completeness).
- **Optimistic** only for reorders and simple toggles on non-versioned lists, with rollback.
- **Versioned entities**: send `version`; on `409 STALE_RESOURCE {yourVersion, currentVersion}`
  open `VersionConflictDialog` ("Someone else changed this record") with **Reload latest**,
  **Compare** (your values beside the saved ones, changed fields only) and **Cancel**; never auto-merge.
- **Idempotency**: for the 18 routes that support it, a UUID `Idempotency-Key` is created when the
  user starts the action and reused for retries of the same attempt. `Idempotent-Replay: true`
  (readable same-origin) is treated as success. `409 IDEMPOTENCY_IN_PROGRESS` → "Still working on
  your previous request"; `409 IDEMPOTENCY_KEY_REUSED` → new key and ask the user to retry.
- **Double submit**: buttons disabled while pending; destructive dialogs cannot be confirmed twice.
- **PATCH bodies** contain dirty fields only (plus `version`).

## 5. Error model

```ts
type ApiError = {
  status: number;          // HTTP status (0 for network)
  code: string;            // backend SNAKE_CASE code, or a client code below
  message: string;         // backend message (human-written) or client copy
  details: unknown;        // backend details
  traceId?: string;        // backend error.traceId (= x-request-id)
  requestId: string;       // id the client sent
};
```

Client-side codes: `NETWORK_ERROR` (fetch failed / offline), `TIMEOUT` (AbortController),
`PAYLOAD_TOO_LARGE_PROXY` (non-JSON 413 from nginx), `UPSTREAM_UNAVAILABLE` (non-JSON 502/503),
`GATEWAY_TIMEOUT` (non-JSON 504), `UNEXPECTED_RESPONSE` (non-envelope body).

### 5.1 Handling by status

| Status / code | Where it comes from | UI behaviour |
| --- | --- | --- |
| 400 `INVALID_JSON`, `DATABASE_ERROR`, `BAD_REQUEST` | error handler | generic "The request could not be processed" + traceId (a client bug; logged in dev) |
| 400 `REFRESH_TOKEN_IN_BODY_NOT_ALLOWED` | refresh | never sent by the admin |
| 401 `NOT_AUTHENTICATED`, `TOKEN_EXPIRED` | authenticate | one renewal attempt (A3) then sign-out |
| 401 `TOKEN_INVALID`, `TOKEN_REUSE`, `ACCOUNT_DISABLED`, `ACCOUNT_LOCKED` | authenticate / refresh | sign-out with the specific reason |
| 401 `INVALID_CREDENTIALS` | login, change-password | form error; **never** a sign-out |
| 403 `PASSWORD_CHANGE_REQUIRED` | authenticate | redirect `/change-password` |
| 403 `CSRF_TOKEN_INVALID` | csrf | re-read cookie, retry once; else session-lost |
| 403 `FORBIDDEN` (+ `details.required`) | requirePermission / handlers | permission state; no retry; background `/auth/me` revalidation |
| 403 `ROLE_NOT_GRANTABLE`, `ROLE_NOT_MANAGEABLE`, `ADMIN_USER_NOT_MANAGEABLE`, `LAST_SUPER_ADMIN` | admin users | explained inline on the action |
| 403 `CORS_ORIGIN_NOT_ALLOWED` | CORS | full-page configuration error ("This admin address is not allowed by the API") — deployment issue |
| 404 `NOT_FOUND` | any | detail: "This item no longer exists" + back link; list: refetch |
| 409 `STALE_RESOURCE` | versioned writes | conflict dialog |
| 409 `*_IN_USE`, `CATEGORY_HAS_PRODUCTS`, `NAVIGATION_HAS_CHILDREN`, `HELP_CATEGORY_HAS_*`, `GROUP_IS_DEFAULT`, `TAX_CLASS_DEFAULT` | guarded deletes/changes | dialog listing what blocks it (from `details`) and how to resolve |
| 409 `SLUG_TAKEN`, `SLUG_REDIRECT_CONFLICT`, `DUPLICATE_RESOURCE`, `CONFLICT`, `VARIANT_COMBINATION_EXISTS` | uniqueness | field error on the offending field when identifiable |
| 409 `INVENTORY_CONFLICT`, `STOCK_BELOW_RESERVED`, `VARIANT_RESERVED`, `INSUFFICIENT_STOCK` | inventory | reload snapshot + explanation |
| 409 `WRITE_CONFLICT` | DB deadlock (P2034) | "Another change landed first — try again" (safe to retry) |
| 409 `IMPORT_NOT_VALIDATED`, `IMPORT_FILE_MISMATCH` (commit with a different file than the one validated, since b5861fd), `IDEMPOTENCY_*`, `COUPON_EXHAUSTED`, `INVALID_ORDER_TRANSITION` (+ `details.allowed`) | workflows | step-specific message (the API's own sentence) |
| 413 `FILE_TOO_LARGE`, `PAYLOAD_TOO_LARGE`, `PAYLOAD_TOO_LARGE_PROXY` | multer / body parser / nginx | "This file is larger than N MB" (N from `/media/config`) |
| 415 `UNSUPPORTED_FILE_TYPE` | upload validator | "The file's contents aren't a supported type" |
| 422 `VALIDATION_ERROR` | Zod middleware or services | field mapping (§5.2) |
| 422 `PRODUCT_NOT_PUBLISHABLE`, `PAGE_NOT_PUBLISHABLE` | publish gates | checklist of every blocker with links to the fixing tab |
| 422 `VARIANT_MATRIX_TOO_LARGE`, `ATTRIBUTE_NOT_VARIANT_DEFINING`, `VARIANT_OPTIONS_INCONSISTENT`, `CATEGORY_NOT_PURCHASABLE`, `UNSAFE_SVG`, `FILE_INFECTED`, `SEARCH_QUERY_TOO_SHORT` | domain rules | inline explanation |
| 429 `RATE_LIMITED` | global or scoped limiter | "Too many requests from this network — wait a minute"; queued uploads pause and resume; mutations are not auto-retried |
| 500 `INTERNAL_SERVER_ERROR` | error handler | "Something went wrong on our side" + traceId; never show `details.hint` |
| 501 `PRESIGN_NOT_SUPPORTED` | presign | never called |
| 502/503/504 | proxy, provider, `/ready` 503 | "The API is unavailable" banner with retry; GETs retried once |

### 5.2 Mapping 422 details to fields

| Shape | Source | Mapping |
| --- | --- | --- |
| `[{location, path, code, message}]` | `validate()` middleware | `path` (dot notation) → form field; `location: query/params` → form-level |
| `[{path, code, message}]` | uncaught `ZodError` | same |
| `{field, issues[]}` | password policy | field + bullet list |
| `{field}` | single-field service checks | field |
| `{rejected, writable}` | content settings | form-level: "These settings can't be edited here" |
| `{repeated}`, `{productIds}` | relations, curated order | highlight the listed rows |
| anything else / `null` | — | form-level alert with the backend `message` |

## 6. Loading, empty, success

- First load → skeleton; background refetch → subtle spinner in the header, never a skeleton.
- Paging keeps the previous page visible (dimmed) until the new one arrives.
- Empty list → `EmptyState` with the permitted next action; empty search → "No results for …" + clear.
- Success → toast for mutations that leave the screen or affect other screens; inline "Saved"
  indicator for in-place edits; undo when a restore endpoint exists.

## 7. Session events

| Event | Trigger | Effect |
| --- | --- | --- |
| `signed-in` | login in any tab | other tabs refetch `/auth/me` |
| `session-updated` | refresh response with changed permissions | all tabs update the permission set |
| `signed-out` | logout, logout-all, refresh failure | all tabs clear caches and route to `/login` |
| Refresh lock | `navigator.locks.request('cw-adm-refresh')` | only one tab refreshes at a time |

## 8. Network and rate limits

- Offline (`navigator.onLine` false or `NETWORK_ERROR`): banner "You're offline"; forms keep their
  values; nothing is queued for later.
- Request budget: the global limiter (default 120 requests/min per IP) is shared by every admin
  behind one office IP; scoped limiters allow 10 per minute for uploads, imports, exports, bulk and
  destructive catalog actions. The client therefore batches, debounces and never loops single-item
  destructive calls (use `/catalog/bulk` or `/media/bulk-delete`).
- Cross-origin mode cannot read `RateLimit`/`Retry-After`/`Content-Disposition` headers (only
  `X-Request-Id` is exposed); same-origin mode can.
