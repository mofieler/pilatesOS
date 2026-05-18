'use server';

import { db } from '@/db';
import {
  users, bookings, classSessions, classTemplates,
  creditTransactions, creditBalances, creditPurchases, creditAdjustments,
  instructors,
} from '@/db/schema';
import { desc, eq, and, gte, lte, isNull, inArray, count, sum, sql, lt } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { auth } from '@/lib/auth/auth';
import { startOfMonth, subDays } from 'date-fns';

// ─── Auth guard ────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'admin') {
    throw new Error('Unauthorized');
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityType =
  | 'booking_confirmed'
  | 'booking_cancelled_user'
  | 'booking_cancelled_admin'
  | 'credit_purchase'
  | 'credit_refund'
  | 'credit_adjustment';

export type ActivityItem = {
  id: string;
  type: ActivityType;
  timestamp: Date;
  userId: string;
  userName: string;
  userEmail: string;
  title: string;
  subtitle: string;
  meta: {
    credits?: number;
    creditType?: string;
    amountCents?: number;
    className?: string;
    reason?: string;
  };
};

export type SummaryStats = {
  bookingsThisMonth: number;
  revenueThisMonthCents: number;
  activeStudents: number;
  cancellationRatePercent: number;
};

export type StudentRow = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  passBalance: number;
  sessionBalance: number;
  totalBookings: number;
  upcomingBookings: number;
};

export type StudentDetail = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  passBalance: number;
  sessionBalance: number;
  recentBookings: {
    id: string;
    className: string;
    startsAt: Date;
    status: string;
    creditsSpent: number;
    creditType: string;
    cancellationType: string | null;
  }[];
  recentTransactions: {
    id: string;
    type: string;
    amount: number;
    balanceAfter: number;
    creditType: string;
    description: string | null;
    createdAt: Date;
  }[];
};

// ─── Summary stats ─────────────────────────────────────────────────────────────

export async function getSummaryStatsAction(): Promise<SummaryStats> {
  await requireAdmin();

  const monthStart = startOfMonth(new Date());
  const thirtyDaysAgo = subDays(new Date(), 30);

  const [bookingsMonth, revenue, activeStudents, cancelledMonth, totalMonth] = await Promise.all([
    // Confirmed bookings this month
    db.select({ n: count() }).from(bookings)
      .where(and(eq(bookings.status, 'confirmed'), gte(bookings.createdAt, monthStart)))
      .then(r => r[0]?.n ?? 0),

    // Revenue this month (credit purchases)
    db.select({ total: sum(creditPurchases.priceCents) }).from(creditPurchases)
      .where(gte(creditPurchases.createdAt, monthStart))
      .then(r => Number(r[0]?.total ?? 0)),

    // Active students (at least 1 confirmed booking in last 30 days)
    db.selectDistinct({ userId: bookings.userId }).from(bookings)
      .where(and(eq(bookings.status, 'confirmed'), gte(bookings.createdAt, thirtyDaysAgo)))
      .then(r => r.length),

    // Cancelled bookings this month
    db.select({ n: count() }).from(bookings)
      .where(and(eq(bookings.status, 'cancelled'), gte(bookings.createdAt, monthStart)))
      .then(r => r[0]?.n ?? 0),

    // All bookings this month (for rate calculation)
    db.select({ n: count() }).from(bookings)
      .where(gte(bookings.createdAt, monthStart))
      .then(r => r[0]?.n ?? 0),
  ]);

  const cancellationRatePercent = totalMonth > 0
    ? Math.round((Number(cancelledMonth) / Number(totalMonth)) * 100)
    : 0;

  return {
    bookingsThisMonth: Number(bookingsMonth),
    revenueThisMonthCents: revenue,
    activeStudents,
    cancellationRatePercent,
  };
}

// ─── Activity feed ─────────────────────────────────────────────────────────────

