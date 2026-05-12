/**
 * Studio info read from environment variables set in Coolify.
 * All fields have safe fallbacks so the app never crashes on missing vars.
 */
export const STUDIO = {
  name:          process.env.STUDIO_NAME    ?? 'Paquita Pilates Reformer GbR',
  address:       process.env.STUDIO_ADDRESS ?? 'Haußmannstr. 126',
  city:          process.env.STUDIO_CITY    ?? '70188 Stuttgart',
  country:       process.env.STUDIO_COUNTRY ?? 'Germany',
  phone:         process.env.STUDIO_PHONE   ?? '',
  email:         process.env.STUDIO_EMAIL   ?? 'fgennari.studio@gmail.com',
  // Not in Coolify yet — add if needed, defaults are correct for Stuttgart GbR
  steuernummer:  process.env.STUDIO_STEUERNUMMER ?? '93150/09800',
  finanzamt:     process.env.STUDIO_FINANZAMT    ?? 'Finanzamt Stuttgart',
  partners:      process.env.STUDIO_PARTNERS     ?? '',
  website:       process.env.STUDIO_WEBSITE      ?? 'https://www.paquitapilatesreformer.de',
  bookingUrl:    process.env.NEXT_PUBLIC_APP_URL  ?? 'https://paquita.pilateq.de',
} as const;
