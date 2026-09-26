const IST = 'Asia/Kolkata';

const dateTime = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: IST,
});

const dateOnly = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: IST,
});

const relative = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "25 Sep 2026, 15:07 IST" — the API sends UTC ISO strings; operators read IST. */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  empty = '—',
): string {
  const date = toDate(value);
  return date ? `${dateTime.format(date)} IST` : empty;
}

export function formatDate(value: string | number | Date | null | undefined, empty = '—'): string {
  const date = toDate(value);
  return date ? dateOnly.format(date) : empty;
}

/** "5 minutes ago": a secondary hint next to an absolute time, never on its own. */
export function formatRelative(
  value: string | number | Date | null | undefined,
  now = Date.now(),
): string {
  const date = toDate(value);
  if (!date) return '';
  const seconds = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'just now';
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), 'hour');
  if (abs < 30 * 86_400) return relative.format(Math.round(seconds / 86_400), 'day');
  return formatDate(date);
}

/** Uptime and durations: "3 d 4 h", "12 min", "45 s". */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '—';
  const s = Math.floor(totalSeconds);
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min`;
  return `${s} s`;
}

const integer = new Intl.NumberFormat('en-IN');

export function formatNumber(value: number | null | undefined, empty = '—'): string {
  return typeof value === 'number' && Number.isFinite(value) ? integer.format(value) : empty;
}

/** "1 row", "2,480 rows": a formatted count with the noun in the right number. */
export function formatCount(
  count: number | null | undefined,
  one: string,
  many = `${one}s`,
): string {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}

/** Part of the day in IST for greetings. */
export function greetingFor(now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: IST }).format(now),
  );
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
