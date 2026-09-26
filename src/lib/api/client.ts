import type { ApiMeta, PaginationMeta } from '@shared/types/api';
import type { AdminLoginResponse, AdminMeDto } from '@shared/types/auth';

import { API_BASE_URL, API_ROOT_URL } from '@/config/env';

import { fillPath, type EndpointDef, type PathParams } from './endpoint';
import { endpoints } from './endpoints';
import { ApiError } from './errors';
import { toQueryString, type QueryParams } from './query-string';
import { emitSessionEvent } from './session-events';
import { registerRefresher, renewSession } from './session-renewal';
import {
  CSRF_HEADER,
  DEFAULT_TIMEOUT_MS,
  IDEMPOTENCY_HEADER,
  LONG_TIMEOUT_MS,
  REQUEST_ID_HEADER,
  newRequestId,
  readCsrfToken,
} from './transport';

interface BaseRequestOptions {
  query?: QueryParams;
  /** JSON body. */
  body?: unknown;
  /** Multipart body (the browser sets the boundary). */
  form?: FormData;
  signal?: AbortSignal;
  /** Reuse the same key when retrying the same logical action. */
  idempotencyKey?: string;
  timeoutMs?: number;
  /** A successful non-JSON answer is returned as a Blob (CSV exports and templates). */
  download?: boolean;
  /**
   * Bytes sent so far for a multipart body. `fetch` cannot report upload progress, so the request
   * goes through XMLHttpRequest instead; headers, cookies and the answer are handled identically.
   */
  onUploadProgress?: (progress: UploadProgress) => void;
}

export interface UploadProgress {
  loaded: number;
  /** 0 when the browser cannot tell the body size. */
  total: number;
}

type ParamsOption<P extends string> =
  PathParams<P> extends undefined ? { params?: undefined } : { params: PathParams<P> };

export type RequestOptions<P extends string> = BaseRequestOptions & ParamsOption<P>;

type RequestArgs<P extends string> =
  PathParams<P> extends undefined ? [options?: RequestOptions<P>] : [options: RequestOptions<P>];

export interface ApiResult<T, M = ApiMeta | null> {
  data: T;
  meta: M;
  status: number;
  requestId: string;
  /** The API answered from its idempotency store (the action had already been applied). */
  replayed: boolean;
}

export interface Page<T> {
  items: T[];
  meta: PaginationMeta;
}

const RENEWABLE = new Set(['TOKEN_EXPIRED', 'NOT_AUTHENTICATED', 'TOKEN_INVALID']);

function urlFor(def: EndpointDef, options: BaseRequestOptions & { params?: unknown }): string {
  const base = def.base === 'root' ? API_ROOT_URL : API_BASE_URL;
  const params = options.params as Readonly<Record<string, string | number>> | undefined;
  return `${base}${fillPath(def.path, params)}${toQueryString(options.query)}`;
}

function retryAfterSeconds(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds));
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, Math.round((date - Date.now()) / 1000));
}

