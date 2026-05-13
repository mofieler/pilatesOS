import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['student', 'instructor', 'admin']);

export const classTypeEnum = pgEnum('class_type', [
  'reformer_group',   // Group class on the reformer
  'reformer_private', // 1-on-1 private reformer session
  'reformer_duo',     // 2-person reformer session
  'mat_group',        // Group mat Pilates class
  'mat_private',      // 1-on-1 private mat session
  'mat_duo',          // 2-person mat session
  'online',           // Virtual / online class
  'sound_healing',    // Sound healing session
]);

export const sessionTypeEnum = pgEnum('session_type', ['group', 'private']);

export const intensityLevelEnum = pgEnum('intensity_level', ['low', 'medium', 'high', 'varied']);

export const sessionStatusEnum = pgEnum('session_status', [
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
]);

export const bookingStatusEnum = pgEnum('booking_status', [
  'confirmed',
  'cancelled',
  'attended',
  'no_show',
  'waitlisted',
]);

export const cancellationTypeEnum = pgEnum('cancellation_type', [
  'user_cancelled',
  'instructor_cancelled',
  'admin_cancelled',
]);

export const creditTypeEnum = pgEnum('credit_type', [
  'reformer', // debited for any reformer_* class type
  'mat',      // debited for mat_*, online, and sound_healing class types
]);

export const creditTransactionTypeEnum = pgEnum('credit_transaction_type', [
  'purchase',
  'debit',
  'refund',
  'manual_adjustment',
  'expiry',
]);

export const stripeTransactionStatusEnum = pgEnum('stripe_transaction_status', [
  'pending',
  'succeeded',
  'failed',
  'refunded',
]);

export const waitlistStatusEnum = pgEnum('waitlist_status', [
  'waiting',
  'offered',
  'confirmed',
  'expired',
  'cancelled',
]);

export const guestPassStatusEnum = pgEnum('guest_pass_status', ['active', 'redeemed', 'expired']);

export const paymentMethodEnum = pgEnum('payment_method', [
  'stripe',
  'pay_at_studio', 
  'bank_transfer',
  'cash',
  'sound_healing_credits'
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'failed',
  'cancelled',
  'overdue',
  'refunded'
]);

export const creditPackCategoryEnum = pgEnum('credit_pack_category', [
  'credit',   // Group class credit packages (mat_group, reformer_group, private_session tiers)
  'session',  // Private session packages (mat/reformer class types)
]);

export const vodStatusEnum = pgEnum('vod_status', [
  'processing',
  'published',
  'unlisted',
  'archived',
]);

export const vodDifficultyEnum = pgEnum('vod_difficulty', ['beginner', 'intermediate', 'advanced']);

export const badgeTriggerTypeEnum = pgEnum('badge_trigger_type', [
  'classes_attended',
  'streak',
  'purchases',
  'special',
]);
