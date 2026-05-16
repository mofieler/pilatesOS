/**
 * Booking Rules Constants
 * Centralized configuration for business rules
 */

export const CANCELLATION_WINDOW_HOURS = 24;

export const WAITLIST_ACCEPTANCE_WINDOW_MINUTES = 15;

export const MAX_BOOKINGS_PER_USER_PER_CLASS = 1;

export const MAX_WAITLIST_SIZE_PER_CLASS = 10;

export const CREDIT_EXPIRY_DAYS = 365;

export const FIRST_TIME_MERCY_AVAILABLE = true;

export const STUDIO_TIMEZONE = 'Europe/Berlin';

// Class types where group credits are accepted as a fallback when the primary
// credit type balance is insufficient. Must stay in sync between the booking
// action (server) and the booking page display (client).
export const GROUP_FALLBACK_CLASS_TYPES = new Set([
  'reformer_group',
  'mat_group',
  'chair',
  'online',
  'yoga',
  'sound_healing',
] as const);
