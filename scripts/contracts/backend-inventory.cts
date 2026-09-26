/**
 * Route inventory of the ClearWood API, generated from a backend checkout.
 *
 * Runs INSIDE the backend (cwd = backend repo root) with the backend's own tsx and tsconfig, so the
 * mounted Express stack is the truth for "does this route exist". Static parsing of the route files
 * only adds middleware facts (auth, CSRF, permissions, rate limit, idempotency, validation) that
 * carry no runtime metadata. Read-only: it never writes inside the backend.
 *
 * Usage (from scripts/contracts/sync.mjs):
 *   npx tsx --tsconfig backend/tsconfig.json <admin>/scripts/contracts/backend-inventory.cts <out.json>
 */
import fs from 'node:fs';
import path from 'node:path';

interface Layer {
  route?: { path: string; methods: Record<string, boolean> };
  name?: string;
  regexp?: RegExp;
  handle?: { stack?: Layer[] };
}

interface RouteFacts {
  method: string;
  path: string;
  file: string;
  line: number;
  auth: 'public' | 'session' | 'optional' | 'customer' | 'optional-customer';
  allowPendingPasswordChange: boolean;
  csrf: boolean;
  permissions: string[];
  anyPermissions: string[];
  permissionExpression: string | null;
  rateLimit: string | null;
  idempotency: boolean;
  validation: string[];
}

const REPO = process.cwd();
const SRC = path.join(REPO, 'backend', 'src');
const OUT = process.argv[2];
if (!OUT) {
  console.error('usage: backend-inventory.cts <out.json>');
  process.exit(2);
}

/* ------------------------------------------------------------------ lexing helpers */

function closeOf(text: string, open: number): number {
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const stack: string[] = [];
  for (let i = open; i < text.length; i++) {
    const c = text[i]!;
    if (c === '/' && text[i + 1] === '/') {
      i = text.indexOf('\n', i);
      if (i < 0) return -1;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i) + 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++;
      continue;
    }
    if (pairs[c]) stack.push(pairs[c]!);
    else if (c === ')' || c === ']' || c === '}') {
      stack.pop();
      if (stack.length === 0) return i;
    }
  }
  return -1;
}

function stripComments(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i);
      i = end < 0 ? text.length : end - 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i) + 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const s = i;
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++;
      out += text.slice(s, i + 1);
      continue;
    }
    out += c;
  }
  return out;
}

