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
