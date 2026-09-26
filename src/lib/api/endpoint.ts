import type { Permission } from '@shared/enums';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Who may call an endpoint, mirroring the backend guard. It drives UI gating only: the API is
 * always the authority and answers 401/403 on its own.
 */
export type EndpointAccess =
  | { readonly kind: 'public' }
  | { readonly kind: 'session' }
  | { readonly kind: 'permission'; readonly all: readonly Permission[] }
  | { readonly kind: 'any-permission'; readonly any: readonly Permission[] };

export interface EndpointDef<P extends string = string> {
  readonly method: HttpMethod;
  /** Relative to the API base (`/admin/auth/me`), or to the API root when `base` is `root`. */
  readonly path: P;
  readonly base: 'api' | 'root';
  readonly access: EndpointAccess;
  /** Cookie-authenticated mutation: the double-submit CSRF header is required. */
  readonly csrf: boolean;
  /** The route accepts an `Idempotency-Key`. */
  readonly idempotent: boolean;
  /** Imports, commits, uploads and exports run inside the request and need the long timeout. */
  readonly long: boolean;
  /** Whether a 401 may trigger one silent session renewal (never for the auth endpoints). */
  readonly renewSession: boolean;
}

type ParamNames<P extends string> = P extends `${string}{${infer Name}}${infer Rest}`
  ? Name | ParamNames<Rest>
  : never;

/** `{ id: string }` for `/admin/users/{id}`; `undefined` for a path without parameters. */
export type PathParams<P extends string> = [ParamNames<P>] extends [never]
  ? undefined
  : Readonly<Record<ParamNames<P>, string | number>>;

interface EndpointOptions {
  access: EndpointAccess;
  base?: 'api' | 'root';
  idempotent?: boolean;
  long?: boolean;
  renewSession?: boolean;
}

export function endpoint<const P extends string>(
  method: HttpMethod,
  path: P,
  options: EndpointOptions,
): EndpointDef<P> {
  const mutating = method !== 'GET';
  return Object.freeze({
    method,
    path,
    base: options.base ?? 'api',
    access: options.access,
    csrf: mutating && options.access.kind !== 'public',
    idempotent: options.idempotent ?? false,
    long: options.long ?? false,
    renewSession: options.renewSession ?? options.access.kind !== 'public',
  });
}

export const PUBLIC: EndpointAccess = Object.freeze({ kind: 'public' });
export const SESSION: EndpointAccess = Object.freeze({ kind: 'session' });

export function requires(...all: Permission[]): EndpointAccess {
  return Object.freeze({ kind: 'permission', all });
}

export function requiresAny(...any: Permission[]): EndpointAccess {
  return Object.freeze({ kind: 'any-permission', any });
}

/** Fills `{name}` placeholders; every value is URL-encoded exactly once. */
export function fillPath(
  path: string,
  params: Readonly<Record<string, string | number>> | undefined,
): string {
  return path.replace(/\{([A-Za-z0-9_]+)\}/g, (_match, name: string) => {
    const value = params?.[name];
    if (value === undefined || value === '') {
      throw new Error(`Missing path parameter "${name}" for ${path}`);
    }
    return encodeURIComponent(String(value));
  });
}
