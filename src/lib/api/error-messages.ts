import { isAbortError, isApiError, type ApiError } from './errors';

export type ErrorTone = 'error' | 'warning' | 'info';
export type ErrorAction =
  'retry' | 'wait' | 'reload' | 'sign-in' | 'fix-input' | 'contact-admin' | 'none';

export interface ErrorPresentation {
  title: string;
  message: string;
  /** Trying the same thing again can succeed (network, overload, write race). */
  retryable: boolean;
  action: ErrorAction;
  tone: ErrorTone;
}

type Rule = Partial<ErrorPresentation> & { useServerMessage?: boolean };

/**
 * Plain-language copy for the codes the admin can meet. `useServerMessage` keeps the API's own
 * sentence where it is already written for people (domain rules name the exact problem).
 */
const BY_CODE: Record<string, Rule> = {
  NETWORK_ERROR: {
    title: 'Cannot reach the server',
    message: 'Check your internet connection and try again.',
    retryable: true,
    action: 'retry',
  },
  OFFLINE: {
    title: 'You are offline',
    message: 'Reconnect to the internet, then try again. Nothing was saved.',
    retryable: true,
    action: 'retry',
  },
  TIMEOUT: {
    title: 'The server took too long',
    message:
      'The request may still finish on the server. Refresh the page to check before trying again.',
    retryable: true,
    action: 'retry',
  },
  UPSTREAM_UNAVAILABLE: {
    title: 'The service is temporarily unavailable',
    message: 'The ClearWood API is not responding right now. Try again in a minute.',
    retryable: true,
    action: 'retry',
  },
  GATEWAY_TIMEOUT: {
    title: 'The server took too long',
    message: 'The request timed out on the way to the API. Try again in a minute.',
    retryable: true,
    action: 'retry',
  },
  SERVICE_UNAVAILABLE: {
    title: 'The service is temporarily unavailable',
    message: 'Try again in a minute.',
    retryable: true,
    action: 'retry',
  },
  PAYLOAD_TOO_LARGE_PROXY: {
    title: 'File too large',
    message:
      'The upload is larger than the server accepts. Upload fewer or smaller files at a time.',
    action: 'fix-input',
  },
  FILE_TOO_LARGE: { title: 'File too large', useServerMessage: true, action: 'fix-input' },
  PAYLOAD_TOO_LARGE: {
    title: 'Too much data',
    message: 'The request is larger than the server accepts. Send less at a time.',
    action: 'fix-input',
  },
  UNSUPPORTED_FILE_TYPE: {
    title: 'Unsupported file',
    message: "The file's contents are not a supported type.",
    action: 'fix-input',
  },
  RATE_LIMITED: {
    title: 'Too many requests',
    message: 'Too many requests came from this network. Wait a moment, then try again.',
    retryable: true,
    action: 'wait',
    tone: 'warning',
  },
  RATE_LIMITED_PROXY: {
    title: 'Too many requests',
    message: 'Too many requests came from this network. Wait a moment, then try again.',
    retryable: true,
    action: 'wait',
    tone: 'warning',
  },
  UNEXPECTED_RESPONSE: {
    title: 'Unexpected answer from the server',
    message:
      'The server sent something the admin did not expect. Try again, or report the reference below.',
    retryable: true,
    action: 'retry',
  },
  INTERNAL_SERVER_ERROR: {
    title: 'Something went wrong on our side',
    message: 'The server could not finish this request. Try again, or report the reference below.',
    retryable: true,
    action: 'retry',
  },
  DATABASE_ERROR: {
    title: 'The request could not be processed',
    message: 'Report the reference below if this keeps happening.',
    action: 'contact-admin',
  },
  INVALID_JSON: {
    title: 'The request could not be processed',
    message: 'Report the reference below if this keeps happening.',
    action: 'contact-admin',
  },
  BAD_REQUEST: { title: 'The request could not be processed', useServerMessage: true },

  SESSION_ENDED: {
    title: 'Your session has ended',
    message: 'Sign in again to continue.',
    action: 'sign-in',
    tone: 'warning',
  },
  NOT_AUTHENTICATED: {
    title: 'Please sign in',
    message: 'Your session has ended. Sign in again to continue.',
    action: 'sign-in',
    tone: 'warning',
  },
  TOKEN_EXPIRED: {
    title: 'Please sign in again',
    message: 'Your session has expired.',
    action: 'sign-in',
    tone: 'warning',
  },
  TOKEN_INVALID: {
    title: 'Please sign in again',
    message: 'Your session is no longer valid.',
    action: 'sign-in',
    tone: 'warning',
  },
  TOKEN_REUSE: {
    title: 'Signed out for your security',
    message:
      'Your session was used from two places at once, so every device was signed out. Sign in again.',
    action: 'sign-in',
    tone: 'warning',
  },
  INVALID_CREDENTIALS: { title: 'Incorrect details', useServerMessage: true, action: 'fix-input' },
  ACCOUNT_LOCKED: {
    title: 'Account temporarily locked',
    message: 'There were too many failed sign-in attempts. Try again later.',
    action: 'wait',
    tone: 'warning',
  },
  ACCOUNT_DISABLED: {
    title: 'Account not active',
    message: 'This admin account is suspended or disabled. Contact a Super Admin.',
    action: 'contact-admin',
  },
  PASSWORD_CHANGE_REQUIRED: {
    title: 'Choose a new password',
    message: 'You need to set a new password before you can continue.',
    action: 'none',
    tone: 'info',
  },
  CSRF_TOKEN_INVALID: {
    title: 'Your session needs refreshing',
    message: 'Reload the page and try again.',
    action: 'reload',
    tone: 'warning',
  },
  CORS_ORIGIN_NOT_ALLOWED: {
    title: 'This admin address is not allowed by the API',
    message:
      'The API does not accept requests from this web address. This is a deployment setting.',
    action: 'contact-admin',
  },
  FORBIDDEN: {
    title: "You don't have permission",
    message: "You don't have permission to perform this action. Ask a Super Admin if you need it.",
    action: 'contact-admin',
    tone: 'warning',
  },
  ROLE_NOT_GRANTABLE: {
    title: 'Role not allowed',
    useServerMessage: true,
    action: 'contact-admin',
  },
  ROLE_NOT_MANAGEABLE: {
    title: 'Role not allowed',
    useServerMessage: true,
    action: 'contact-admin',
  },
  ADMIN_USER_NOT_MANAGEABLE: {
    title: 'Not allowed',
    useServerMessage: true,
    action: 'contact-admin',
  },
  LAST_SUPER_ADMIN: { title: 'Not allowed', useServerMessage: true },
  NOT_FOUND: {
    title: 'Not found',
    message: 'This item no longer exists, or it was moved.',
    action: 'none',
    tone: 'warning',
  },
  STALE_RESOURCE: {
    title: 'Someone else changed this record',
    message: 'It was saved by someone else after you opened it. Reload to see their changes.',
    action: 'reload',
    tone: 'warning',
  },
  WRITE_CONFLICT: {
    title: 'Another change landed first',
    message: 'Try again: nothing was saved.',
    retryable: true,
    action: 'retry',
    tone: 'warning',
  },
  IDEMPOTENCY_IN_PROGRESS: {
    title: 'Still working on it',
    message: 'Your previous attempt is still being processed. Wait a moment before trying again.',
    retryable: true,
    action: 'wait',
    tone: 'info',
  },
  IDEMPOTENCY_KEY_REUSED: {
    title: 'Please try again',
    message: 'This attempt could not be matched to the previous one. Start the action again.',
    action: 'retry',
  },
  IMPORT_FILE_MISMATCH: { title: 'Different file', useServerMessage: true, action: 'fix-input' },
  IMPORT_NOT_VALIDATED: { title: 'Validate first', useServerMessage: true },
  CONFLICT: {
    title: 'Already in use',
    useServerMessage: true,
    action: 'fix-input',
    tone: 'warning',
  },
  PRODUCT_NOT_PUBLISHABLE: {
    title: 'Not ready to publish',
    message: 'Fix the items in the publishing checklist, then publish again.',
    action: 'fix-input',
    tone: 'warning',
  },
  CATEGORY_NOT_PURCHASABLE: {
    title: 'Category cannot hold products',
    message: 'Service categories are for enquiries only. Choose a product category.',
    action: 'fix-input',
  },
  VARIANT_COMBINATION_EXISTS: {
    title: 'That combination already exists',
    message:
      'Another variant already has exactly these options. Change an option or edit that variant.',
    action: 'fix-input',
    tone: 'warning',
  },
  ATTRIBUTE_NOT_VARIANT_DEFINING: {
    title: 'Option not allowed',
    message: 'Only attributes marked as defining variants can be used as variant options.',
    action: 'fix-input',
  },
  VARIANT_OPTIONS_INCONSISTENT: {
    title: 'Options do not match',
    message: 'Every variant of a product must use the same set of options.',
    action: 'fix-input',
  },
  VARIANT_MATRIX_TOO_LARGE: {
    title: 'Too many combinations',
    useServerMessage: true,
    action: 'fix-input',
  },
  VARIANT_RESERVED: {
    title: 'Stock is reserved',
    message: 'This variant has stock reserved for open orders, so it cannot be deleted yet.',
    tone: 'warning',
  },
  INVENTORY_CONFLICT: {
    title: 'Stock changed meanwhile',
    message: 'The stock changed after you opened it. Check the new balance, then adjust again.',
    action: 'reload',
    tone: 'warning',
  },
  INSUFFICIENT_STOCK: {
    title: 'Not enough stock',
    message: 'This would take stock below zero, and back-orders are off for this variant.',
    action: 'fix-input',
  },
  STOCK_BELOW_RESERVED: {
    title: 'Below reserved stock',
    message: 'Stock cannot go below what is reserved for open orders.',
    action: 'fix-input',
  },
  COLLECTION_NOT_MANUAL: {
    title: 'Automatic collection',
    message: 'Products join an automatic collection through its rules, not by hand.',
    tone: 'warning',
  },
  BRAND_IN_USE: {
    title: 'Brand still in use',
    message:
      'Move its products to another brand first (Products › filter by brand › bulk “Set brand”).',
    tone: 'warning',
  },
  TAX_CLASS_IN_USE: {
    title: 'Tax class still in use',
    message: 'Products still use this tax class. Move them to another class first.',
    tone: 'warning',
  },
  TAX_CLASS_DEFAULT: {
    title: 'Default tax class',
    message: 'Make another tax class the default before removing this one.',
    tone: 'warning',
  },
  ATTRIBUTE_GROUP_IN_USE: {
    title: 'Group still has attributes',
    message: 'Move or delete its attributes first.',
    tone: 'warning',
  },
  ATTRIBUTE_IN_USE: { title: 'Still in use', useServerMessage: true, tone: 'warning' },
  ATTRIBUTE_VARIANT_LOCK: {
    title: 'Variants depend on this',
    useServerMessage: true,
    tone: 'warning',
  },
  MEDIA_IN_USE: {
    title: 'Image still in use',
    message: 'Remove it from the products and pages that use it before deleting it for good.',
    tone: 'warning',
  },
  VALIDATION_ERROR: {
    title: 'Check the highlighted fields',
    useServerMessage: true,
    action: 'fix-input',
    tone: 'warning',
  },
};

