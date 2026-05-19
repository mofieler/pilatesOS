import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const STUDIO_TZ = 'Europe/Berlin';

// ─── Studio-timezone-aware formatters (deterministic on SSR + client) ──────────

/**
 * Format a Date in the studio's timezone with a date-fns pattern.
 * Use this anywhere a class time/date is rendered. Never use `format()` from
 * date-fns directly on DB timestamps — that uses the process timezone (UTC in
 * the Coolify container) and produces 14:30 instead of 16:30.
 */
export function formatStudio(d: Date, pattern: string): string {
  return formatInTimeZone(d, STUDIO_TZ, pattern);
}

export function formatStudioDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: STUDIO_TZ,
  });
}

export function formatStudioTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
    timeZone: STUDIO_TZ,
  });
}

export function formatStudioDateShort(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
    timeZone: STUDIO_TZ,
  });
}

export function formatStudioDateWeekday(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: STUDIO_TZ,
  });
}

// Returns the Y-M-D string for `d` as observed in the studio's timezone.
// Used to compare calendar days across timezones without going through Date math.
export function studioYmd(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: STUDIO_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const day = parts.find((p) => p.type === 'day')!.value;
  return `${y}-${m}-${day}`;
}

/** Start of the current studio day as a UTC Date. */
export function startOfStudioDay(now: Date = new Date()): Date {
  const ymd = studioYmd(now);
  return fromZonedTime(`${ymd}T00:00:00`, STUDIO_TZ);
}

/** True if `a` and `b` are the same calendar day in the studio timezone. */
export function isStudioSameDay(a: Date, b: Date): boolean {
  return studioYmd(a) === studioYmd(b);
}

/** True if `d` is today in the studio timezone. */
export function isStudioToday(d: Date, now: Date = new Date()): boolean {
  return studioYmd(d) === studioYmd(now);
}

/** True if `d` falls in the current studio calendar week (Mon-Sun). */
export function isStudioThisWeek(d: Date, now: Date = new Date()): boolean {
  return studioMondayYmd(d) === studioMondayYmd(now);
}

function studioMondayYmd(d: Date): string {
  let currentDate = fromZonedTime(`${studioYmd(d)}T12:00:00`, STUDIO_TZ);
  let dow = parseInt(formatInTimeZone(currentDate, STUDIO_TZ, 'i'), 10); // 1=Mon
  while (dow !== 1) {
    currentDate.setUTCDate(currentDate.getUTCDate() - 1);
    dow = parseInt(formatInTimeZone(currentDate, STUDIO_TZ, 'i'), 10);
  }
  return studioYmd(currentDate);
}

// "Today" / "Tomorrow" / weekday+date label evaluated in the studio's timezone.
export function formatStudioRelativeDay(d: Date, now: Date = new Date()): string {
  const target = studioYmd(d);
  const today = studioYmd(now);
  const tomorrow = studioYmd(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  if (target === today) return 'Today';
  if (target === tomorrow) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', month: 'long', day: 'numeric',
    timeZone: STUDIO_TZ,
  });
}
