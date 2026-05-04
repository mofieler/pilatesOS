import { relations } from 'drizzle-orm';
import { users, accounts, sessions } from './users.schema';
import { instructors } from './instructors.schema';
import { classTemplates, classSessions } from './classes.schema';
import { bookings } from './bookings.schema';
import { waitlistEntries } from './waitlist.schema';
import { creditPackages, creditBalances, creditTransactions } from './credits.schema';

// ─── users ───────────────────────────────────────────────────────────────────
// creditTransactions has two FKs → users (userId + processedBy).
// Drizzle requires explicit relationName to disambiguate both sides.
export const usersRelations = relations(users, ({ one, many }) => ({
  instructor: one(instructors, {
    fields: [users.id],
    references: [instructors.userId],
  }),
  bookings: many(bookings),
  creditBalances: many(creditBalances),
  creditTransactions: many(creditTransactions, { relationName: 'transaction_owner' }),
  processedCreditTransactions: many(creditTransactions, { relationName: 'transaction_processor' }),
  waitlistEntries: many(waitlistEntries),
  accounts: many(accounts),
  sessions: many(sessions),
}));

// ─── instructors ─────────────────────────────────────────────────────────────
export const instructorsRelations = relations(instructors, ({ one, many }) => ({
  user: one(users, {
    fields: [instructors.userId],
    references: [users.id],
  }),
  classTemplates: many(classTemplates),
  classSessions: many(classSessions),
}));

// ─── accounts / sessions (Auth.js) ───────────────────────────────────────────
export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

// ─── classTemplates ──────────────────────────────────────────────────────────
export const classTemplatesRelations = relations(classTemplates, ({ one, many }) => ({
  instructor: one(instructors, {
    fields: [classTemplates.instructorId],
    references: [instructors.id],
  }),
  classSessions: many(classSessions),
}));

// ─── classSessions ───────────────────────────────────────────────────────────
export const classSessionsRelations = relations(classSessions, ({ one, many }) => ({
  template: one(classTemplates, {
    fields: [classSessions.templateId],
    references: [classTemplates.id],
  }),
  instructor: one(instructors, {
    fields: [classSessions.instructorId],
    references: [instructors.id],
  }),
  cancelledByUser: one(users, {
    fields: [classSessions.cancelledBy],
    references: [users.id],
  }),
  bookings: many(bookings),
  waitlistEntries: many(waitlistEntries),
}));

// ─── bookings ────────────────────────────────────────────────────────────────
export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  user: one(users, { fields: [bookings.userId], references: [users.id] }),
  session: one(classSessions, { fields: [bookings.sessionId], references: [classSessions.id] }),
  creditTransactions: many(creditTransactions),
}));

// ─── waitlistEntries ─────────────────────────────────────────────────────────
export const waitlistEntriesRelations = relations(waitlistEntries, ({ one }) => ({
  user: one(users, { fields: [waitlistEntries.userId], references: [users.id] }),
  session: one(classSessions, {
    fields: [waitlistEntries.sessionId],
    references: [classSessions.id],
  }),
}));

// ─── creditPackages ──────────────────────────────────────────────────────────
export const creditPackagesRelations = relations(creditPackages, ({ many }) => ({
  creditTransactions: many(creditTransactions),
}));

// ─── creditBalances ──────────────────────────────────────────────────────────
export const creditBalancesRelations = relations(creditBalances, ({ one }) => ({
  user: one(users, { fields: [creditBalances.userId], references: [users.id] }),
}));

// ─── creditTransactions ──────────────────────────────────────────────────────
// Two FKs → users: userId (the account owner) + processedBy (the admin who made a manual adjustment).
// Both need explicit relationName so Drizzle knows which FK each relation uses.
export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  user: one(users, {
    fields: [creditTransactions.userId],
    references: [users.id],
    relationName: 'transaction_owner',
  }),
  processedByUser: one(users, {
    fields: [creditTransactions.processedBy],
    references: [users.id],
    relationName: 'transaction_processor',
  }),
  booking: one(bookings, {
    fields: [creditTransactions.bookingId],
    references: [bookings.id],
  }),
  package: one(creditPackages, {
    fields: [creditTransactions.packageId],
    references: [creditPackages.id],
  }),
}));
