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
    // [FIX-3] RESTRICT — bookings must not vanish when a session is deleted.
    // Use the session cancellation flow (which refunds credits first) instead.
    sessionId: uuid('session_id')
      .notNull()
      .references(() => classSessions.id, { onDelete: 'restrict' }),
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
  }),
);
