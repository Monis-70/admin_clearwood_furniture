/**
 * matrix:doc — regenerates docs/ADMIN_CAPABILITY_MATRIX.md: every backend route in one of five
 * classes, the remaining UI work, the permission matrix and the security properties of every
 * admin mutation. Built only from pinned sources (contracts/route-inventory.json,
 * contracts/openapi-debt.json, src/config/api-coverage.ts, the endpoint registry and the seeded
 * role grants), so `--check` fails whenever the document and the repository disagree.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  API_COVERAGE,
  EXTERNAL_ROUTES_USED,
  IMPLEMENTED_THROUGH_PHASE,
  MISSING_BACKEND_CAPABILITIES,
  type CoverageEntry,
} from '../src/config/api-coverage';
import { PERMISSION_CODES } from '../src/contracts/shared/enums';
import { endpoints } from '../src/lib/api/endpoints';
import { ROLE_PERMISSIONS } from '../src/tests/fixtures/roles';

import { flattenRegistry, type InventoryRoute } from './coverage/check';

type Route = InventoryRoute & {
  source: string;
  rateLimit: string | null;
  validation: string[];
  allowPendingPasswordChange: boolean;
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREFIX = '/api/v1/admin';
const read = <T>(rel: string): T => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')) as T;

const inventory = read<{ routes: Route[] }>('contracts/route-inventory.json');
const debt = new Set(read<{ routes: string[] }>('contracts/openapi-debt.json').routes);
const manifest = read<{ backend: { commit: string | null; dirty: boolean | null } }>(
  'contracts/manifest.json',
);

const keyOf = (route: Route) => `${route.method} ${route.path}`;
const suffixOf = (route: Route) => `${route.method} ${route.path.slice(PREFIX.length)}`;
const isAdmin = (route: Route) => route.path.startsWith(`${PREFIX}/`);
const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const code = (text: string) => `\`${text}\``;

/**
 * Admin mutations whose permission is checked inside the controller: the route inventory only sees
 * route middleware. Generation fails when another unguarded mutation appears outside /auth, or when
 * one of these gains a route guard (the entry is then stale).
 */
const HANDLER_GUARDS: Readonly<Record<string, string>> = {
  'POST /catalog/import/{entity}':
    'in the controller, per entity (`assertImportAllowed`: `IMPORT_PERMISSIONS`, e.g. `catalog.product.import`)',
  'POST /catalog/import/jobs/{id}/commit':
    'in the controller, before the job is read (`assertAnyImportAllowed`), then per entity',
};

const wired = new Set(
  flattenRegistry(endpoints).map(
    ({ def }) => `${def.method} ${def.base === 'root' ? def.path : `/api/v1${def.path}`}`,
  ),
);

const CLASSES = [
  'UI required: built',
  'UI required: final UI phase',
  'On hold (integration)',
  'Internal / system',
  'Not applicable to the admin',
] as const;
type Klass = (typeof CLASSES)[number];
const CLASS_MEANING: Record<Klass, string> = {
  'UI required: built': 'wired in the endpoint registry and used by a screen',
  'UI required: final UI phase': 'classified for a screen (P3 and later), not wired yet',
  'On hold (integration)':
    'payments, refunds, returns, courier or e-mail: hidden until the integration is live',
  'Internal / system': 'never called by the UI (see ADMIN_API_COVERAGE.md §4)',
  'Not applicable to the admin': 'storefront and customer API; the admin does not call it',
};

function classify(route: Route): Klass {
  if (!isAdmin(route)) {
    return keyOf(route) in EXTERNAL_ROUTES_USED
      ? wired.has(keyOf(route))
        ? 'UI required: built'
        : 'UI required: final UI phase'
      : 'Not applicable to the admin';
  }
  const entry = API_COVERAGE[suffixOf(route)];
  if (!entry) throw new Error(`Unclassified admin route ${keyOf(route)}: run coverage:check.`);
  if (entry.status.startsWith('hold:')) return 'On hold (integration)';
  if (entry.status === 'internal') return 'Internal / system';
  return wired.has(keyOf(route)) ? 'UI required: built' : 'UI required: final UI phase';
}

