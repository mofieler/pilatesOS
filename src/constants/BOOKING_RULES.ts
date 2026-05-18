/**
 * Booking Rules Constants
 * Centralized configuration for business rules
 */

export const CANCELLATION_WINDOW_HOURS = 24;

export const WAITLIST_ACCEPTANCE_WINDOW_MINUTES = 15;

export const MAX_BOOKINGS_PER_USER_PER_CLASS = 1;

export const MAX_WAITLIST_SIZE_PER_CLASS = 10;

export const CREDIT_EXPIRY_DAYS = 365;

// Replaces the lifetime FIRST_TIME_MERCY_AVAILABLE flag.
// Each user gets up to 3 "mercy" refunds per calendar month for cancellations
// inside the 24h window. Counter resets on the 1st of each month (Europe/Berlin).
export const MERCY_USES_PER_MONTH = 3;

export const STUDIO_TIMEZONE = 'Europe/Berlin';

// (Removed 2026-05-18) GROUP_FALLBACK_CLASS_TYPES — the fallback was a stopgap
// for the four-wallet system. With the unified 'pass' wallet, every group
// class draws from the same bucket, so no fallback set is needed. Cost is
// controlled by classTemplates.creditCost.