function splitTop(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === "'" || c === '"' || c === '`') {
      const s = i;
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++;
      cur += text.slice(s, i + 1);
      continue;
    }
    if ('([{'.includes(c)) depth++;
    if (')]}'.includes(c)) depth--;
    if (c === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

const unquote = (s: string): string => s.trim().replace(/^['"`]|['"`]$/g, '');
const normalise = (route: string): string =>
  route
    .replace(/:([A-Za-z0-9_]+)(\([^)]*\))?\??/g, '{$1}')
    .replace(/\/{2,}/g, '/')
    .replace(/(.)\/+$/, '$1');

/* ------------------------------------------------------------------ runtime stack walk */

function mountPrefix(layer: Layer): string {
  const cleaned = (layer.regexp?.source ?? '')
    .replace(/^\^/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '')
    .replace(/\$$/, '')
    .replace(/\\\//g, '/')
    .replace(/\?\(\?=\/\|\$\)/g, '');
  return cleaned === '/' || cleaned === '(?:/)?' ? '' : cleaned;
}

function registrations(app: unknown): string[] {
  const found: string[] = [];
  const walk = (stack: Layer[], prefix: string): void => {
    for (const layer of stack) {
      if (layer.route) {
        for (const method of Object.keys(layer.route.methods)) {
          if (method === '_all') continue;
          found.push(normalise(`${method.toUpperCase()} ${prefix}${layer.route.path}`));
        }
        continue;
      }
      if (layer.name === 'router' && layer.handle?.stack) {
        walk(layer.handle.stack, prefix + mountPrefix(layer));
      }
    }
  };
  const root = app as { _router?: { stack: Layer[] }; router?: { stack: Layer[] } };
  walk(root._router?.stack ?? root.router?.stack ?? [], '');
  return found;
}

/* ------------------------------------------------------------------ static middleware facts */

function staticFacts(): Map<string, RouteFacts[]> {
  const indexSrc = fs.readFileSync(path.join(SRC, 'routes', 'index.ts'), 'utf8');
  const mountOf = new Map<string, string[]>();
  for (const m of indexSrc.matchAll(/apiRouter\.use\((?:'([^']*)',\s*)?(\w+)\)/g)) {
    mountOf.set(m[2]!, [...(mountOf.get(m[2]!) ?? []), '/api/v1' + (m[1] ?? '')]);
  }
  mountOf.set('healthRouter', ['']);
  mountOf.set('webhookRouter', ['/api/v1/webhooks']);

  const byKey = new Map<string, RouteFacts[]>();
  const files = fs.readdirSync(path.join(SRC, 'routes')).filter((f) => f.endsWith('.routes.ts'));
  for (const file of files) {
    const text = fs.readFileSync(path.join(SRC, 'routes', file), 'utf8');
    const consts = new Map<string, string[]>();
    for (const m of text.matchAll(
      /^const (\w+) = (\[|authenticate\(|optionalAuth\(|requirePermission\()/gm,
    )) {
      const start = m.index! + m[0].length - 1;
      const body = text.slice(start, closeOf(text, start) + 1);
      consts.set(
        m[1]!,
        body.startsWith('[') ? splitTop(body.slice(1, -1)) : [m[2]!.slice(0, -1) + body],
      );
    }

    for (const m of text.matchAll(/\b(\w+Router)\.(get|post|put|patch|delete|all)\(/g)) {
      const open = m.index! + m[0].length - 1;
      const args = splitTop(stripComments(text.slice(open + 1, closeOf(text, open))));
      const rawPath = unquote(args[0] ?? '');
      const expand = (arg: string): string[] => {
        const found = consts.get(arg.replace(/^\.\.\./, ''));
        return found ? found.flatMap(expand) : [arg];
      };
      const facts: RouteFacts = {
        method: m[2]!.toUpperCase(),
        path: '',
        file: `backend/src/routes/${file}`,
        line: text.slice(0, m.index).split('\n').length,
        auth: 'public',
        allowPendingPasswordChange: false,
        csrf: false,
        permissions: [],
        anyPermissions: [],
        permissionExpression: null,
        rateLimit: null,
        idempotency: false,
        validation: [],
      };
      for (const mw of args.slice(1).flatMap(expand)) {
        let x: RegExpMatchArray | null;
        if ((x = mw.match(/^authenticate\('(\w+)'(.*)\)$/s))) {
          facts.auth = x[1] === 'ADMIN' ? 'session' : 'customer';
          facts.allowPendingPasswordChange = /allowPendingPasswordChange/.test(x[2]!);
        } else if ((x = mw.match(/^optionalAuth\('(\w+)'\)$/))) {
          facts.auth = x[1] === 'ADMIN' ? 'optional' : 'optional-customer';
        } else if (/^csrfProtection\(/.test(mw)) {
          facts.csrf = true;
        } else if ((x = mw.match(/^require(Any)?Permissions?\((.*)\)$/s))) {
          const codes = [...x[2]!.matchAll(/'([^']+)'/g)].map((p) => p[1]!);
          if (codes.length === 0) facts.permissionExpression = x[2]!.replace(/\s+/g, ' ').trim();
          if (x[1]) facts.anyPermissions.push(...codes);
          else facts.permissions.push(...codes);
        } else if ((x = mw.match(/^authRateLimit\('([^']+)'\)$/))) {
          facts.rateLimit = x[1]!;
        } else if (/^idempotency\(/.test(mw)) {
          facts.idempotency = true;
        } else if ((x = mw.match(/^validate\(\{(.*)\}\)$/s))) {
          facts.validation = splitTop(x[1]!).map((p) => p.replace(/\s+/g, ' '));
        }
      }
      for (const prefix of mountOf.get(m[1]!) ?? []) {
        const key = `${facts.method} ${normalise(prefix + rawPath)}`;
        byKey.set(key, [
          ...(byKey.get(key) ?? []),
          { ...facts, path: normalise(prefix + rawPath) },
        ]);
      }
    }
  }
  return byKey;
}

/* ------------------------------------------------------------------ main */

function main(): void {
  process.env.LOG_LEVEL ??= 'silent';
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createApp } = require(path.join(SRC, 'app')) as { createApp: () => unknown };
  const all = registrations(createApp());
  const unique = [...new Set(all)].sort();
  const duplicates = unique.filter((key) => all.indexOf(key) !== all.lastIndexOf(key));
  const facts = staticFacts();

  const routes = unique.map((key) => {
    const space = key.indexOf(' ');
    const method = key.slice(0, space);
    const routePath = key.slice(space + 1);
    const f = facts.get(key)?.[0];
    return {
      method,
      path: routePath,
      source: f ? `${f.file}:${f.line}` : null,
      auth: f?.auth ?? (routePath.startsWith('/api/v1') ? 'unknown' : 'public'),
      allowPendingPasswordChange: f?.allowPendingPasswordChange ?? false,
      csrf: f?.csrf ?? false,
      permissions: f?.permissions ?? [],
      anyPermissions: f?.anyPermissions ?? [],
      permissionExpression: f?.permissionExpression ?? null,
      rateLimit: f?.rateLimit ?? null,
      idempotency: f?.idempotency ?? false,
      validation: f?.validation ?? [],
    };
  });

  fs.writeFileSync(OUT!, JSON.stringify({ duplicates, routes }, null, 2));
  process.exit(0);
}

main();