const routes = [...inventory.routes].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
const admin = routes.filter(isAdmin);
const klass = new Map(routes.map((route) => [keyOf(route), classify(route)]));
const entryOf = (route: Route): CoverageEntry | undefined => API_COVERAGE[suffixOf(route)];

function permissionText(route: Route): string {
  if (route.auth === 'public') return 'public';
  if (route.permissionExpression) return 'computed per request';
  const handler = HANDLER_GUARDS[suffixOf(route)];
  if (handler) return handler;
  const all = route.permissions.map(code).join(' + ');
  const any = route.anyPermissions.length
    ? `any of ${route.anyPermissions.map(code).join(', ')}`
    : '';
  return [all, any].filter(Boolean).join('; ') || 'own session';
}

const count = (list: Route[], k: Klass) => list.filter((r) => klass.get(keyOf(r)) === k).length;
const commit = `${manifest.backend.commit?.slice(0, 7) ?? 'unknown'}${manifest.backend.dirty ? ' + uncommitted changes' : ''}`;
const other = routes.filter((route) => !isAdmin(route));

let md = `# ClearWood Admin — Capability, Permission and Mutation Matrix

> **Generated** by \`npm run matrix:doc\` from \`contracts/route-inventory.json\` and
> \`contracts/openapi-debt.json\` (backend \`${commit}\`), \`src/config/api-coverage.ts\`, the endpoint
> registry and the seeded role grants. Do not edit by hand. \`npm run matrix:doc -- --check\` (part of
> \`npm run verify\`) fails when it is out of date. Per-route purpose and screen: [ADMIN_API_COVERAGE.md](ADMIN_API_COVERAGE.md).

## 1. Every backend route, by class

Implemented through phase **P${IMPLEMENTED_THROUGH_PHASE}**.

| Class | Meaning | Admin routes | Other routes | Total |
| --- | --- | ---: | ---: | ---: |
${CLASSES.map((k) => `| ${k} | ${CLASS_MEANING[k]} | ${count(admin, k)} | ${count(other, k)} | ${count(routes, k)} |`).join('\n')}
| **Total** | | **${admin.length}** | **${other.length}** | **${routes.length}** |
| Missing backend capability | no route exists; the UI must not imitate it (§6) | ${MISSING_BACKEND_CAPABILITIES.length} capabilities | | |

## 2. Admin routes by module

| Module | Routes | Built | Final UI phase | On hold | Internal | Not in OpenAPI |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
`;

const modules = new Map<string, Route[]>();
for (const route of admin) {
  const name = entryOf(route)!.module;
  modules.set(name, [...(modules.get(name) ?? []), route]);
}
for (const [name, list] of modules) {
  md += `| ${name} | ${list.length} | ${count(list, 'UI required: built')} | ${count(list, 'UI required: final UI phase')} | ${count(list, 'On hold (integration)')} | ${count(list, 'Internal / system')} | ${list.filter((r) => debt.has(keyOf(r))).length} |\n`;
}

const pending = admin.filter((r) => klass.get(keyOf(r)) === 'UI required: final UI phase');
md += `
## 3. Remaining UI capabilities for the final UI phase (${pending.length} admin routes)

Grouped by module; the status is the planned phase. Screens and actions come from the coverage table.
`;
const pendingModules = new Map<string, Route[]>();
for (const route of pending) {
  const name = entryOf(route)!.module;
  pendingModules.set(name, [...(pendingModules.get(name) ?? []), route]);
}
for (const [name, list] of pendingModules) {
  md += `\n### ${name} (${list.length})\n\n| Status | Method | Path | Purpose | Screen → action | Permission | Destructive |\n| --- | --- | --- | --- | --- | --- | --- |\n`;
  for (const route of list) {
    const entry = entryOf(route)!;
    const destructive =
      entry.destructive === 'X' ? 'irreversible' : entry.destructive === 'R' ? 'reversible' : '—';
    md += `| ${entry.status} | ${route.method} | ${code(route.path.slice(PREFIX.length))} | ${cell(entry.purpose)} | ${cell(entry.screen)} → ${cell(entry.action)} | ${permissionText(route)} | ${destructive} |\n`;
  }
}

