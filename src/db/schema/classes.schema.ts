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
} from 'drizzle-orm/pg-core';
import { classTypeEnum, creditTypeEnum, sessionStatusEnum } from './enums';
import { instructors } from './instructors.schema';
import { users } from './users.schema';

export const classTemplates = pgTable(
  'class_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    classType: classTypeEnum('class_type').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    maxCapacity: integer('max_capacity').notNull(),
    creditCost: integer('credit_cost').notNull(),
    // Credit type based on class type:
    // - mat_group: for group mat classes
    // - reformer_group: for group reformer classes  
    // - private_session: for private sessions (1:1 or 1:2)
    creditType: creditTypeEnum('credit_type').notNull(),
    // [FIX-3] SET NULL — if an instructor is removed, templates survive as orphaned records
    instructorId: uuid('instructor_id').references(() => instructors.id, { onDelete: 'set null' }),
    vibeTags: jsonb('vibe_tags').$type<string[]>().default([]),
    location: varchar('location', { length: 255 }),
    isActive: boolean('is_active').notNull().default(true),
    // [FIX-2] withTimezone: true
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    classTypeIdx: index('class_templates_type_idx').on(table.classType),
    isActiveIdx: index('class_templates_is_active_idx').on(table.isActive),
    instructorIdx: index('class_templates_instructor_idx').on(table.instructorId),
  }),
);

export const classSessions = pgTable(
  'class_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // [FIX-3] SET NULL — session record survives template deletion (for historical bookings)
    templateId: uuid('template_id').references(() => classTemplates.id, { onDelete: 'set null' }),
    instructorId: uuid('instructor_id').references(() => instructors.id, { onDelete: 'set null' }),
    // [FIX-2] withTimezone: true — critical for cross-timezone scheduling correctness
    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true, mode: 'date' }).notNull(),
    maxCapacity: integer('max_capacity').notNull(),
    bookedCount: integer('booked_count').notNull().default(0),
    waitlistCount: integer('waitlist_count').notNull().default(0),
    status: sessionStatusEnum('status').notNull().default('scheduled'),
    cancellationReason: text('cancellation_reason'),
    // [FIX-2] withTimezone: true
    cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }),
    // [FIX-3] SET NULL — admin/instructor who cancelled; nullable, auditable
    cancelledBy: uuid('cancelled_by').references(() => users.id, { onDelete: 'set null' }),

    // Google Calendar sync — populated when the instructor's account has an active
    // calendar connection and we've pushed an event. Null = not synced yet.
    // googleCalendarEventId is the event ID in the instructor's calendar.
    // googleCalendarId is the calendar this event lives in (may differ if instructor
    // reselects calendar — we use it to know where to PATCH/DELETE).
    googleCalendarEventId: text('google_calendar_event_id'),
    googleCalendarId: text('google_calendar_id'),
    // [FIX-2] withTimezone: true
    googleCalendarSyncedAt: timestamp('google_calendar_synced_at', {
      withTimezone: true,
      mode: 'date',
    }),
    googleCalendarSyncError: text('google_calendar_sync_error'),

    // [FIX-2] withTimezone: true
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    startsAtIdx: index('class_sessions_starts_at_idx').on(table.startsAt),
    statusIdx: index('class_sessions_status_idx').on(table.status),
    instructorIdx: index('class_sessions_instructor_idx').on(table.instructorId),
    // Composite index for the most common query: upcoming scheduled sessions
    scheduleIdx: index('class_sessions_schedule_idx').on(table.startsAt, table.status),
    // Retry-sweep worker queries sessions with non-null sync errors
    syncErrorIdx: index('class_sessions_sync_error_idx').on(table.googleCalendarSyncError),
  }),
);
