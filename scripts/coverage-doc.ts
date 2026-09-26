/**
 * coverage:doc — regenerates docs/ADMIN_API_COVERAGE.md from the same sources the build gate
 * checks (contracts/route-inventory.json, src/config/api-coverage.ts, the endpoint registry), so
 * the document can never disagree with `npm run coverage:check`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  API_COVERAGE,
  EXTERNAL_ROUTES_USED,
  IMPLEMENTED_THROUGH_PHASE,
  SCREENLESS_REASONS,
  type CoverageEntry,
} from '../src/config/api-coverage';
import { endpoints } from '../src/lib/api/endpoints';
import { ROLE_PERMISSIONS } from '../src/tests/fixtures/roles';

import { flattenRegistry, type InventoryRoute } from './coverage/check';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREFIX = '/api/v1/admin';

const inventory = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'contracts', 'route-inventory.json'), 'utf8'),
) as {
  routes: (InventoryRoute & { rateLimit: string | null; validation: string[] })[];
};
const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'contracts', 'manifest.json'), 'utf8'),
) as {
  backend: { commit: string | null; dirty: boolean | null };
};

const ROLE_ABBR: Record<string, string> = {
  SUPER_ADMIN: 'SA',
  ADMIN: 'AD',
  CATALOG_MANAGER: 'CM',
  ORDER_MANAGER: 'OM',
  CONTENT_MANAGER: 'CO',
};
const roleEntries = Object.entries(ROLE_PERMISSIONS) as [string, readonly string[]][];

function rolesFor(route: InventoryRoute): string {
  if (route.auth === 'public') return 'anyone';
  if (route.permissionExpression) return 'per kind (see notes)';
  if (route.permissions.length === 0 && route.anyPermissions.length === 0) return 'any admin';
  const holders = roleEntries.filter(
    ([, held]) =>
      route.permissions.every((code) => held.includes(code)) &&
      (route.anyPermissions.length === 0 ||
        route.anyPermissions.some((code) => held.includes(code))),
  );
  return holders.map(([role]) => ROLE_ABBR[role]).join(' ') || '—';
}

function permissionText(route: InventoryRoute): string {
  if (route.auth === 'public') return '— (public)';
  if (route.permissionExpression) return 'computed per request';
  const all = route.permissions.map((code) => `\`${code}\``).join(' + ');
  const any = route.anyPermissions.length
    ? `any of ${route.anyPermissions.map((code) => `\`${code}\``).join(', ')}`
    : '';
  return [all, any].filter(Boolean).join('; ') || '— (own account)';
}

const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const destructive = (d: CoverageEntry['destructive']): string =>
  d === 'X' ? 'Irreversible' : d === 'R' ? 'Reversible' : '—';

const wired = new Set(
  flattenRegistry(endpoints)
    .map(({ def }) => `${def.method} ${def.base === 'root' ? def.path : `/api/v1${def.path}`}`)
    .filter((key) => key.includes(PREFIX))
    .map((key) => key.replace(PREFIX, '')),
);

const byKey = new Map(inventory.routes.map((route) => [`${route.method} ${route.path}`, route]));
const modules = new Map<string, string[]>();
const counts = new Map<string, number>();
for (const [key, entry] of Object.entries(API_COVERAGE)) {
  const [method, suffix] = key.split(' ') as [string, string];
  const route = byKey.get(`${method} ${PREFIX}${suffix}`);
  if (!route) continue;
  counts.set(entry.status, (counts.get(entry.status) ?? 0) + 1);
  const notes = [
    entry.notes,
    route.rateLimit ? `rate limit: ${route.rateLimit}` : '',
    route.idempotency ? 'Idempotency-Key' : '',
  ]
    .filter(Boolean)
    .join('; ');
  const status = wired.has(key) ? `**${entry.status}** ✓` : `**${entry.status}**`;
  const line = `| ${method} | \`${suffix}\` | ${cell(entry.purpose)} | ${permissionText(route)} | ${route.csrf ? 'yes' : '—'} | ${cell(entry.screen)} → ${cell(entry.action)} | ${rolesFor(route)} | ${destructive(entry.destructive)} | ${entry.kind} | ${status} | ${cell(notes)} |`;
  modules.set(entry.module, [...(modules.get(entry.module) ?? []), line]);
}

const adminCount = inventory.routes.filter((route) => route.path.startsWith(`${PREFIX}/`)).length;
const phaseCount = [...counts.entries()]
  .filter(([s]) => s.startsWith('P'))
  .reduce((sum, [, n]) => sum + n, 0);
const statusOrder = [...counts.keys()].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
const commit = `${manifest.backend.commit?.slice(0, 7) ?? 'unknown'}${manifest.backend.dirty ? ' + uncommitted changes' : ''}`;

const STATUS_MEANING: Record<string, string> = {
  P0: 'Foundation: session and sign-in',
  P1: 'Access, account, admin users, roles, audit, dashboard',
  P2: 'Catalogue management: products, variants, categories, attributes, brands, collections, inventory, price rules, tax classes, media, import/export',
  P3: 'Categories, attributes, brands, catalog settings, tax classes (read)',
  P4: 'Products, variants, product media, inventory, collections',
  P5: 'Pricing, coupons, customer groups, tax & GST, delivery charges',
  P6: 'Import/export, search, collection maintenance',
  P7: 'Content (pages, banners, FAQs, help, testimonials, stores, navigation, settings)',
  P8: 'Enquiries, carts & wishlists',
  P9: 'Orders in limited (cash-on-delivery, manual shipping) mode',
};

let md = `# ClearWood Admin — API Coverage

> **Generated** by \`npm run coverage:doc\` from \`contracts/route-inventory.json\` (backend \`${commit}\`),
> \`src/config/api-coverage.ts\` and \`src/lib/api/endpoints.ts\`. Do not edit by hand: change the
> classification and regenerate. \`npm run coverage:check\` (part of every build) fails when these sources disagree.

## 1. Summary

${adminCount} admin routes are mounted under \`/api/v1/admin\`; every one is classified. ${phaseCount} have a screen, ${adminCount - phaseCount} are deliberately screen-less (§4).
Implemented through phase **P${IMPLEMENTED_THROUGH_PHASE}**: routes marked ✓ are wired in the endpoint registry.

| Status | Meaning | Routes |
| --- | --- | --- |
${statusOrder.map((s) => `| ${s} | ${STATUS_MEANING[s] ?? (s in SCREENLESS_REASONS ? SCREENLESS_REASONS[s as keyof typeof SCREENLESS_REASONS].reason : '')} | ${counts.get(s)} |`).join('\n')}
| **Total** | | **${adminCount}** |

## 2. Legend

- **Permission**: the backend guard on the route (\`computed per request\`: the handler decides, see notes).
- **Roles** that hold it by default: SA Super Admin · AD Admin · CM Catalog Manager · OM Order Manager · CO Content Manager (seed at the pinned commit).
- **Kind**: L list · G get · C create · U update (versioned, 409 on conflict) · u update · D delete · A action · P preview · R reorder · UP upload · DL download · AU auth.
- **Status**: build phase, \`hold:*\` integration on hold, \`internal\` never called by the UI. ✓ = wired in the endpoint registry.

## 3. Coverage by module
`;

const header =
  '| Method | Path | Purpose | Permission | CSRF | Screen → Action | Roles | Destructive | Kind | Status | Notes |\n|---|---|---|---|---|---|---|---|---|---|---|';
for (const [module, lines] of modules) {
  md += `\n### ${module} (${lines.length})\n\n${header}\n${lines.join('\n')}\n`;
}

md += `
## 4. Routes without a screen (${adminCount - phaseCount})

| Status | Routes | Why | Re-enable when |
| --- | --- | --- | --- |
${Object.entries(SCREENLESS_REASONS)
  .map(
    ([status, reason]) =>
      `| ${status} | ${counts.get(status) ?? 0} | ${reason.reason} | ${reason.reEnableWhen} |`,
  )
  .join('\n')}

## 5. Non-admin endpoints the admin calls

| Endpoint | Why | From phase |
| --- | --- | --- |
${Object.entries(EXTERNAL_ROUTES_USED)
  .map(([key, value]) => `| \`${key}\` | ${value.purpose} | P${value.phase} |`)
  .join('\n')}

## 6. Keeping this true

1. When the backend changes: \`npm run contracts:sync -- --backend <dir>\` (pins \`shared/src\` and the route inventory).
2. \`npm run coverage:check\` lists every new, removed or changed route; classify it in \`src/config/api-coverage.ts\`.
3. \`npm run coverage:doc\` regenerates this document; review the diff with the backend change.
4. \`npm run contracts:check -- --against-backend\` in CI (with a backend checkout) fails on silent drift.
`;

const target = path.join(ROOT, 'docs', 'ADMIN_API_COVERAGE.md');
if (process.argv.includes('--check')) {
  const current = fs.existsSync(target)
    ? fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n')
    : '';
  if (current !== md) {
    console.error(
      'docs/ADMIN_API_COVERAGE.md is out of date: run npm run coverage:doc and commit the result.',
    );
    process.exit(1);
  }
  console.log('docs/ADMIN_API_COVERAGE.md is up to date.');
} else {
  fs.writeFileSync(target, md);
  console.log(
    `docs/ADMIN_API_COVERAGE.md regenerated: ${adminCount} admin routes, ${modules.size} modules.`,
  );
}
