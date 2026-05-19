import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { 
  creditTypeEnum, 
  creditTransactionTypeEnum, 
  paymentMethodEnum, 
  paymentStatusEnum,
  creditPackCategoryEnum 
} from './enums';
import { users } from './users.schema';
import { bookings } from './bookings.schema';

export const creditPackages = pgTable(
  'credit_packages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    creditsAmount: integer('credits_amount').notNull(),
    creditType: creditTypeEnum('credit_type').notNull(),
    category: creditPackCategoryEnum('category').notNull().default('credit'),
    priceCents: integer('price_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('eur'),
    validityDays: integer('validity_days').notNull().default(365),
    validityWeeks: integer('validity_weeks').notNull().default(52),
    stripePriceId: varchar('stripe_price_id', { length: 255 }),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    // [FIX-2] withTimezone: true
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    isActiveIdx: index('credit_packages_is_active_idx').on(table.isActive),
    creditTypeIdx: index('credit_packages_credit_type_idx').on(table.creditType),
    categoryIdx: index('credit_packages_category_idx').on(table.category),
  }),
);

export const creditBalances = pgTable(
  'credit_balances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // [FIX-3] RESTRICT — credit balances are financial records; must not vanish silently.
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    creditType: creditTypeEnum('credit_type').notNull(),
    balance: integer('balance').notNull().default(0),
    // [FIX-2] withTimezone: true
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // One balance row per user per credit type (standard | premium | vip)
    uniqueBalance: uniqueIndex('credit_balances_user_type_unique_idx').on(
      table.userId,
      table.creditType,
    ),
    userIdIdx: index('credit_balances_user_id_idx').on(table.userId),
    expiresAtIdx: index('credit_balances_expires_at_idx').on(table.expiresAt),
  }),
);

export const creditTransactions = pgTable(
  'credit_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // [FIX-3] RESTRICT — ledger is immutable; user deletion must never destroy transaction history.
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    // SET NULL — transaction record survives if the booking is later cancelled/deleted
    bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
    // SET NULL — transaction record survives if the package is later deactivated/removed
    packageId: uuid('package_id').references(() => creditPackages.id, { onDelete: 'set null' }),
    type: creditTransactionTypeEnum('type').notNull(),
    creditType: creditTypeEnum('credit_type').notNull(),
    amount: integer('amount').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    description: text('description'),
    // SET NULL — who processed a manual adjustment; survives admin account removal
    processedBy: uuid('processed_by').references(() => users.id, { onDelete: 'set null' }),
    // [FIX-2] withTimezone: true — ledger timestamps must be unambiguous (audit + compliance)
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('credit_transactions_user_id_idx').on(table.userId),
    bookingIdIdx: index('credit_transactions_booking_id_idx').on(table.bookingId),
    typeIdx: index('credit_transactions_type_idx').on(table.type),
    // Composite index for cursor-based pagination: WHERE userId = ? AND createdAt < cursor
    userCreatedAtIdx: index('credit_transactions_user_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
  }),
);

// Credit purchases with payment tracking (Stripe + Pay at Studio + New Methods)
export const creditPurchases = pgTable(
  'credit_purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    // NULL for membership-based purchases (no discrete package, plan tracked via adminNotes)
    packageId: uuid('package_id')
      .references(() => creditPackages.id, { onDelete: 'restrict' }),
    creditsAmount: integer('credits_amount').notNull(),
    creditType: creditTypeEnum('credit_type').notNull(),
    priceCents: integer('price_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('eur'),
    
    // Payment method with new options including sound healing credits
    paymentMethod: paymentMethodEnum('payment_method').notNull().default('pay_at_studio'),
    
    // Payment status with refunded option
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('pending'),
    
    // Stripe fields (optional, for future Stripe integration)
    stripeSessionId: varchar('stripe_session_id', { length: 255 }),
    stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
    
    // Pay at studio fields
    paymentDueDate: timestamp('payment_due_date', { withTimezone: true, mode: 'date' }),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }),
    paidByUserId: uuid('paid_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    
    // Processing fee tracking
    processingFeeCents: integer('processing_fee_cents').default(0),
    
    // Admin notes for manual payments
    adminNotes: text('admin_notes'),

    // Invoice tracking (§14 UStG)
    invoiceNumber: varchar('invoice_number', { length: 50 }),
    invoiceIssuedAt: timestamp('invoice_issued_at', { withTimezone: true, mode: 'date' }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('credit_purchases_user_id_idx').on(table.userId),
    packageIdIdx: index('credit_purchases_package_id_idx').on(table.packageId),
    statusIdx: index('credit_purchases_status_idx').on(table.paymentStatus),
    methodIdx: index('credit_purchases_method_idx').on(table.paymentMethod),
    dueDateIdx: index('credit_purchases_due_date_idx').on(table.paymentDueDate),
    stripeSessionIdx: index('credit_purchases_stripe_session_idx').on(table.stripeSessionId),
    stripeSessionUniqueIdx: uniqueIndex('credit_purchases_stripe_session_unique_idx').on(table.stripeSessionId),
    invoiceNumberIdx: index('credit_purchases_invoice_number_idx').on(table.invoiceNumber),
    // Composite for billing status query: user + method + status
    userMethodStatusIdx: index('credit_purchases_user_method_status_idx').on(table.userId, table.paymentMethod, table.paymentStatus),
    createdAtIdx: index('credit_purchases_created_at_idx').on(table.createdAt),
  }),
);

