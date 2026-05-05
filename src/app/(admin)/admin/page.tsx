import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { format, startOfDay, endOfDay, addDays, isToday, isTomorrow } from 'date-fns';
import { db } from '@/db';
import { classSessions, classTemplates, instructors, users, bookings } from '@/db/schema';
import { and, eq, gte, lt, asc, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

// Icons using SVG since lucide may have issues
const CalendarIcon = () => <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const TemplateIcon = () => <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>;
const CoinsIcon = () => <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const UsersIcon = () => <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const PaymentIcon = () => <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const ClockIcon = () => <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const MapPinIcon = () => <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const UserIcon = () => <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;

const NAV_ITEMS = [
  {
    href: '/admin/classes',
    icon: CalendarIcon,
    label: 'Classes',
    description: 'Schedule sessions, cancel classes, view bookings',
    color: 'bg-[#6b8e6b]/10 text-[#4a7c4a]',
  },
  {
    href: '/admin/templates',
    icon: TemplateIcon,
    label: 'Templates',
    description: 'Define class types, duration, capacity, and credit cost',
    color: 'bg-[#c4a88a]/10 text-[#8b5a3c]',
  },
  {
    href: '/admin/credits',
    icon: CoinsIcon,
    label: 'Credit Packages',
    description: 'Create and manage purchasable credit packages',
    color: 'bg-[#8b5a3c]/10 text-[#6b3d32]',
  },
  {
    href: '/admin/payments',
    icon: PaymentIcon,
    label: 'Payments',
    description: 'Manage credit purchases and track payments',
    color: 'bg-[#4e2b22]/10 text-[#4e2b22]',
  },
  {
    href: '/admin/students',
    icon: UsersIcon,
    label: 'Students',
    description: 'View student profiles, credits, and booking history',
    color: 'bg-[#ede8e5] text-[#6b3d32]',
    comingSoon: true,
  },
];

// ─── Data Fetchers ───────────────────────────────────────────────────────────

async function getTodaysClasses() {
  const today = new Date();
  const instructorUser = alias(users, 'instructor_user');

  const rows = await db
    .select({
      sessionId: classSessions.id,
      name: classTemplates.name,
      classType: classTemplates.classType,
      startsAt: classSessions.startsAt,
      endsAt: classSessions.endsAt,
      maxCapacity: classSessions.maxCapacity,
      bookedCount: classSessions.bookedCount,
      location: classTemplates.location,
      instructorName: instructorUser.name,
      status: classSessions.status,
    })
    .from(classSessions)
    .leftJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
    .leftJoin(instructors, eq(classSessions.instructorId, instructors.id))
    .leftJoin(instructorUser, eq(instructors.userId, instructorUser.id))
    .where(
      and(
        gte(classSessions.startsAt, startOfDay(today)),
        lt(classSessions.startsAt, endOfDay(today)),
        eq(classSessions.status, 'scheduled')
      )
    )
    .orderBy(asc(classSessions.startsAt));

  return rows;
}

async function getThisWeekClasses() {
  const today = new Date();
  const weekEnd = addDays(today, 7);
  const instructorUser = alias(users, 'instructor_user');

  const rows = await db
    .select({
      sessionId: classSessions.id,
      name: classTemplates.name,
      classType: classTemplates.classType,
      startsAt: classSessions.startsAt,
      endsAt: classSessions.endsAt,
      maxCapacity: classSessions.maxCapacity,
      bookedCount: classSessions.bookedCount,
      location: classTemplates.location,
      instructorName: instructorUser.name,
      status: classSessions.status,
    })
    .from(classSessions)
    .leftJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
    .leftJoin(instructors, eq(classSessions.instructorId, instructors.id))
    .leftJoin(instructorUser, eq(instructors.userId, instructorUser.id))
    .where(
      and(
        gte(classSessions.startsAt, today),
        lt(classSessions.startsAt, weekEnd),
        eq(classSessions.status, 'scheduled')
      )
    )
    .orderBy(asc(classSessions.startsAt));

  return rows;
}

async function getQuickStats() {
  const today = new Date();

  const [todayCount, weekCount, pendingPayments] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(classSessions)
      .where(
        and(
          gte(classSessions.startsAt, startOfDay(today)),
          lt(classSessions.startsAt, endOfDay(today)),
          eq(classSessions.status, 'scheduled')
        )
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(classSessions)
      .where(
        and(
          gte(classSessions.startsAt, today),
          lt(classSessions.startsAt, addDays(today, 7)),
          eq(classSessions.status, 'scheduled')
        )
      ),
    // Mock for now - would check creditPurchases table
    { count: 3 },
  ]);

  return {
    todayClasses: todayCount[0]?.count ?? 0,
    weekClasses: weekCount[0]?.count ?? 0,
    pendingPayments: pendingPayments.count,
  };
}

// ─── Components ───────────────────────────────────────────────────────────────

