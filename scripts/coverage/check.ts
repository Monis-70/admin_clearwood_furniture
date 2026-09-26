/**
 * Pure checks behind `npm run coverage:check` (scripts/check-coverage.ts). Kept free of file
 * access so every failure mode is unit-tested with synthetic inventories.
 */
import type { CoverageEntry } from '../../src/config/api-coverage';
import type { EndpointDef } from '../../src/lib/api/endpoint';

export interface InventoryRoute {
  method: string;
  path: string;
  auth: string;
  csrf: boolean;
  permissions: string[];
  anyPermissions: string[];
  permissionExpression: string | null;
  idempotency: boolean;
}

export interface CoverageInput {
  inventory: { duplicates: string[]; routes: InventoryRoute[] };
  coverage: Readonly<Record<string, CoverageEntry>>;
  screenlessReasons: Readonly<Record<string, unknown>>;
  externalRoutes: Readonly<Record<string, unknown>>;
  registry: { name: string; def: EndpointDef }[];
  implementedThroughPhase: number;
  /** App routes that have a page, e.g. `/`, `/login`, `/system/status`. */
  appRoutes: ReadonlySet<string>;
}

export interface CoverageResult {
  failures: string[];
  warnings: string[];
  implemented: Set<string>;
  counts: Map<string, number>;
  adminRouteCount: number;
}

const ADMIN_PREFIX = '/api/v1/admin';
const API_PREFIX = '/api/v1';
const key = (method: string, fullPath: string): string => `${method} ${fullPath}`;
const phaseOf = (entry: CoverageEntry): number | null => (/^P\d+$/.test(entry.status) ? Number(entry.status.slice(1)) : null);

/** Collects `{ method, path, … }` leaves of the nested endpoint registry. */
export function flattenRegistry(node: unknown, trail: string[] = ['endpoints']): { name: string; def: EndpointDef }[] {
  if (node && typeof node === 'object' && 'method' in node && 'path' in node) {
    return [{ name: trail.join('.'), def: node as EndpointDef }];
  }
  return Object.entries(node as Record<string, unknown>).flatMap(([name, child]) =>
    flattenRegistry(child, [...trail, name]),
  );
}