// Membership plans — admin-defined recurring credit grants (weekly cadence).
// Admin sets weekly_credits + duration_weeks. The cron job reads user_memberships
// and tops up each member's balance every 7 days until ends_at.
export const membershipPlans = pgTable(
  'membership_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    creditType: creditTypeEnum('credit_type').notNull(),
    weeklyCredits: integer('weekly_credits').notNull(),
    durationWeeks: integer('duration_weeks').notNull(),
    priceCents: integer('price_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('eur'),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    isActiveIdx: index('membership_plans_is_active_idx').on(table.isActive),
    creditTypeIdx: index('membership_plans_credit_type_idx').on(table.creditType),
  }),
);

// Active user memberships — one row per active subscription.
// The weekly grant cron reads next_credit_grant_at to know when to top up.
export const userMemberships = pgTable(
  'user_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // [FIX-3] RESTRICT — membership is a financial record.
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => membershipPlans.id, { onDelete: 'restrict' }),
    creditType: creditTypeEnum('credit_type').notNull(),
    weeklyCredits: integer('weekly_credits').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true, mode: 'date' }).notNull(),
    // 'active' | 'paused' | 'cancelled' | 'expired'
    status: varchar('status', { length: 20 }).notNull().default('active'),
    lastCreditGrantAt: timestamp('last_credit_grant_at', { withTimezone: true, mode: 'date' }),
    nextCreditGrantAt: timestamp('next_credit_grant_at', { withTimezone: true, mode: 'date' }).notNull(),
    // Legal consent tracking — required for self-purchased memberships (§312j BGB, §356 IV BGB)
    selfPurchased: boolean('self_purchased').notNull().default(false),
    acceptedTermsAt: timestamp('accepted_terms_at', { withTimezone: true, mode: 'date' }),
    acceptedWithdrawalWaiverAt: timestamp('accepted_withdrawal_waiver_at', { withTimezone: true, mode: 'date' }),
    purchaseIpAddress: varchar('purchase_ip_address', { length: 45 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('user_memberships_user_id_idx').on(table.userId),
    planIdIdx: index('user_memberships_plan_id_idx').on(table.planId),
    // Cron sweep: WHERE status = 'active' AND next_credit_grant_at <= NOW()
    grantSweepIdx: index('user_memberships_grant_sweep_idx').on(
      table.status,
      table.nextCreditGrantAt,
    ),
  }),
);

// Credit lots — one row per "deposit" of credits (purchase, membership grant,
// admin adjustment). Lots are consumed in FIFO order by expires_at when a
// booking debits credits, so credits that expire soonest are used first.
// This replaces the single creditBalances.expiresAt column, which could only
// represent ONE expiry date per (user, credit_type) and silently overwrote
// older expiry dates on top-up.
export const creditLots = pgTable(
  'credit_lots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // [FIX-3] RESTRICT — financial record, never silently dropped
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    creditType: creditTypeEnum('credit_type').notNull(),
    // originalAmount is immutable; remainingAmount decrements on debit/expiry.
    originalAmount: integer('original_amount').notNull(),
    remainingAmount: integer('remaining_amount').notNull(),
    // Provenance — exactly one of these three is set per lot (or none for
    // legacy backfill lots). SET NULL on parent delete keeps the lot alive
    // for audit, but loses the reverse pointer.
    purchaseId: uuid('purchase_id').references(() => creditPurchases.id, { onDelete: 'set null' }),
    // membershipId / adjustmentId omitted in initial schema; both reference
    // tables that already exist. Added here once dual-write extends to those
    // grant paths in Sprint 4.
    // [FIX-2] tz-aware
    acquiredAt: timestamp('acquired_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    // 'active' | 'exhausted' | 'expired'
    // Status is denormalized for index-only filtering; remainingAmount=0 is the
    // canonical "exhausted" marker, expires_at <= NOW() the canonical "expired".
    status: varchar('status', { length: 16 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // FIFO query: WHERE user_id AND credit_type AND status='active' AND expires_at > NOW()
    // ORDER BY expires_at ASC FOR UPDATE
    fifoIdx: index('credit_lots_fifo_idx').on(
      t.userId,
      t.creditType,
      t.status,
      t.expiresAt,
    ),
    // Cron sweep: WHERE status='active' AND expires_at <= NOW()
    expirySweepIdx: index('credit_lots_expiry_sweep_idx').on(t.status, t.expiresAt),
    userIdx: index('credit_lots_user_idx').on(t.userId),
    remainingNonNeg: check('credit_lots_remaining_nonneg', sql`${t.remainingAmount} >= 0`),
    remainingLteOriginal: check('credit_lots_remaining_lte_original', sql`${t.remainingAmount} <= ${t.originalAmount}`),
    statusValid: check('credit_lots_status_valid', sql`${t.status} IN ('active','exhausted','expired')`),
  }),
);

// Manual credit adjustments — §147 AO audit trail for all admin-initiated changes.
// Records are immutable once written (never update, only insert).
export const creditAdjustments = pgTable(
  'credit_adjustments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // [FIX-3] RESTRICT — adjustment records are financial audit entries
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    // SET NULL — record survives admin account removal
    adminId: uuid('admin_id').references(() => users.id, { onDelete: 'set null' }),
    creditType: creditTypeEnum('credit_type').notNull(),
    amountDelta: integer('amount_delta').notNull(), // positive = add, negative = deduct
    reason: text('reason').notNull(),
    newBalance: integer('new_balance').notNull(), // immutable balance snapshot after adjustment
    notes: text('notes'),
    // [FIX-2] withTimezone: true — immutable audit timestamp
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('credit_adjustments_user_id_idx').on(table.userId),
    adminIdIdx: index('credit_adjustments_admin_id_idx').on(table.adminId),
    userCreatedAtIdx: index('credit_adjustments_user_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
  }),
);
