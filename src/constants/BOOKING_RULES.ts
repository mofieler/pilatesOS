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

/**
 * Version string of the liability waiver text. Bump when the waiver text on
 * /waiver changes; existing signed-waiver rows preserve the version they
 * were signed under, so historical evidence stays accurate.
 */
export const WAIVER_VERSION = '2026-05-1';
