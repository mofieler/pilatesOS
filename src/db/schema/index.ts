// ─── Tables ───────────────────────────────────────────────────────────────────
export * from './users.schema';
export * from './instructors.schema';
export * from './classes.schema';
export * from './bookings.schema';
export * from './waitlist.schema';
export * from './credits.schema';
export * from './waivers.schema';
export * from './calendar.schema';

// ─── Enums ────────────────────────────────────────────────────────────────────
export * from './enums';

// ─── Relations ────────────────────────────────────────────────────────────────
export * from './relations';

// ─── Drizzle-inferred types ───────────────────────────────────────────────────
// Never define manual interfaces that duplicate these.
// Import these types throughout the application instead of writing your own.
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { users, accounts, sessions, verificationTokens } from './users.schema';
import type { instructors } from './instructors.schema';
import type { classTemplates, classSessions } from './classes.schema';
import type { bookings } from './bookings.schema';
import type { waitlistEntries } from './waitlist.schema';
import type { creditPackages, creditBalances, creditTransactions, creditPurchases, creditAdjustments } from './credits.schema';
import type { waivers } from './waivers.schema';
import type { calendarConnections, externalCalendarBlocks } from './calendar.schema';
import type {
  userRoleEnum,
  classTypeEnum,
  intensityLevelEnum,
  creditTypeEnum,
  bookingStatusEnum,
  sessionStatusEnum,
  cancellationTypeEnum,
  waitlistStatusEnum,
  creditTransactionTypeEnum,
  stripeTransactionStatusEnum,
  guestPassStatusEnum,
  vodStatusEnum,
  vodDifficultyEnum,
  badgeTriggerTypeEnum,
} from './enums';

// Auth / user tables
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Account = InferSelectModel<typeof accounts>;
export type NewAccount = InferInsertModel<typeof accounts>;

export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;

export type VerificationToken = InferSelectModel<typeof verificationTokens>;
export type NewVerificationToken = InferInsertModel<typeof verificationTokens>;

// Instructors
export type Instructor = InferSelectModel<typeof instructors>;
export type NewInstructor = InferInsertModel<typeof instructors>;

// Classes
export type ClassTemplate = InferSelectModel<typeof classTemplates>;
export type NewClassTemplate = InferInsertModel<typeof classTemplates>;

export type ClassSession = InferSelectModel<typeof classSessions>;
export type NewClassSession = InferInsertModel<typeof classSessions>;

// Bookings
export type Booking = InferSelectModel<typeof bookings>;
export type NewBooking = InferInsertModel<typeof bookings>;

// Waitlist
export type WaitlistEntry = InferSelectModel<typeof waitlistEntries>;
export type NewWaitlistEntry = InferInsertModel<typeof waitlistEntries>;

// Credits
export type CreditPackage = InferSelectModel<typeof creditPackages>;
export type NewCreditPackage = InferInsertModel<typeof creditPackages>;

export type CreditBalance = InferSelectModel<typeof creditBalances>;
export type NewCreditBalance = InferInsertModel<typeof creditBalances>;

export type CreditTransaction = InferSelectModel<typeof creditTransactions>;
export type NewCreditTransaction = InferInsertModel<typeof creditTransactions>;

export type CreditPurchase = InferSelectModel<typeof creditPurchases>;
export type NewCreditPurchase = InferInsertModel<typeof creditPurchases>;

export type CreditAdjustment = InferSelectModel<typeof creditAdjustments>;
export type NewCreditAdjustment = InferInsertModel<typeof creditAdjustments>;

// Waivers
export type Waiver = InferSelectModel<typeof waivers>;
export type NewWaiver = InferInsertModel<typeof waivers>;

// Calendar
export type CalendarConnection = InferSelectModel<typeof calendarConnections>;
export type NewCalendarConnection = InferInsertModel<typeof calendarConnections>;

export type ExternalCalendarBlock = InferSelectModel<typeof externalCalendarBlocks>;
export type NewExternalCalendarBlock = InferInsertModel<typeof externalCalendarBlocks>;

// ─── Enum value types — use these instead of raw strings ─────────────────────
export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type ClassType = (typeof classTypeEnum.enumValues)[number];
export type IntensityLevel = (typeof intensityLevelEnum.enumValues)[number];
export type CreditType = (typeof creditTypeEnum.enumValues)[number];
export type BookingStatus = (typeof bookingStatusEnum.enumValues)[number];
export type SessionStatus = (typeof sessionStatusEnum.enumValues)[number];
export type CancellationType = (typeof cancellationTypeEnum.enumValues)[number];
export type WaitlistStatus = (typeof waitlistStatusEnum.enumValues)[number];
export type TransactionType = (typeof creditTransactionTypeEnum.enumValues)[number];
export type StripeTransactionStatus = (typeof stripeTransactionStatusEnum.enumValues)[number];
export type GuestPassStatus = (typeof guestPassStatusEnum.enumValues)[number];
export type VodStatus = (typeof vodStatusEnum.enumValues)[number];
export type VodDifficulty = (typeof vodDifficultyEnum.enumValues)[number];
export type BadgeTriggerType = (typeof badgeTriggerTypeEnum.enumValues)[number];
