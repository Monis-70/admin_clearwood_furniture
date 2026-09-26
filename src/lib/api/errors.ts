/** Codes the client itself produces when there is no usable API error envelope. */
export type ClientErrorCode =
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'TIMEOUT'
  | 'PAYLOAD_TOO_LARGE_PROXY'
  | 'UPSTREAM_UNAVAILABLE'
  | 'GATEWAY_TIMEOUT'
  | 'RATE_LIMITED_PROXY'
  | 'UNEXPECTED_RESPONSE'
  | 'SESSION_ENDED';

export interface ApiErrorInit {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  traceId?: string | null;
  requestId: string;
  method: string;
  path: string;
  retryAfterSeconds?: number | null;
}

/**
 * Every failure of the API layer. `path` is the endpoint template (`/admin/users/{id}`), so
 * diagnostics never carry record identifiers; headers, cookies and CSRF tokens are never kept.
 */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly traceId: string | null;
  readonly requestId: string;
  readonly method: string;
  readonly path: string;
  readonly retryAfterSeconds: number | null;
  readonly occurredAt: string;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? null;
    this.traceId = init.traceId ?? null;
    this.requestId = init.requestId;
    this.method = init.method;
    this.path = init.path;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
    this.occurredAt = new Date().toISOString();
  }

  /** No HTTP response at all (offline, DNS, TLS, CORS preflight blocked, timeout). */
  get isNetworkFailure(): boolean {
    return this.status === 0;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function hasCode(error: unknown, ...codes: string[]): error is ApiError {
  return isApiError(error) && codes.includes(error.code);
}

/** Aborted by the caller (navigation, query cancellation): never shown to the user. */
export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}
