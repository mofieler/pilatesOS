import { pgTable, uuid, varchar, text, integer, boolean, timestamp, index, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';
import { userRoleEnum } from './enums';

// [FIX-1] users has deleted_at for soft-delete — never hard-delete users with financial history.
// All active-user queries MUST filter .where(isNull(users.deletedAt)).
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    avatarUrl: varchar('avatar_url', { length: 500 }),
    role: userRoleEnum('role').notNull().default('student'),

    // Auth.js v5 compatibility fields
    // [FIX-2] withTimezone: true on every timestamp column
    emailVerified: timestamp('email_verified', { withTimezone: true, mode: 'date' }),
    image: varchar('image', { length: 500 }),

    // Business logic flags
    firstMercyUsed: boolean('first_mercy_used').notNull().default(false),
    profileCompleted: boolean('profile_completed').notNull().default(false),

    // Gamification counters — pre-allocated for schema stability across phases
    totalClassesAttended: integer('total_classes_attended').notNull().default(0),
    currentStreak: integer('current_streak').notNull().default(0),
    longestStreak: integer('longest_streak').notNull().default(0),
    // [FIX-2] withTimezone: true
    streakLastUpdatedAt: timestamp('streak_last_updated_at', { withTimezone: true, mode: 'date' }),

    // Welcome Journey — new clients must complete a 1:1 intro session before
    // purchasing or booking any other package / class.
    welcomeCompletedAt: timestamp('welcome_completed_at', { withTimezone: true, mode: 'date' }),

    // [FIX-1] Soft-delete — DB-level RESTRICT FKs on financial tables act as the safety net.
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),

    // [FIX-2] withTimezone: true
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    roleIdx: index('users_role_idx').on(table.role),
    deletedAtIdx: index('users_deleted_at_idx').on(table.deletedAt),
  }),
);

// Auth.js v5 required tables.
// These are session/OAuth data — NOT financial records.
// They intentionally use onDelete: 'cascade' (user auth sessions can be dropped on user delete).
export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 255 }).notNull(),
    provider: varchar('provider', { length: 255 }).notNull(),
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: integer('expires_at'),
    tokenType: varchar('token_type', { length: 255 }),
    scope: varchar('scope', { length: 255 }),
    idToken: text('id_token'),
    sessionState: varchar('session_state', { length: 255 }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.provider, table.providerAccountId] }),
    userIdIdx: index('accounts_user_id_idx').on(table.userId),
  }),
);

export const sessions = pgTable(
  'sessions',
  {
    sessionToken: varchar('session_token', { length: 255 }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // [FIX-2] withTimezone: true
    expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => ({
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
  }),
);

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: varchar('identifier', { length: 255 }).notNull(),
    token: varchar('token', { length: 255 }).notNull(),
    // [FIX-2] withTimezone: true
    expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.identifier, table.token] }),
  }),
);