/** Non-JSON answers come from nginx or a crashed upstream, never from the API's error handler. */
function proxyErrorCode(status: number): string {
  if (status === 413) return 'PAYLOAD_TOO_LARGE_PROXY';
  if (status === 429) return 'RATE_LIMITED_PROXY';
  if (status === 504) return 'GATEWAY_TIMEOUT';
  if (status === 502 || status === 503) return 'UPSTREAM_UNAVAILABLE';
  return 'UNEXPECTED_RESPONSE';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function fileNameOf(disposition: string | null): string | null {
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

const NULL_BODY_STATUS = new Set([101, 204, 205, 304]);

function parseHeaders(raw: string): Headers {
  const headers = new Headers();
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const at = line.indexOf(':');
    if (at > 0) headers.append(line.slice(0, at).trim(), line.slice(at + 1).trim());
  }
  return headers;
}

/**
 * The same request as `fetch`, sent with XMLHttpRequest so the upload reports its progress. It
 * resolves to a standard Response, so the answer goes through exactly the same parsing.
 */
function xhrFetch(
  url: string,
  init: { method: string; headers: Headers; body?: BodyInit; signal: AbortSignal },
  onProgress: (progress: UploadProgress) => void,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const settle = (outcome: () => void) => {
      if (settled) return;
      settled = true;
      init.signal.removeEventListener('abort', onAbort);
      outcome();
    };
    const cancelled = () => new DOMException('The upload was cancelled.', 'AbortError');
    function onAbort() {
      settle(() => reject(cancelled()));
      xhr.abort();
    }
    xhr.open(init.method, url);
    xhr.withCredentials = true;
    init.headers.forEach((value, name) => xhr.setRequestHeader(name, value));
    xhr.upload.onprogress = (event) =>
      onProgress({ loaded: event.loaded, total: event.lengthComputable ? event.total : 0 });
    xhr.onload = () =>
      settle(() => {
        if (xhr.status === 0) {
          reject(new TypeError('Network request failed'));
          return;
        }
        resolve(
          new Response(NULL_BODY_STATUS.has(xhr.status) ? null : xhr.responseText, {
            status: xhr.status,
            statusText: xhr.statusText,
            headers: parseHeaders(xhr.getAllResponseHeaders()),
          }),
        );
      });
    xhr.onerror = () => settle(() => reject(new TypeError('Network request failed')));
    xhr.onabort = () => settle(() => reject(cancelled()));
    if (init.signal.aborted) {
      settle(() => reject(cancelled()));
      return;
    }
    init.signal.addEventListener('abort', onAbort, { once: true });
    xhr.send((init.body ?? null) as XMLHttpRequestBodyInit | null);
  });
}

async function send<T, M>(
  def: EndpointDef,
  options: BaseRequestOptions & { params?: unknown },
): Promise<ApiResult<T, M>> {
  const requestId = newRequestId();
  const headers = new Headers({ Accept: 'application/json', [REQUEST_ID_HEADER]: requestId });
  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }
  if (def.csrf) {
    const token = readCsrfToken();
    if (token) headers.set(CSRF_HEADER, token);
  }
  if (options.idempotencyKey) headers.set(IDEMPOTENCY_HEADER, options.idempotencyKey);

  const timeoutMs = options.timeoutMs ?? (def.long ? LONG_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const caller = options.signal;
  const forwardAbort = (): void => controller.abort(caller?.reason);
  if (caller?.aborted) controller.abort(caller.reason);
  else caller?.addEventListener('abort', forwardAbort, { once: true });

  const failure = (
    status: number,
    code: string,
    message: string,
    extra: Partial<ConstructorParameters<typeof ApiError>[0]> = {},
  ): ApiError =>
    new ApiError({
      status,
      code,
      message,
      requestId,
      method: def.method,
      path: def.path,
      ...extra,
    });

  try {
    let response: Response;
    try {
      response =
        options.onUploadProgress && options.form
          ? await xhrFetch(
              urlFor(def, options),
              { method: def.method, headers, body, signal: controller.signal },
              options.onUploadProgress,
            )
          : await fetch(urlFor(def, options), {
              method: def.method,
              headers,
              body,
              credentials: 'include',
              cache: 'no-store',
              signal: controller.signal,
            });
    } catch (cause) {
      if (caller?.aborted) throw cause;
      if (timedOut) {
        throw failure(0, 'TIMEOUT', 'The server took too long to answer.');
      }
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      throw failure(
        0,
        offline ? 'OFFLINE' : 'NETWORK_ERROR',
        offline ? 'You appear to be offline.' : 'The server could not be reached.',
      );
    }

    const traceId = response.headers.get(REQUEST_ID_HEADER);
    const isJson = (response.headers.get('content-type') ?? '').includes('application/json');
    if (options.download && response.ok && !isJson) {
      return {
        data: (await response.blob()) as T,
        meta: { fileName: fileNameOf(response.headers.get('content-disposition')) } as M,
        status: response.status,
        requestId,
        replayed: false,
      };
    }
    let payload: unknown = null;
    if (isJson) {
      try {
        payload = await response.json();
      } catch (cause) {
        if (caller?.aborted) throw cause;
        if (timedOut) throw failure(0, 'TIMEOUT', 'The server took too long to answer.');
        throw failure(
          response.status,
          'UNEXPECTED_RESPONSE',
          'The server sent an unreadable answer.',
          { traceId },
        );
      }
    }

    if (isRecord(payload) && payload.success === true && 'data' in payload) {
      return {
        data: payload.data as T,
        meta: (payload.meta ?? null) as M,
        status: response.status,
        requestId,
        replayed: response.headers.get('Idempotent-Replay') === 'true',
      };
    }

    if (isRecord(payload) && payload.success === false && isRecord(payload.error)) {
      const error = payload.error;
      throw failure(
        response.status,
        typeof error.code === 'string' ? error.code : 'UNEXPECTED_RESPONSE',
        typeof error.message === 'string' ? error.message : 'The request failed.',
        {
          details: error.details ?? null,
          traceId: typeof error.traceId === 'string' ? error.traceId : traceId,
          retryAfterSeconds: retryAfterSeconds(response.headers.get('Retry-After')),
        },
      );
    }

    throw failure(
      response.status,
      response.ok ? 'UNEXPECTED_RESPONSE' : proxyErrorCode(response.status),
      response.ok
        ? 'The server sent an unexpected answer.'
        : `The server answered ${response.status}.`,
      { traceId, retryAfterSeconds: retryAfterSeconds(response.headers.get('Retry-After')) },
    );
  } finally {
    clearTimeout(timer);
    caller?.removeEventListener('abort', forwardAbort);
  }
}

