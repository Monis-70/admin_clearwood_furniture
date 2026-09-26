# ClearWood Admin — Component System

A restrained, dense-but-readable operations UI. It borrows the ClearWood palette from
`shared/tailwind-preset.cjs` (PROJECT_CONTEXT §7) but not the storefront's editorial styling: no
serif headlines, no large radii, no decorative gradients, no motion beyond state feedback.

## 1. Principles

1. **Clarity over density, density over whitespace.** Tables show 25 rows at 40 px; forms use a
   12-column grid with labels above inputs.
2. **Every state is designed**: loading, empty, error, no-permission, read-only, on-hold, success.
3. **Plain language first, codes second**: labels from the terminology table
   ([ADMIN_INFORMATION_ARCHITECTURE.md §7](ADMIN_INFORMATION_ARCHITECTURE.md)); raw codes only in
   "Advanced details".
4. **One way to do a thing**: one table, one drawer, one confirm dialog, one toast system.
5. **WCAG 2.2 AA** is a release criterion, not a polish item.

## 2. Tokens

Colour pairs were measured with the WCAG 2.x formula (script kept with the analysis, results below).

| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| `--adm-bg` | `#FAF7F2` (cw-bg) | app background | — |
| `--adm-surface` | `#FFFFFF` | cards, tables, drawers | — |
| `--adm-surface-subtle` | `#F2ECE3` (cw-surface-2) | table header, selected row, sidebar hover | — |
| `--adm-ink` | `#1E1A16` | primary text | 17.29:1 on white, 16.18:1 on bg |
| `--adm-ink-soft` | `#6B6058` | secondary text, help text | 6.11:1 on white, 5.20:1 on subtle |
| `--adm-divider` | `#E3DACE` (cw-line) | dividers only (decorative) | 1.38:1 — **never** for input borders |
| `--adm-border` | `#8F847A` | input, checkbox, select borders | 3.65:1 on white, 3.42:1 on bg (≥ 3:1 non-text) |
| `--adm-primary` | `#8F4A2B` (cw-clay-dark) | primary buttons, links, active nav | white text 6.60:1 |
| `--adm-accent` | `#B4613A` (cw-clay) | focus ring, selection, progress | 4.46:1 on white → **not** for body text; fine for non-text (≥ 3:1) |
| `--adm-success` / bg | `#24664A` on `#E7F4EE` | Live, Ready, Active badges | 6.04:1 (brand `#2E7D5B` on that tint is 4.42:1, so the text is darkened) |
| `--adm-danger` / bg | `#B23B3B` on `#FBEAEA` | errors, destructive, Failed | 5.04:1; white on `#B23B3B` 5.86:1 |
| `--adm-warning` / bg | `#8A5300` on `#FFF4E0` | Scheduled-soon, low stock, on hold | 5.81:1 |
| `--adm-info` / bg | `#1F5A8A` on `#E8F1FA` | Scheduled, Processing | 6.37:1 |
| `--adm-neutral` / bg | `#4A433D` on `#EFEAE4` | Draft, Inactive, Archived | 8.12:1 |

- **Type**: Inter (self-hosted via `next/font`), 14 px base, 20 px line height; scale 12 · 14 · 16 ·
  18 · 22 · 28. Tabular numerals in tables and money.
