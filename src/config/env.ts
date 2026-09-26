/** Public, build-time settings. `NEXT_PUBLIC_*` values are inlined into the static bundle. */

const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';

/** Base of every `/api/v1` call: same-origin `/api/v1` unless the cross-origin option is used. */
export const API_BASE_URL = rawBase.replace(/\/+$/, '');

/** Origin-relative root for `/health` and `/ready`, which live outside `/api/v1`. */
export const API_ROOT_URL = API_BASE_URL.replace(/\/api\/v1$/, '');

export const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV || 'development';
export const IS_PRODUCTION_ENV = APP_ENV === 'production';

/** Empty until the storefront URL is confirmed; "View on storefront" links stay hidden. */
export const STOREFRONT_URL = (process.env.NEXT_PUBLIC_STOREFRONT_URL || '').replace(/\/+$/, '');

export const APP_NAME = 'ClearWood Admin';