const ROLES = Object.entries(ROLE_PERMISSIONS) as [string, readonly string[]][];
const ABBR: Record<string, string> = {
  SUPER_ADMIN: 'SA',
  ADMIN: 'AD',
  CATALOG_MANAGER: 'CM',
  ORDER_MANAGER: 'OM',
  CONTENT_MANAGER: 'CO',
};
const guards = (route: Route, permission: string) =>
  route.permissions.includes(permission) || route.anyPermissions.includes(permission);
const unguarded = admin.filter(
  (r) =>
    r.auth !== 'public' &&
    !r.permissionExpression &&
    !r.permissions.length &&
    !r.anyPermissions.length &&
    !HANDLER_GUARDS[suffixOf(r)],
);
const computed = admin.filter((r) => r.permissionExpression);
const publicAdmin = admin.filter((r) => r.auth === 'public');

md += `
## 4. Permission matrix

Seeded roles: ${ROLES.map(([role]) => `${ABBR[role]} ${role}`).join(' · ')}. A role holds a route when it holds
every required permission (and one of the "any of" set). ${computed.length} admin routes decide per request
(${computed.map((r) => code(suffixOf(r))).join(', ') || 'none'}); ${Object.keys(HANDLER_GUARDS).length} check the permission in the controller (imports, §5);
${unguarded.length} need only a signed-in admin (own session and account); ${publicAdmin.length} are public (sign-in, session renewal
and the password-reset pair, which is on hold).

| Permission | ${ROLES.map(([role]) => ABBR[role]).join(' | ')} | Admin routes | Built | Final UI phase | On hold / internal |
| --- | ${ROLES.map(() => ':---:').join(' | ')} | ---: | ---: | ---: | ---: |
`;
const unused: string[] = [];
for (const permission of PERMISSION_CODES) {
  const list = admin.filter((route) => guards(route, permission));
  if (list.length === 0) {
    unused.push(permission);
    continue;
  }
  const held = ROLES.map(([, grants]) => (grants.includes(permission) ? '✓' : '')).join(' | ');
  const parked = count(list, 'On hold (integration)') + count(list, 'Internal / system');
  md += `| ${code(permission)} | ${held} | ${list.length} | ${count(list, 'UI required: built')} | ${count(list, 'UI required: final UI phase')} | ${parked} |\n`;
}
md += `\nPermissions that guard no admin route (${unused.length}): ${unused.map(code).join(', ') || 'none'}.\n`;

const mutations = admin.filter((route) => route.method !== 'GET');
const writes = mutations.filter((route) => ['POST', 'PUT', 'PATCH'].includes(route.method));
const noCsrf = mutations.filter((route) => !route.csrf);
const noPermission = mutations.filter(
  (r) =>
    !r.permissionExpression &&
    !r.permissions.length &&
    !r.anyPermissions.length &&
    !HANDLER_GUARDS[suffixOf(r)],
);
const handlerGuarded = mutations.filter((r) => HANDLER_GUARDS[suffixOf(r)]);
for (const route of noPermission) {
  if (!route.path.startsWith(`${PREFIX}/auth/`)) {
    throw new Error(
      `${keyOf(route)} has no permission guard in the inventory: confirm the handler checks one and list it in HANDLER_GUARDS, or report it.`,
    );
  }
}
for (const suffix of Object.keys(HANDLER_GUARDS)) {
  const route = admin.find((r) => suffixOf(r) === suffix);
  if (!route || route.permissions.length || route.anyPermissions.length) {
    throw new Error(
      `HANDLER_GUARDS entry "${suffix}" is stale: update scripts/capability-matrix.ts.`,
    );
  }
}
const noBody = writes.filter((route) => !route.validation.some((v) => v.startsWith('body')));
const noValidation = mutations.filter((route) => route.validation.length === 0);
const list = (items: Route[]) =>
  items.length
    ? items
        .map(
          (r) =>
            `- ${code(suffixOf(r))}${r.auth === 'public' ? ' (public)' : ''}${r.rateLimit ? `, rate limit ${code(r.rateLimit)}` : ''}${entryOf(r) ? ` — ${cell(entryOf(r)!.purpose)}` : ''}`,
        )
        .join('\n')
    : '- none';