export async function getActivityFeedAction(fromDate: Date): Promise<ActivityItem[]> {
  await requireAdmin();

  const instructorUser = alias(users, 'instructor_user');

  // Fetch booking events
  const bookingRows = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      cancellationType: bookings.cancellationType,
      creditsSpent: bookings.creditsSpent,
      creditType: bookings.creditType,
      createdAt: bookings.createdAt,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      className: classTemplates.name,
    })
    .from(bookings)
    .innerJoin(users, and(eq(bookings.userId, users.id), isNull(users.deletedAt)))
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .leftJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
    .where(and(
      gte(bookings.createdAt, fromDate),
      inArray(bookings.status, ['confirmed', 'cancelled']),
    ))
    .orderBy(desc(bookings.createdAt))
    .limit(300);

  // Fetch credit transaction events
  const txRows = await db
    .select({
      id: creditTransactions.id,
      type: creditTransactions.type,
      amount: creditTransactions.amount,
      creditType: creditTransactions.creditType,
      description: creditTransactions.description,
      createdAt: creditTransactions.createdAt,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
    })
    .from(creditTransactions)
    .innerJoin(users, and(eq(creditTransactions.userId, users.id), isNull(users.deletedAt)))
    .where(and(
      gte(creditTransactions.createdAt, fromDate),
      inArray(creditTransactions.type, ['purchase', 'refund', 'manual_adjustment']),
    ))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(300);

  // Map bookings → ActivityItem
  const bookingItems: ActivityItem[] = bookingRows.map(r => {
    let type: ActivityType;
    if (r.status === 'confirmed') {
      type = 'booking_confirmed';
    } else if (r.cancellationType === 'admin_cancelled' || r.cancellationType === 'instructor_cancelled') {
      type = 'booking_cancelled_admin';
    } else {
      type = 'booking_cancelled_user';
    }

    const CREDIT_LABEL: Record<string, string> = { pass: 'Pass', session: 'Session' };
    const creditLabel = CREDIT_LABEL[r.creditType] ?? r.creditType;

    return {
      id: `booking-${r.id}`,
      type,
      timestamp: r.createdAt,
      userId: r.userId,
      userName: r.userName ?? '—',
      userEmail: r.userEmail ?? '—',
      title: type === 'booking_confirmed'
        ? `${r.userName} booked ${r.className ?? 'a class'}`
        : `${r.userName} cancelled ${r.className ?? 'a class'}`,
      subtitle: `${r.creditsSpent} ${creditLabel} credit${r.creditsSpent !== 1 ? 's' : ''}`,
      meta: {
        credits: r.creditsSpent,
        creditType: r.creditType,
        className: r.className ?? undefined,
      },
    };
  });

  // Map credit transactions → ActivityItem
  const txItems: ActivityItem[] = txRows.map(r => {
    let type: ActivityType;
    if (r.type === 'purchase') type = 'credit_purchase';
    else if (r.type === 'refund') type = 'credit_refund';
    else type = 'credit_adjustment';

    const CREDIT_LABEL: Record<string, string> = { pass: 'Pass', session: 'Session' };
    const creditLabel = CREDIT_LABEL[r.creditType] ?? r.creditType;
    const sign = r.amount >= 0 ? '+' : '';

    return {
      id: `tx-${r.id}`,
      type,
      timestamp: r.createdAt,
      userId: r.userId,
      userName: r.userName ?? '—',
      userEmail: r.userEmail ?? '—',
      title: type === 'credit_purchase'
        ? `${r.userName} purchased credits`
        : type === 'credit_refund'
          ? `Credit refund — ${r.userName}`
          : `Credit adjustment — ${r.userName}`,
      subtitle: `${sign}${r.amount} ${creditLabel} credits${r.description ? ` · ${r.description}` : ''}`,
      meta: {
        credits: r.amount,
        creditType: r.creditType,
        reason: r.description ?? undefined,
      },
    };
  });

  // Merge + sort by timestamp desc
  return [...bookingItems, ...txItems].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// ─── Student list ──────────────────────────────────────────────────────────────

