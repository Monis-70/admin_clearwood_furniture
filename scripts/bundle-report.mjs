// bundle:report — initial JS/CSS each exported page downloads (gzip), checked against budgets.
//   npm run build && npm run bundle:report
//
// Floor measured in Phase 0: ~204 KB gzip is React 19 + the Next.js 16 runtime + TanStack Query
// + the session layer, which every page needs. Budgets guard against regressions above that.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
const JS_BUDGET_KB = 280;
const CSS_BUDGET_KB = 40;

if (!fs.existsSync(OUT)) {
  console.error('No out/ directory: run `npm run build` first.');
  process.exit(1);
}

const sizes = new Map();
function gzipKb(assetPath) {
  if (!sizes.has(assetPath)) {
    const file = path.join(OUT, assetPath.replace(/^\//, ''));
    sizes.set(
      assetPath,
      fs.existsSync(file) ? gzipSync(fs.readFileSync(file), { level: 9 }).length / 1024 : 0,
    );
  }
  return sizes.get(assetPath);
}

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '_next' ? [] : htmlFiles(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

const pages = htmlFiles(OUT)
  .filter((file) => !/[\\/](404|_not-found)\.html$/.test(file))
  .map((file) => {
    const html = fs.readFileSync(file, 'utf8');
    const route = `/${path
      .relative(OUT, file)
      .split(path.sep)
      .join('/')
      .replace(/(index)?\.html$/, '')}`.replace(/(.)\/$/, '$1');
    return {
      route,
      js: new Set(
        [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]),
      ),
      css: new Set([...html.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g)].map((m) => m[1])),
    };
  })
  .sort((a, b) => a.route.localeCompare(b.route));

const shared = [...(pages[0]?.js ?? [])].filter((asset) =>
  pages.every((page) => page.js.has(asset)),
);
const sharedKb = shared.reduce((sum, asset) => sum + gzipKb(asset), 0);
const sum = (assets) => [...assets].reduce((total, asset) => total + gzipKb(asset), 0);

const pad = (text, width) => String(text).padEnd(width);
console.log(`Shared by every page: ${sharedKb.toFixed(1)} KB gzip JS (${shared.length} scripts)\n`);
console.log(
  `${pad('Route', 24)}${pad('JS total', 12)}${pad('Route-only', 12)}${pad('CSS', 10)}Scripts`,
);
const rows = pages.map((page) => {
  const jsKb = sum(page.js);
  const cssKb = sum(page.css);
  console.log(
    `${pad(page.route, 24)}${pad(`${jsKb.toFixed(1)} KB`, 12)}${pad(`${(jsKb - sharedKb).toFixed(1)} KB`, 12)}${pad(`${cssKb.toFixed(1)} KB`, 10)}${page.js.size}`,
  );
  return { route: page.route, jsKb, cssKb };
});

const largest = [...sizes.entries()]
  .filter(([asset]) => asset.endsWith('.js'))
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6);
console.log('\nLargest chunks (gzip):');
for (const [asset, kb] of largest) console.log(`  ${kb.toFixed(1).padStart(6)} KB  ${asset}`);

const over = rows.filter((row) => row.jsKb > JS_BUDGET_KB || row.cssKb > CSS_BUDGET_KB);
if (over.length > 0) {
  console.error(
    `\nBudget exceeded (JS ${JS_BUDGET_KB} KB, CSS ${CSS_BUDGET_KB} KB gzip per page): ${over.map((r) => r.route).join(', ')}`,
  );
  process.exit(1);
}
console.log(
  `\nAll pages within budget (JS ≤ ${JS_BUDGET_KB} KB, CSS ≤ ${CSS_BUDGET_KB} KB gzip per page).`,
);