md += `
## 5. Admin mutations: security and data integrity (${mutations.length})

| Property | Mutations | Of |
| --- | ---: | ---: |
| CSRF token required (double submit) | ${mutations.length - noCsrf.length} | ${mutations.length} |
| Permission guard on the route, computed per request, or checked in the handler | ${mutations.length - noPermission.length} | ${mutations.length} |
| Request validated by a schema (body, params or query) | ${mutations.length - noValidation.length} | ${mutations.length} |
| POST/PUT/PATCH with a validated body | ${writes.length - noBody.length} | ${writes.length} |
| Idempotency-Key honoured | ${mutations.filter((r) => r.idempotency).length} | ${mutations.length} |
| Rate limited | ${mutations.filter((r) => r.rateLimit).length} | ${mutations.length} |
| Versioned update (409 on a stale version) | ${mutations.filter((r) => entryOf(r)?.kind === 'U').length} | ${mutations.length} |
| Destructive: reversible / irreversible | ${mutations.filter((r) => entryOf(r)?.destructive === 'R').length} / ${mutations.filter((r) => entryOf(r)?.destructive === 'X').length} | ${mutations.length} |

**Without a CSRF token (${noCsrf.length})** — no session cookie exists yet, or the refresh cookie itself is the credential:

${list(noCsrf)}

**Without a permission guard (${noPermission.length})** — act only on the caller's own session or account:

${list(noPermission)}

**Permission checked in the handler, not in route middleware (${handlerGuarded.length})**:

${handlerGuarded.map((r) => `- ${code(suffixOf(r))}: ${HANDLER_GUARDS[suffixOf(r)]}`).join('\n')}

**POST/PUT/PATCH without a body schema (${noBody.length})** — multipart uploads, or actions whose only input is the path:

${list(noBody)}

<details>
<summary>Every admin mutation</summary>

| Method | Path | Kind | Destructive | Permission | CSRF | Validation | Idempotency | Rate limit | Class |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${mutations
  .map((r) => {
    const entry = entryOf(r)!;
    return `| ${r.method} | ${code(r.path.slice(PREFIX.length))} | ${entry.kind} | ${entry.destructive} | ${permissionText(r)} | ${r.csrf ? 'yes' : '**no**'} | ${cell(r.validation.join('; ')) || '—'} | ${r.idempotency ? 'yes' : '—'} | ${r.rateLimit ?? '—'} | ${klass.get(keyOf(r))} |`;
  })
  .join('\n')}

</details>

## 6. Missing backend capabilities (${MISSING_BACKEND_CAPABILITIES.length})

Not offered by the API at \`${commit}\`. The admin shows none of them and imitates none of them.

| Area | Capability | What exists today | What it would need |
| --- | --- | --- | --- |
${MISSING_BACKEND_CAPABILITIES.map((m) => `| ${m.area} | ${cell(m.capability)} | ${cell(m.today)} | ${cell(m.needs)} |`).join('\n')}

## 7. OpenAPI coverage

The backend's OpenAPI document does not describe ${debt.size} of ${routes.length} routes (its ratchet list
\`docs/openapi-debt.json\`, which may only shrink): ${admin.filter((r) => debt.has(keyOf(r))).length} of ${admin.length} admin routes, of which
${admin.filter((r) => debt.has(keyOf(r)) && klass.get(keyOf(r)) === 'UI required: built').length} are already used by the admin. The admin's contract is the pinned route inventory and the
vendored shared types, both checked on every build, so this is documentation debt rather than contract drift.
`;

const target = path.join(ROOT, 'docs', 'ADMIN_CAPABILITY_MATRIX.md');
if (process.argv.includes('--check')) {
  const current = fs.existsSync(target)
    ? fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n')
    : '';
  if (current !== md) {
    console.error(
      'docs/ADMIN_CAPABILITY_MATRIX.md is out of date: run npm run matrix:doc and commit the result.',
    );
    process.exit(1);
  }
  console.log('docs/ADMIN_CAPABILITY_MATRIX.md is up to date.');
} else {
  fs.writeFileSync(target, md);
  console.log(
    `docs/ADMIN_CAPABILITY_MATRIX.md regenerated: ${routes.length} routes (${admin.length} admin), ${mutations.length} admin mutations, ${pending.length} admin routes left for the final UI phase.`,
  );
}
