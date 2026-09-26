// contracts:sync — pins the backend's shared contracts and route inventory into this repo.
//
//   npm run contracts:sync -- --backend ../clearwood-backend-repo
//
// Copies backend `shared/src` into src/contracts/shared (read-only snapshot), regenerates
// contracts/route-inventory.json from the mounted Express app, and records both in
// contracts/manifest.json with the backend commit. Review the diff it prints before committing.
import fs from 'node:fs';
import path from 'node:path';

import {
  CONTRACTS_DIR,
  INVENTORY_FILE,
  MANIFEST_FILE,
  VENDOR_DIR,
  backendGitState,
  diffKeys,
  generateInventory,
  hashFile,
  hashTree,
  listContractFiles,
  resolveBackendDir,
  routeKey,
  serialiseInventory,
} from './lib.mjs';

const backend = resolveBackendDir(process.argv);
if (!backend.ok) {
  console.error(
    `Backend checkout not found at ${backend.dir} (missing: ${backend.missing.join(', ')}).`,
  );
  console.error('Pass --backend <dir> or set CLEARWOOD_BACKEND_DIR.');
  process.exit(1);
}

const previous = fs.existsSync(MANIFEST_FILE)
  ? JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'))
  : null;
const previousRoutes = fs.existsSync(INVENTORY_FILE)
  ? JSON.parse(fs.readFileSync(INVENTORY_FILE, 'utf8')).routes.map(routeKey)
  : [];

const source = path.join(backend.dir, 'shared', 'src');
const git = backendGitState(backend.dir);

console.log(`Backend: ${backend.dir}`);
console.log(
  `Commit:  ${git.commit ?? 'unknown'} (${git.branch ?? '?'})${git.dirty ? ' + UNCOMMITTED CHANGES' : ''}`,
);

// 1. Vendored shared contracts
fs.rmSync(VENDOR_DIR, { recursive: true, force: true });
for (const rel of listContractFiles(source)) {
  const target = path.join(VENDOR_DIR, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(source, rel), target);
}

// 2. Route inventory from the mounted app
const inventory = generateInventory(backend.dir);
if (inventory.duplicates.length > 0) {
  console.warn(`WARNING: routes registered more than once: ${inventory.duplicates.join(', ')}`);
}
fs.mkdirSync(CONTRACTS_DIR, { recursive: true });
fs.writeFileSync(INVENTORY_FILE, serialiseInventory(inventory));

// 3. Manifest
const files = hashTree(VENDOR_DIR);
const manifest = {
  schema: 1,
  backend: {
    commit: git.commit,
    branch: git.branch,
    dirty: git.dirty,
    dirtyFiles: git.dirtyFiles,
  },
  shared: { source: 'shared/src', files },
  inventory: {
    file: 'contracts/route-inventory.json',
    sha256: hashFile(INVENTORY_FILE),
    routes: inventory.routes.length,
    adminRoutes: inventory.routes.filter((r) => r.path.startsWith('/api/v1/admin/')).length,
  },
};
fs.writeFileSync(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);

// 4. What changed
const fileDiff = diffKeys(Object.keys(previous?.shared.files ?? {}), Object.keys(files));
const changed = Object.keys(files).filter(
  (rel) => previous?.shared.files[rel] && previous.shared.files[rel] !== files[rel],
);
const routeDiff = diffKeys(previousRoutes, inventory.routes.map(routeKey));

console.log(
  `Shared files: ${Object.keys(files).length} (added ${fileDiff.added.length}, removed ${fileDiff.removed.length}, changed ${changed.length})`,
);
for (const rel of [
  ...fileDiff.added.map((f) => `+ ${f}`),
  ...fileDiff.removed.map((f) => `- ${f}`),
  ...changed.map((f) => `~ ${f}`),
]) {
  console.log(`  ${rel}`);
}
console.log(
  `Routes: ${manifest.inventory.routes} (admin ${manifest.inventory.adminRoutes}); added ${routeDiff.added.length}, removed ${routeDiff.removed.length}`,
);
for (const key of [
  ...routeDiff.added.map((k) => `+ ${k}`),
  ...routeDiff.removed.map((k) => `- ${k}`),
]) {
  console.log(`  ${key}`);
}
if (git.dirty) {
  console.warn(
    'WARNING: synced from uncommitted backend changes; re-sync once they are committed.',
  );
}
console.log('Next: npm run coverage:check, then review and commit contracts/ and src/contracts/.');