function ClassRow({ session, isToday }: { session: any; isToday: boolean }) {
  const fillPercentage = session.maxCapacity > 0
    ? Math.round((session.bookedCount / session.maxCapacity) * 100)
    : 0;

  const dateLabel = isToday
    ? 'Today'
    : isTomorrow(session.startsAt)
    ? 'Tomorrow'
    : format(session.startsAt, 'EEEE');

  const classTypeLabel = {
    mat: 'Mat',
    reformer: 'Reformer',
    private: 'Private',
  }[session.classType as string] || session.classType;

  return (
    <div className="flex items-center gap-4 p-3 rounded-xl border border-[#ede8e5]/60 bg-[#faf9f7]/60 hover:bg-[#faf9f7] transition-colors">
      {/* Time */}
      <div className="shrink-0 w-16 text-center flex flex-col justify-center">
        <p className="text-sm font-semibold text-primary">
          {format(session.startsAt, 'HH:mm')}
        </p>
        <p className="text-xs text-muted mt-0.5">{dateLabel}</p>
      </div>

      {/* Class Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            session.classType === 'mat'
              ? 'bg-[#6b8e6b]/10 text-[#4a7c4a]'
              : session.classType === 'reformer'
              ? 'bg-[#8b5a3c]/10 text-[#6b3d32]'
              : 'bg-[#4e2b22]/10 text-[#4e2b22]'
          }`}>
            {classTypeLabel}
          </span>
          <p className="font-medium text-primary truncate">{session.name}</p>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted">
          {session.instructorName && (
            <span className="flex items-center gap-1">
              <UserIcon />
              {session.instructorName}
            </span>
          )}
          {session.location && (
            <span className="flex items-center gap-1">
              <MapPinIcon />
              {session.location}
            </span>
          )}
        </div>
      </div>

      {/* Capacity */}
      <div className="shrink-0 text-right flex flex-col justify-center">
        <p className="text-sm font-medium text-primary">
          {session.bookedCount}/{session.maxCapacity}
        </p>
        <div className="w-16 h-1.5 bg-[#ede8e5] rounded-full mt-2 overflow-hidden">
          <div
            className={`h-full rounded-full ${
              fillPercentage >= 80
                ? 'bg-[#c45c4a]'
                : fillPercentage >= 50
                ? 'bg-[#d4a574]'
                : 'bg-[#6b8e6b]'
            }`}
            style={{ width: `${fillPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyWidget({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="size-12 rounded-full bg-[#ede8e5]/60 flex items-center justify-center mb-3">
        <CalendarIcon />
      </div>
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminPage() {
  const session = await auth();
  const [todaysClasses, weekClasses, stats] = await Promise.all([
    getTodaysClasses(),
    getThisWeekClasses(),
    getQuickStats(),
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-sm font-medium text-[#6b3d32]">Admin</p>
        <h1 className="mt-1">Dashboard</h1>
        <p className="mt-2 text-sm text-[#6b3d32]">
          Welcome back, {session?.user?.name || session?.user?.email}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#6b8e6b]/10 to-[#6b8e6b]/5 p-5">
          <p className="text-sm font-medium text-[#4a7c4a]">Today's Classes</p>
          <p className="text-2xl font-bold text-[#4e2b22]">{stats.todayClasses}</p>
          <p className="text-xs text-[#6b3d32]">
            {todaysClasses.reduce((sum, c) => sum + c.bookedCount, 0)} total bookings
          </p>
        </div>
        <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#c4a88a]/10 to-[#c4a88a]/5 p-5">
          <p className="text-sm font-medium text-[#8b5a3c]">This Week</p>
          <p className="text-2xl font-bold text-[#4e2b22]">{stats.weekClasses}</p>
          <p className="text-xs text-[#6b3d32]">Upcoming 7 days</p>
        </div>
        <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#4e2b22]/10 to-[#4e2b22]/5 p-5">
          <p className="text-sm font-medium text-[#4e2b22]">Pending Payments</p>
          <p className="text-2xl font-bold text-[#4e2b22]">{stats.pendingPayments}</p>
          <Link href="/admin/payments" className="text-xs text-[#6b3d32] hover:text-[#4e2b22]">
            View payments →
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Classes Widget */}
        <section className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/90 to-[#ede8e5]/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
              <span className="text-xl">📅</span>
              Today's Classes
            </h2>
            <Link
              href="/admin/classes"
              className="text-sm text-secondary hover:text-primary transition-colors"
            >
              View all →
            </Link>
          </div>

          {todaysClasses.length === 0 ? (
            <EmptyWidget message="No classes scheduled for today" />
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {todaysClasses.map((session) => (
                <ClassRow key={session.sessionId} session={session} isToday={true} />
              ))}
            </div>
          )}
        </section>

        {/* This Week's Classes Widget */}
        <section className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/90 to-[#ede8e5]/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
              <span className="text-xl">📆</span>
              This Week
            </h2>
            <Link
              href="/admin/classes"
              className="text-sm text-secondary hover:text-primary transition-colors"
            >
              Schedule →
            </Link>
          </div>

          {weekClasses.length === 0 ? (
            <EmptyWidget message="No classes scheduled this week" />
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {weekClasses.slice(0, 8).map((session) => (
                <ClassRow
                  key={session.sessionId}
                  session={session}
                  isToday={isToday(session.startsAt)}
                />
              ))}
              {weekClasses.length > 8 && (
                <p className="text-center text-sm text-muted py-2">
                  +{weekClasses.length - 8} more classes this week
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Quick Navigation */}
      <section>
        <h2 className="text-lg font-semibold text-primary mb-4">Quick Access</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {NAV_ITEMS.map(({ href, icon: Icon, label, description, color, comingSoon }) => (
            <Link
              key={href}
              href={comingSoon ? '#' : href}
              aria-disabled={comingSoon}
              className={[
                'flex flex-col rounded-2xl border p-4 transition-all',
                'border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/90 to-[#f5f3f1]/80',
                'hover:shadow-[0_8px_30px_rgba(78,43,34,0.08)] hover:border-[#c4a88a]/40',
                comingSoon ? 'cursor-not-allowed opacity-60' : '',
              ].join(' ')}
            >
              <div className={`flex size-10 items-center justify-center rounded-xl ${color} mb-3`}>
                <Icon />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-primary">{label}</p>
                {comingSoon && (
                  <span className="text-[10px] text-muted">Soon</span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted line-clamp-2">{description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