- **Spacing**: 4 px grid (4, 8, 12, 16, 24, 32, 48).
- **Radius**: 6 px controls, 8 px cards/dialogs (the brand's 14–22 px radii are storefront-only).
- **Elevation**: border + `0 1px 2px rgba(30,26,22,.06)`; dialogs/drawers `0 18px 48px rgba(30,26,22,.12)` (cw-lg).
- **Motion**: 150–200 ms opacity/transform for overlays only; disabled under `prefers-reduced-motion`.
- **Breakpoints**: desktop-first ≥ 1280; usable to 1024; read-mostly down to 768 (tables become
  stacked cards, bulk actions hidden).

## 3. Layout components

| Component | Spec |
| --- | --- |
| `AppShell` | sidebar (240 px, collapsible to 64) + topbar (56 px) + content (max 1440, 24 px padding); skip-to-content link |
| `Sidebar` | groups and entries from `config/navigation.ts`, each with `requires: Permission[]`; active state; keyboard arrows; collapsed state stored locally (UI preference only) |
| `Topbar` | breadcrumb, environment badge (`NEXT_PUBLIC_APP_ENV` ≠ production → coloured ribbon), page help link, user menu |
| `Breadcrumbs` | derived from the route config; entity names resolved from the cached detail query (no extra request) |
| `PageHeader` | title, one-line **What is this?** description, status badge (detail pages), primary action, secondary actions menu, optional **Status legend** popover |
| `CommandMenu` | `Ctrl/⌘ K`; client-side list of screens the user may open |

## 4. Data display

| Component | Spec |
| --- | --- |
| `DataTable` | TanStack Table (headless); server-driven `page/limit/sort/order`; sortable columns only where the backend accepts `sort`; sticky header; row selection with a **select all on this page** checkbox (never "all pages"); column visibility menu persisted locally; density toggle; keyboard row navigation; row click opens detail/drawer; `aria-sort` on headers |
| `FilterBar` | filters generated from the endpoint's query schema (enum → select, boolean → tri-state, date range, entity pickers); synced to the URL; "Clear filters"; debounced search (350 ms) |
| `Pagination` | from `meta` (page, totalPages, total, hasNext); page size 25/50/100 (max 100) |
| `BulkActionBar` | appears on selection; lists only actions the admin holds (per-action permission map); shows per-id results from the API (`BulkActionResultDto`) in a results dialog |
| `StatusBadge` | `status → {label, tone, description}` registry keyed by shared enums; tooltip with the description; legend component reuses the registry |
| `KeyValueList` | read-only detail blocks; copy buttons for ids/SKUs |
| `AuditTimeline` | `GET /audit-logs?entity=&entityId=`; actor, action, severity, relative + absolute IST time, expandable before/after diff |
| `Tree` | category/help/menu trees; virtualised above 200 nodes; drag-and-drop via dnd-kit with keyboard sensors; drop validation (depth, cycles) before calling the API |
| `EmptyState` | icon, one sentence on what would appear here, primary next action (only if permitted) |
| `Skeleton` | table rows, form sections, cards; shown only on first load (not on background refetch) |
| `Chart` | Recharts, lazy; Search insights trend and cart stats only; always paired with a table of the same numbers |

## 5. Forms

| Component | Spec |
| --- | --- |
| `Form` | React Hook Form + zodResolver with the **shared** schema; submit disabled while pending; server 422 mapped onto fields (array details by `path`, object details by `field`), unknown paths shown in a form-level alert |
| `FormSection` | titled group with a short description; collapsible advanced sections |
| `Field` | label, required marker, help text, error text linked via `aria-describedby` |
| `MoneyInput` | shows ₹ with 2 decimals, stores integer paise via shared `toPaise`/`toRupees`; rejects negatives where the schema does |
| `PercentInput` | shows %, stores basis points (`percentToBp`) |
| `DateTimeInput` | edits in IST, sends UTC ISO; shows the timezone explicitly |
| `SlugInput` | auto-derives from name until edited; validates `^[a-z0-9]+(?:-[a-z0-9]+)*$`; warns that renaming creates a redirect |
| `ColorInput` | `#RRGGBB` with swatch |
| `CodeInput` | UPPER_SNAKE codes (attributes, tax classes, groups, coupons) with live formatting |
| `EntityPicker` | async combobox for products (debounced `GET /catalog/products?q=`), categories (from the cached tree), collections, brands, attribute values, admin users (only with `system.user.read`) |
| `MediaPicker` | library search/filter + inline upload; returns media ids; shows renditions, never storage keys |
| `RuleBuilder` | collection rules and discount conditions from the shared whitelists (fields/operators) |
| `BlockForm` | per-block editor generated from `blockRegistry` config schemas, with media and entity pickers at the declared `mediaFields`/`referenceFields` paths |
| `UnsavedChangesGuard` | blocks in-app navigation and `beforeunload` when a form is dirty |
| `VersionConflictDialog` | on `409 STALE_RESOURCE`: "Someone saved this item after you opened it" → **Reload latest** (keeps a copy of your values to re-apply) or **Cancel** |

## 6. Overlays and feedback

| Component | Spec |
| --- | --- |
| `Drawer` | right side, 480/720 px; for quick create/edit and details; focus trapped; `Esc` closes (guarded if dirty) |
| `Modal` | small focused tasks (duplicate, schedule, generate codes) |
| `ConfirmDialog` | three levels: **standard** (reversible: title, consequence, confirm), **destructive** (red button, lists what is affected, e.g. delete-impact counts), **irreversible** (destructive + type the item's name/email/"DELETE") |
| `Toast` (sonner) | success (auto-dismiss 4 s), error (persistent until dismissed, includes "Reference: traceId" with copy), undo action where a restore endpoint exists |
| `InlineAlert` | form-level and section-level errors and warnings |
| `OnHoldNotice` | fixed copy for inactive integrations: what is off, what still works, who to contact |
| `PermissionNotice` | no-access page and read-only banner (see role matrix §6) |
| `ProgressList` | per-file upload progress, reindex job progress, import validation |

## 7. Media and files

| Component | Spec |
| --- | --- |
| `FileUploader` | drag-drop, paste, browse; pre-validates against `/media/config`; batches requests (≤ `maxUploadFiles`, ≤ 60 MB per request); XHR progress per batch; per-file retry; resumes after `429` |
| `ImageGallery` | sortable grid (dnd-kit), role chips (Primary enforced single), variant/option scope chips |
| `Image` | uses backend renditions with `srcset`, fixed aspect boxes, `loading="lazy"`, alt text required in forms |
| `ImportExportPanel` | the nine-step wizard of Workflow F with a step indicator |
| `DownloadButton` | fetch → blob → client-named file; progress spinner; error toast with traceId |

## 8. Accessibility requirements

- Keyboard: every action reachable; visible focus ring (`--adm-accent`, 2 px, offset 2 px); logical
  tab order; drag-and-drop always has a keyboard alternative (move up/down, "Move to…" menu).
- Semantics: Radix primitives for dialogs/menus/tabs/comboboxes; tables use `<table>` with headers;
  status never conveyed by colour alone (badge text + icon).
- Live regions announce async results (saved, failed, upload complete).
- Forms: errors announced and focused on submit; required fields marked in text.
- Contrast per §2; touch targets ≥ 32 px on desktop, 44 px under 1024 px.
- Automated axe checks in component and E2E tests; manual screen-reader pass (NVDA + Chrome) per phase.

## 9. Content style

- Buttons are verbs: "Publish product", "Move to trash", "Import 1,240 rows".
- Destructive copy states the consequence and whether it can be undone.
- Errors: what happened + what to do; backend `message` is shown when it is already human-readable
  (it is written that way), with a friendlier override for known codes.
- Dates: "25 Sep 2026, 15:07 IST"; relative time only as a secondary hint.
- Money: `formatINR(paise)` → "₹9,999.00"; percentages from basis points.