export async function getStudentListAction(): Promise<StudentRow[]> {
  await requireAdmin();

  const now = new Date();

  // All active students
  const studentRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.role, 'student'), isNull(users.deletedAt)))
    .orderBy(desc(users.createdAt));

  if (studentRows.length === 0) return [];

  const userIds = studentRows.map(s => s.id);

  // Credit balances
  const balances = await db
    .select({ userId: creditBalances.userId, creditType: creditBalances.creditType, balance: creditBalances.balance })
    .from(creditBalances)
    .where(inArray(creditBalances.userId, userIds));

  // Total confirmed bookings per user
  const bookingCounts = await db
    .select({ userId: bookings.userId, n: count() })
    .from(bookings)
    .where(and(inArray(bookings.userId, userIds), eq(bookings.status, 'confirmed')))
    .groupBy(bookings.userId);

  // Upcoming bookings per user (session starts in future)
  const upcomingCounts = await db
    .select({ userId: bookings.userId, n: count() })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .where(and(
      inArray(bookings.userId, userIds),
      eq(bookings.status, 'confirmed'),
      gte(classSessions.startsAt, now),
    ))
    .groupBy(bookings.userId);

  // Build lookup maps
  const balanceMap = new Map<string, { pass: number; session: number }>();
  for (const b of balances) {
    if (!balanceMap.has(b.userId)) balanceMap.set(b.userId, { pass: 0, session: 0 });
    const entry = balanceMap.get(b.userId)!;
    if (b.creditType === 'pass') entry.pass = b.balance;
    else if (b.creditType === 'session') entry.session = b.balance;
  }

  const bookingCountMap = new Map(bookingCounts.map(r => [r.userId, Number(r.n)]));
  const upcomingCountMap = new Map(upcomingCounts.map(r => [r.userId, Number(r.n)]));

  return studentRows.map(s => ({
    id: s.id,
    name: s.name ?? '—',
    email: s.email ?? '—',
    createdAt: s.createdAt,
    passBalance:    balanceMap.get(s.id)?.pass ?? 0,
    sessionBalance: balanceMap.get(s.id)?.session ?? 0,
    totalBookings:       bookingCountMap.get(s.id) ?? 0,
    upcomingBookings:    upcomingCountMap.get(s.id) ?? 0,
  }));
}

// ─── Student detail (on-demand) ────────────────────────────────────────────────

export async function getStudentDetailAction(userId: string): Promise<StudentDetail | null> {
  await requireAdmin();

  const [studentRow] = await db
    .select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  if (!studentRow) return null;

  const [balances, recentBookings, recentTransactions] = await Promise.all([
    db.select({ creditType: creditBalances.creditType, balance: creditBalances.balance })
      .from(creditBalances)
      .where(eq(creditBalances.userId, userId)),

    db.select({
      id: bookings.id,
      status: bookings.status,
      creditsSpent: bookings.creditsSpent,
      creditType: bookings.creditType,
      cancellationType: bookings.cancellationType,
      startsAt: classSessions.startsAt,
      className: classTemplates.name,
    })
      .from(bookings)
      .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
      .leftJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
      .where(eq(bookings.userId, userId))
      .orderBy(desc(classSessions.startsAt))
      .limit(20),

    db.select({
      id: creditTransactions.id,
      type: creditTransactions.type,
      amount: creditTransactions.amount,
      balanceAfter: creditTransactions.balanceAfter,
      creditType: creditTransactions.creditType,
      description: creditTransactions.description,
      createdAt: creditTransactions.createdAt,
    })
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(20),
  ]);

  const passBalance    = balances.find(b => b.creditType === 'pass')?.balance ?? 0;
  const sessionBalance = balances.find(b => b.creditType === 'session')?.balance ?? 0;

  return {
    id: studentRow.id,
    name: studentRow.name ?? '—',
    email: studentRow.email ?? '—',
    createdAt: studentRow.createdAt,
    passBalance,
    sessionBalance,
    recentBookings: recentBookings.map(b => ({
      id: b.id,
      className: b.className ?? 'Unnamed Class',
      startsAt: b.startsAt,
      status: b.status,
      creditsSpent: b.creditsSpent,
      creditType: b.creditType,
      cancellationType: b.cancellationType ?? null,
    })),
    recentTransactions: recentTransactions.map(t => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      creditType: t.creditType,
      description: t.description,
      createdAt: t.createdAt,
    })),
  };
}
