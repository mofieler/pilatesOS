import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';

/**
 * Waivers — immutable signed-waiver records.
 *
 * Legal/liability requirement: every signed waiver MUST be persisted as its
 * own row with the IP, user agent, typed name, version of the waiver text,
 * and the precise timestamp. The boolean flag on users.hasSignedWaiver is a
 * fast lookup for the booking gate, but the legal evidence is here.
 *
 * [FIX-3] RESTRICT — waivers are legal records and must not vanish if the
 * user is removed. Soft-delete users; never hard-delete.
 *
 * No updatedAt / no soft-delete: a waiver is a moment-in-time record. If a
 * user re-signs after policy update, that's a NEW row with a different
 * waiverVersion, not an update.
 */
export const waivers = pgTable(
  'waivers',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    // Version string for the waiver text the user actually agreed to. When
    // the studio updates the waiver, bump this constant; old rows still
    // reference what those users signed.
    waiverVersion: varchar('waiver_version', { length: 32 }).notNull(),

    // Name the user typed into the form. Evidence of intent — required for
    // a digital signature to be considered binding in most jurisdictions.
    signedName: varchar('signed_name', { length: 255 }).notNull(),

    // [FIX-2] withTimezone: true
    signedAt: timestamp('signed_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),

    // Audit trail — populated server-side from request headers, NOT user input.
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index('waivers_user_id_idx').on(table.userId),
    signedAtIdx: index('waivers_signed_at_idx').on(table.signedAt),
  }),
);
