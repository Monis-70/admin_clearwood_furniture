export type QueryValue = string | number | boolean | Date | null | undefined;
export type QueryParams = Readonly<Record<string, QueryValue | readonly QueryValue[]>>;

function encodeValue(value: Exclude<QueryValue, null | undefined>): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/**
 * Empty strings, `null` and `undefined` are dropped so an untouched filter never reaches the API.
 * Keys are sorted, which keeps URLs (and therefore request dedupe and logs) stable.
 */
export function toQueryString(params: QueryParams | undefined): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const key of Object.keys(params).sort()) {
    const raw = params[key];
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      if (value === null || value === undefined || value === '') continue;
      search.append(key, encodeValue(value as Exclude<QueryValue, null | undefined>));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
