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
} from 'drizzle-orm/pg-core';
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
    classType: varchar('class_type', { length: 50 }), // 'mat' or 'reformer' for session packages
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
    packageId: uuid('package_id')
      .notNull()
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
  }),
);
