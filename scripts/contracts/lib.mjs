// Shared helpers for contracts:sync and contracts:check. Plain Node, no dependencies.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ADMIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const VENDOR_DIR = path.join(ADMIN_ROOT, 'src', 'contracts', 'shared');
export const CONTRACTS_DIR = path.join(ADMIN_ROOT, 'contracts');
export const MANIFEST_FILE = path.join(CONTRACTS_DIR, 'manifest.json');
export const INVENTORY_FILE = path.join(CONTRACTS_DIR, 'route-inventory.json');
const INVENTORY_SCRIPT = path.join(ADMIN_ROOT, 'scripts', 'contracts', 'backend-inventory.cts');

export const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

/** Relative POSIX paths of every contract file under `dir` (tests are not part of the contract). */
export function listContractFiles(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        out.push(path.relative(dir, full).split(path.sep).join('/'));
      }
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out.sort();
}

/** Line endings are normalised so a Windows checkout and a Linux CI agree on the hash. */
export function hashFile(file) {
  return sha256(Buffer.from(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), 'utf8'));
}

export function hashTree(dir) {
  return Object.fromEntries(
    listContractFiles(dir).map((rel) => [rel, hashFile(path.join(dir, rel))]),
  );
}

export function resolveBackendDir(argv) {
  const flag = argv.indexOf('--backend');
  const candidate =
    (flag >= 0 ? argv[flag + 1] : undefined) ??
    process.env.CLEARWOOD_BACKEND_DIR ??
    path.join(ADMIN_ROOT, '..', 'clearwood-backend-repo');
  const dir = path.resolve(ADMIN_ROOT, candidate);
  const required = ['shared/src/index.ts', 'backend/src/app.ts', 'backend/tsconfig.json'];
  const missing = required.filter((rel) => !fs.existsSync(path.join(dir, rel)));
  return { dir, ok: missing.length === 0, missing };
}

function git(dir, args) {
  const result = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

export function backendGitState(dir) {
  const dirty = git(dir, ['status', '--porcelain', '--', 'shared', 'backend/src']);
  return {
    commit: git(dir, ['rev-parse', 'HEAD']),
    branch: git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']),
    dirty: dirty === null ? null : dirty.length > 0,
    // `git()` trims the output, which eats the first line's leading status column; parse the path instead.
    dirtyFiles: dirty ? dirty.split('\n').map((line) => line.replace(/^\s*\S+\s+/, '')) : [],
  };
}

/** Runs the inventory inside the backend checkout and returns the parsed JSON. */
export function generateInventory(backendDir) {
  const out = path.join(os.tmpdir(), `cw-admin-inventory-${process.pid}-${Date.now()}.json`);
  const tsxCli = path.join(backendDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  if (!fs.existsSync(tsxCli)) {
    throw new Error(`tsx not found in the backend checkout (${tsxCli}); run npm install there.`);
  }
  const result = spawnSync(
    process.execPath,
    [tsxCli, '--tsconfig', 'backend/tsconfig.json', INVENTORY_SCRIPT, out],
    {
      cwd: backendDir,
      encoding: 'utf8',
      env: { ...process.env, LOG_LEVEL: 'silent' },
      timeout: 300_000,
    },
  );
  if (result.status !== 0 || !fs.existsSync(out)) {
    throw new Error(
      `Route inventory failed (exit ${result.status}).\n${result.stderr || result.stdout}`,
    );
  }
  const inventory = JSON.parse(fs.readFileSync(out, 'utf8'));
  fs.rmSync(out, { force: true });
  return inventory;
}

/** Stable, reviewable file content: sorted routes, one per line, no timestamps. */
export function serialiseInventory(inventory) {
  const routes = [...inventory.routes].sort((a, b) =>
    `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`),
  );
  const lines = routes.map((route) => `    ${JSON.stringify(route)}`);
  return `{\n  "duplicates": ${JSON.stringify(inventory.duplicates)},\n  "routes": [\n${lines.join(',\n')}\n  ]\n}\n`;
}

export const routeKey = (route) => `${route.method} ${route.path}`;

export function diffKeys(before, after) {
  const a = new Set(before);
  const b = new Set(after);
  return {
    added: [...b].filter((key) => !a.has(key)),
    removed: [...a].filter((key) => !b.has(key)),
  };
}
