import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['student', 'instructor', 'admin']);

export const classTypeEnum = pgEnum('class_type', [
  'private',
  'duo',
  'group',
  'reformer',
  'mat',
  'online',
]);

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

export const creditTypeEnum = pgEnum('credit_type', ['standard', 'premium', 'vip']);

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