/**
 * The only function that talks to the ClearWood API.
 *
 * - one silent renewal and one retry after `401 TOKEN_EXPIRED | NOT_AUTHENTICATED | TOKEN_INVALID`
 *   (the API rejected the request before doing anything, so the retry is safe for mutations);
 * - one retry after `403 CSRF_TOKEN_INVALID` with the cookie re-read;
 * - `403 PASSWORD_CHANGE_REQUIRED` and `403 FORBIDDEN` are reported to the session layer.
 */
export async function apiRequest<T, M = ApiMeta | null, P extends string = string>(
  def: EndpointDef<P>,
  ...args: RequestArgs<P>
): Promise<ApiResult<T, M>> {
  const options = (args[0] ?? {}) as BaseRequestOptions & { params?: unknown };
  try {
    return await send<T, M>(def, options);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    if (error.status === 401 && def.renewSession && RENEWABLE.has(error.code)) {
      await renewSession();
      return send<T, M>(def, options);
    }
    if (error.status === 403 && error.code === 'CSRF_TOKEN_INVALID' && def.renewSession) {
      if (!readCsrfToken()) await renewSession();
      return send<T, M>(def, options);
    }
    if (error.status === 403 && error.code === 'PASSWORD_CHANGE_REQUIRED') {
      emitSessionEvent({ type: 'password-change-required' });
    } else if (error.status === 403 && error.code === 'FORBIDDEN') {
      emitSessionEvent({ type: 'forbidden' });
    }
    throw error;
  }
}

/** A paginated list: `{ items, meta: { page, limit, total, totalPages, hasNext } }`. */
export async function apiPage<T, P extends string = string>(
  def: EndpointDef<P>,
  ...args: RequestArgs<P>
): Promise<Page<T>> {
  const result = await apiRequest<T[], PaginationMeta, P>(def, ...args);
  return { items: result.data, meta: result.meta };
}

/** A file the API streams (CSV); errors still arrive as the usual JSON error body. */
export async function apiDownload<P extends string = string>(
  def: EndpointDef<P>,
  ...args: RequestArgs<P>
): Promise<{ blob: Blob; fileName: string | null }> {
  const options = { ...(args[0] ?? {}), download: true } as RequestOptions<P>;
  const result = await apiRequest<Blob, { fileName: string | null }, P>(
    def,
    ...([options] as RequestArgs<P>),
  );
  return { blob: result.data, fileName: result.meta.fileName };
}

/** Tokens in the body are ignored on purpose: the session lives in httpOnly cookies only. */
export function withoutTokens(response: AdminLoginResponse): AdminMeDto {
  return {
    user: response.user,
    roles: response.roles,
    permissions: response.permissions,
    mustChangePassword: response.mustChangePassword,
  };
}

registerRefresher(async () => {
  const result = await send<AdminLoginResponse, null>(endpoints.auth.refresh, { body: {} });
  return withoutTokens(result.data);
});
