/**
 * coverage:check — the API coverage matrix as a build-time correctness check. Joins:
 *   contracts/route-inventory.json  what the backend mounts (pinned by contracts:sync)
 *   src/config/api-coverage.ts      how the admin handles every admin route
 *   src/lib/api/endpoints.ts        what the admin code calls
 * and fails on any disagreement (see scripts/coverage/check.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  API_COVERAGE,
  EXTERNAL_ROUTES_USED,
  IMPLEMENTED_THROUGH_PHASE,
  SCREENLESS_REASONS,
} from '../src/config/api-coverage';
import { endpoints } from '../src/lib/api/endpoints';

import { checkCoverage, flattenRegistry, type InventoryRoute } from './coverage/check';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function appRoutes(): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string, segments: string[]): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        if (entry.name === 'page.tsx') found.add(`/${segments.join('/')}`);
        continue;
      }
      walk(
        path.join(dir, entry.name),
        /^\(.+\)$/.test(entry.name) ? segments : [...segments, entry.name],
      );
    }
  };
  walk(path.join(ROOT, 'src', 'app'), []);
  return found;
}

const inventory = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'contracts', 'route-inventory.json'), 'utf8'),
) as {
  duplicates: string[];
  routes: InventoryRoute[];
};
const registry = flattenRegistry(endpoints);

const result = checkCoverage({
  inventory,
  coverage: API_COVERAGE,
  screenlessReasons: SCREENLESS_REASONS,
  externalRoutes: EXTERNAL_ROUTES_USED,
  registry,
  implementedThroughPhase: IMPLEMENTED_THROUGH_PHASE,
  appRoutes: appRoutes(),
});

const withScreen = [...result.counts.entries()]
  .filter(([s]) => s.startsWith('P'))
  .reduce((sum, [, n]) => sum + n, 0);
const summary = [...result.counts.entries()]
  .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
  .map(([status, n]) => `${status} ${n}`)
  .join(' · ');

console.log(
  `Admin routes: ${result.adminRouteCount} mounted, ${Object.keys(API_COVERAGE).length} classified`,
);
console.log(
  `  with a screen: ${withScreen} · screen-less (on hold / internal): ${result.adminRouteCount - withScreen}`,
);
console.log(`  ${summary}`);
console.log(
  `Implemented through phase ${IMPLEMENTED_THROUGH_PHASE}: ${result.implemented.size} admin routes wired, ${registry.length} endpoints in the registry`,
);
for (const warning of result.warnings) console.warn(`  note: ${warning}`);

if (result.failures.length > 0) {
  console.error(`\nAPI coverage check FAILED (${result.failures.length}):`);
  for (const failure of result.failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('API coverage OK.');