const BY_STATUS: Record<number, Rule> = {
  400: { title: 'The request could not be processed', action: 'contact-admin' },
  401: BY_CODE.NOT_AUTHENTICATED!,
  403: BY_CODE.FORBIDDEN!,
  404: BY_CODE.NOT_FOUND!,
  409: { title: 'This conflicts with the current data', action: 'reload', tone: 'warning' },
  413: BY_CODE.PAYLOAD_TOO_LARGE!,
  415: BY_CODE.UNSUPPORTED_FILE_TYPE!,
  422: BY_CODE.VALIDATION_ERROR!,
  429: BY_CODE.RATE_LIMITED!,
  500: BY_CODE.INTERNAL_SERVER_ERROR!,
  502: BY_CODE.UPSTREAM_UNAVAILABLE!,
  503: BY_CODE.UPSTREAM_UNAVAILABLE!,
  504: BY_CODE.GATEWAY_TIMEOUT!,
};

const FALLBACK: ErrorPresentation = {
  title: 'Something went wrong',
  message: 'Try again. If it keeps happening, report the reference below.',
  retryable: true,
  action: 'retry',
  tone: 'error',
};

function waitHint(error: ApiError): string | null {
  if (error.retryAfterSeconds === null || error.retryAfterSeconds <= 0) return null;
  const s = error.retryAfterSeconds;
  return s < 90 ? `Try again in ${s} seconds.` : `Try again in about ${Math.ceil(s / 60)} minutes.`;
}

