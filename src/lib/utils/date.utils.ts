const STUDIO_TZ = 'Europe/Berlin';

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
function studioYmd(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: STUDIO_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const day = parts.find((p) => p.type === 'day')!.value;
  return `${y}-${m}-${day}`;
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