export function screenTarget(screen: string): string | null {
  if (!screen.startsWith('/')) return null;
  return screen.split(/[?\s(]/)[0]!.replace(/(.)\/+$/, '$1');
}

export function checkCoverage(input: CoverageInput): CoverageResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  const fail = (message: string): void => void failures.push(message);
  const { inventory, coverage } = input;

  const byKey = new Map(inventory.routes.map((route) => [key(route.method, route.path), route]));
  const methodsByPath = new Map<string, string[]>();
  for (const route of inventory.routes) {
    methodsByPath.set(route.path, [...(methodsByPath.get(route.path) ?? []), route.method]);
  }

  for (const duplicate of inventory.duplicates) fail(`backend registers ${duplicate} more than once`);

  // 1. Classification is a bijection with the mounted admin routes.
  const adminRoutes = inventory.routes.filter((route) => route.path.startsWith(`${ADMIN_PREFIX}/`));
  for (const route of adminRoutes) {
    const coverageKey = key(route.method, route.path.slice(ADMIN_PREFIX.length));
    if (!coverage[coverageKey]) fail(`unclassified admin route: ${coverageKey} (add it to src/config/api-coverage.ts)`);
  }
  for (const [coverageKey, entry] of Object.entries(coverage)) {
    if (!/^P\d+$|^hold:[a-z]+$|^internal$/.test(entry.status)) {
      fail(`invalid status "${entry.status}" for ${coverageKey}`);
    } else if (phaseOf(entry) === null && !(entry.status in input.screenlessReasons)) {
      fail(`${coverageKey}: status ${entry.status} has no documented reason`);
    }
    const [method, suffix] = coverageKey.split(' ') as [string, string];
    const full = ADMIN_PREFIX + suffix;
    if (byKey.has(key(method, full))) continue;
    const others = methodsByPath.get(full);
    fail(
      others
        ? `method mismatch: ${coverageKey} is classified but the backend mounts ${others.join('/')} ${suffix}`
        : `stale classification: ${coverageKey} (${entry.module}) is not mounted any more`,
    );
  }

  // 2. External routes the admin relies on still exist.
  for (const externalKey of Object.keys(input.externalRoutes)) {
    if (!byKey.has(externalKey)) fail(`external route used by the admin is not mounted: ${externalKey}`);
  }

  // 3. Registry: exists, may be used, mirrors the guard.
  const seen = new Map<string, string>();
  const implemented = new Set<string>();
  for (const { name, def } of input.registry) {
    const full = def.base === 'root' ? def.path : API_PREFIX + def.path;
    const routeKey = key(def.method, full);
    const first = seen.get(routeKey);
    if (first) fail(`${name} duplicates ${first} (${routeKey}); define each endpoint once`);
    seen.set(routeKey, name);

    const route = byKey.get(routeKey);
    if (!route) {
      const others = methodsByPath.get(full);
      fail(
        others
          ? `${name}: method mismatch, ${routeKey} is not mounted (the backend has ${others.join('/')})`
          : `${name}: stale endpoint, ${routeKey} is not mounted`,
      );
      continue;
    }

    if (full.startsWith(`${ADMIN_PREFIX}/`)) {
      const coverageKey = key(def.method, full.slice(ADMIN_PREFIX.length));
      const entry = coverage[coverageKey];
      implemented.add(coverageKey);
      if (entry && phaseOf(entry) === null) {
        fail(`${name}: calls ${coverageKey}, classified ${entry.status}: the admin must not use it`);
      } else if (entry && (phaseOf(entry) ?? 0) > input.implementedThroughPhase) {
        warnings.push(`${name}: wired before its phase (${entry.status})`);
      }
    } else if (!input.externalRoutes[routeKey]) {
      fail(`${name}: calls ${routeKey}, which is not listed in EXTERNAL_ROUTES_USED`);
    }

    const access = def.access;
    if (route.auth === 'public' && access.kind !== 'public') fail(`${name}: backend route is public but the registry says ${access.kind}`);
    if (route.auth !== 'public' && access.kind === 'public') fail(`${name}: backend route requires ${route.auth} but the registry says public`);
    if (access.kind === 'permission') {
      const expected = [...route.permissions].sort().join(',');
      const actual = [...access.all].sort().join(',');
      if (expected !== actual) fail(`${name}: permissions [${actual}] differ from the backend guard [${expected}]`);
    } else if (access.kind === 'any-permission') {
      const actual = [...access.any].sort().join(',');
      if (route.permissionExpression) {
        warnings.push(`${name}: backend computes its permission list (${route.permissionExpression}); registry declares any of [${actual}]`);
      } else if ([...route.anyPermissions].sort().join(',') !== actual) {
        fail(`${name}: any-of permissions [${actual}] differ from the backend guard [${[...route.anyPermissions].sort().join(',')}]`);
      }
    } else if (access.kind === 'session' && (route.permissions.length > 0 || route.anyPermissions.length > 0)) {
      fail(`${name}: backend requires [${[...route.permissions, ...route.anyPermissions].join(', ')}] but the registry says any session`);
    }
    if (def.csrf !== route.csrf) {
      fail(`${name}: CSRF ${def.csrf ? 'sent' : 'not sent'} but the backend ${route.csrf ? 'requires' : 'does not check'} it`);
    }
    if (def.idempotent !== route.idempotency) {
      fail(`${name}: Idempotency-Key ${def.idempotent ? 'declared' : 'not declared'} but the backend ${route.idempotency ? 'supports' : 'does not support'} it`);
    }
  }

  // 4. Everything planned for an implemented phase is wired; 5. and has its page.
  for (const [coverageKey, entry] of Object.entries(coverage)) {
    const phase = phaseOf(entry);
    if (phase !== null && phase <= input.implementedThroughPhase && !implemented.has(coverageKey)) {
      fail(`missing UI wiring: ${coverageKey} is planned for P${phase} (${entry.screen}) but no endpoint calls it`);
    }
  }
  for (const coverageKey of implemented) {
    const entry = coverage[coverageKey];
    if (!entry) continue;
    for (const screen of entry.screen.split(/,\s*/)) {
      const target = screenTarget(screen);
      if (target && !input.appRoutes.has(target)) fail(`${coverageKey}: its screen ${target} has no page in src/app`);
    }
  }

  const counts = new Map<string, number>();
  for (const entry of Object.values(coverage)) counts.set(entry.status, (counts.get(entry.status) ?? 0) + 1);
  return { failures, warnings, implemented, counts, adminRouteCount: adminRoutes.length };
}