function lockedHint(error: ApiError): string | null {
  const until = (error.details as { lockedUntil?: unknown } | null)?.lockedUntil;
  if (typeof until !== 'string') return null;
  const date = new Date(until);
  if (Number.isNaN(date.getTime())) return null;
  const time = new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  }).format(date);
  return `Try again after ${time} IST, or ask a Super Admin to reset your password.`;
}

/** What to tell a person about an error. Diagnostics (code, reference) are shown separately. */
export function describeError(error: unknown): ErrorPresentation {
  if (isAbortError(error)) {
    return { ...FALLBACK, title: 'Cancelled', message: 'The request was cancelled.', tone: 'info' };
  }
  if (!isApiError(error)) return FALLBACK;

  const rule = BY_CODE[error.code] ?? BY_STATUS[error.status] ?? {};
  const serverSentence =
    error.status >= 400 && error.status < 500 && error.message ? error.message : null;
  const useServer = rule.useServerMessage ?? (!BY_CODE[error.code] && serverSentence !== null);

  let message = (useServer ? serverSentence : null) ?? rule.message ?? FALLBACK.message;
  const hint = error.code === 'ACCOUNT_LOCKED' ? lockedHint(error) : waitHint(error);
  if (hint) message = `${message} ${hint}`;

  return {
    title: rule.title ?? FALLBACK.title,
    message,
    retryable: rule.retryable ?? false,
    action: rule.action ?? (rule.retryable ? 'retry' : 'none'),
    tone: rule.tone ?? 'error',
  };
}

/** Reference an operator can quote to support: the API trace id, else our request id. */
export function errorReference(error: unknown): string | null {
  if (!isApiError(error)) return null;
  return error.traceId ?? error.requestId;
}

/** A per-item failure code from a bulk result, in words (the title of its error copy). */
export function humanizeCode(code: string | null): string {
  if (!code) return 'Failed';
  return (
    BY_CODE[code]?.title ??
    code
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/^./, (c) => c.toUpperCase())
  );
}
