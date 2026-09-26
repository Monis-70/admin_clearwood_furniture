// contracts:check — fails when the pinned contracts were edited by hand, or (with a backend
// checkout available) when the backend has drifted from what is pinned.
//
//   npm run contracts:check                       integrity of the pinned snapshot (CI, prebuild)
//   npm run contracts:check -- --against-backend  also compare with the backend working tree
import fs from 'node:fs';
import path from 'node:path';

import {
  INVENTORY_FILE,
  MANIFEST_FILE,
  OPENAPI_DEBT_FILE,
  VENDOR_DIR,
  backendGitState,
  diffKeys,
  generateInventory,
  hashFile,
  hashTree,
  resolveBackendDir,
  routeKey,
  serialiseInventory,
} from './lib.mjs';

const problems = [];

if (!fs.existsSync(MANIFEST_FILE) || !fs.existsSync(INVENTORY_FILE)) {
  console.error('Pinned contracts are missing. Run: npm run contracts:sync -- --backend <dir>');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));

// 1. The vendored snapshot is exactly what was synced.
const files = hashTree(VENDOR_DIR);
const { added, removed } = diffKeys(Object.keys(manifest.shared.files), Object.keys(files));
for (const rel of added) problems.push(`unexpected vendored file: src/contracts/shared/${rel}`);
for (const rel of removed) problems.push(`vendored file missing: src/contracts/shared/${rel}`);
for (const [rel, hash] of Object.entries(files)) {
  if (manifest.shared.files[rel] && manifest.shared.files[rel] !== hash) {
    problems.push(`vendored file edited by hand: src/contracts/shared/${rel}`);
  }
}
if (hashFile(INVENTORY_FILE) !== manifest.inventory.sha256) {
  problems.push('contracts/route-inventory.json was edited by hand');
}
if (!manifest.openapiDebt || !fs.existsSync(OPENAPI_DEBT_FILE)) {
  problems.push('contracts/openapi-debt.json is not pinned');
} else if (hashFile(OPENAPI_DEBT_FILE) !== manifest.openapiDebt.sha256) {
  problems.push('contracts/openapi-debt.json was edited by hand');
}

// 2. Optional: the backend has not moved on since the sync.
const againstBackend = process.argv.includes('--against-backend');
if (againstBackend) {
  const backend = resolveBackendDir(process.argv);
  if (!backend.ok) {
    problems.push(`backend checkout not found at ${backend.dir}`);
  } else {
    const git = backendGitState(backend.dir);
    if (git.commit !== manifest.backend.commit) {
      console.log(`Backend HEAD ${git.commit} differs from pinned ${manifest.backend.commit}.`);
    }
    const live = hashTree(path.join(backend.dir, 'shared', 'src'));
    const drift = diffKeys(Object.keys(manifest.shared.files), Object.keys(live));
    for (const rel of drift.added) problems.push(`backend added shared/src/${rel}`);
    for (const rel of drift.removed) problems.push(`backend removed shared/src/${rel}`);
    for (const [rel, hash] of Object.entries(live)) {
      if (manifest.shared.files[rel] && manifest.shared.files[rel] !== hash) {
        problems.push(`backend changed shared/src/${rel}`);
      }
    }
    const pinned = fs.readFileSync(INVENTORY_FILE, 'utf8').replace(/\r\n/g, '\n');
    const fresh = generateInventory(backend.dir);
    if (serialiseInventory(fresh) !== pinned) {
      const routes = diffKeys(JSON.parse(pinned).routes.map(routeKey), fresh.routes.map(routeKey));
      for (const key of routes.added) problems.push(`backend added route ${key}`);
      for (const key of routes.removed) problems.push(`backend removed route ${key}`);
      if (routes.added.length === 0 && routes.removed.length === 0) {
        problems.push('backend changed route middleware (auth/CSRF/permissions/limits/validation)');
      }
    }
    const debtSource = path.join(backend.dir, 'docs', 'openapi-debt.json');
    if (fs.existsSync(OPENAPI_DEBT_FILE) && hashFile(debtSource) !== hashFile(OPENAPI_DEBT_FILE)) {
      problems.push('backend changed docs/openapi-debt.json (OpenAPI coverage)');
    }
  }
}

const pinnedFrom = `${manifest.backend.commit ?? 'unknown'}${manifest.backend.dirty ? ' (+ uncommitted changes)' : ''}`;
if (problems.length > 0) {
  console.error(`Contracts check FAILED (pinned from backend ${pinnedFrom}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    againstBackend
      ? 'Run npm run contracts:sync, then npm run coverage:check, and review the changes.'
      : 'Never edit pinned contracts by hand; run npm run contracts:sync instead.',
  );
  process.exit(1);
}
console.log(
  `Contracts OK: ${Object.keys(files).length} shared files, ${manifest.inventory.routes} routes (admin ${manifest.inventory.adminRoutes}), backend ${pinnedFrom}${againstBackend ? ', matches the backend working tree' : ''}.`,
);
