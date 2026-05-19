import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { bookingStatusEnum, cancellationTypeEnum, creditTypeEnum } from './enums';
import { users } from './users.schema';
import { classSessions } from './classes.schema';

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // [FIX-3] RESTRICT — booking records are financial. Silent deletion via user cascade is prohibited.
    // Use soft-delete on users; this FK blocks any hard-delete attempt at the DB level.
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    // SET NULL — when a cancelled session is hard-deleted, booking records survive
    // with sessionId = NULL. The credit_transactions table is the authoritative audit trail.
    sessionId: uuid('session_id')
      .references(() => classSessions.id, { onDelete: 'set null' }),
    status: bookingStatusEnum('status').notNull().default('confirmed'),
    cancellationType: cancellationTypeEnum('cancellation_type'),
    mercyApplied: boolean('mercy_applied').notNull().default(false),
    creditsSpent: integer('credits_spent').notNull(),
    creditType: creditTypeEnum('credit_type').notNull(),
    // [FIX-2] withTimezone: true
    bookedAt: timestamp('booked_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }),
    cancellationReason: text('cancellation_reason'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // One booking per user per session
    uniqueBooking: uniqueIndex('bookings_user_session_unique_idx').on(table.userId, table.sessionId),
    userIdIdx: index('bookings_user_id_idx').on(table.userId),
    sessionIdIdx: index('bookings_session_id_idx').on(table.sessionId),
    statusIdx: index('bookings_status_idx').on(table.status),
    // For dashboard queries: "my upcoming confirmed bookings"
    userStatusIdx: index('bookings_user_status_idx').on(table.userId, table.status),
    // Composite for session student lookups
    sessionStatusIdx: index('bookings_session_status_idx').on(table.sessionId, table.status),
    // For statistics aggregation by status + time range
    statusCreatedAtIdx: index('bookings_status_created_at_idx').on(table.status, table.createdAt),
    // For ordering students by booking time
    bookedAtIdx: index('bookings_booked_at_idx').on(table.bookedAt),
  }),
);
