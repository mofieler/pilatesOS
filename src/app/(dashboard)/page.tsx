import { and, asc, eq, gte, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ArrowRightIcon, CreditCardIcon, CalendarDaysIcon } from 'lucide-react';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import {
  bookings,
  classSessions,
  classTemplates,
  creditBalances,
  creditPackages,
  creditPurchases,
  instructors,
  users,
} from '@/db/schema';
import { CreditBalanceDisplay } from '@/modules/users/components/CreditBalanceDisplay';
import type { CreditBalance, SessionPackage } from '@/modules/users/components/CreditBalanceDisplay';
import { DashboardGreeting } from '@/modules/users/components/DashboardGreeting';
import { UpcomingBookingsList } from '@/modules/users/components/UpcomingBookingsList';
import type { UpcomingBooking } from '@/modules/users/components/UpcomingBookingsList';
import { StreakCard } from '@/modules/users/components/StreakCard';
import { OpenBillsCard } from '@/modules/billing/components/OpenBillsCard';
import { getUserBillingStatus } from '@/modules/billing/services/billingStatus.service';
import { MembershipStatusCard } from '@/modules/billing/components/MembershipStatusCard';
import { getMyMembershipAction } from '@/modules/billing/actions/membership.actions';
import { cancellationService } from '@/modules/booking/services/cancellation.service';
import { lotService } from '@/modules/billing/services/lot.service';
import { LotBreakdown } from '@/modules/billing/components/LotBreakdown';
import { ExpiryWarningBanner } from '@/modules/billing/components/ExpiryWarningBanner';
import { unstable_cache } from 'next/cache';

// ─── Data fetchers ────────────────────────────────────────────────────────────

// Mercy quota state is fetched via cancellationService.getMercyContext(userId).
// Replaces the legacy lifetime first_mercy_used flag.

const getSessionPackages = unstable_cache(
  async (userId: string): Promise<SessionPackage[]> => {
    const rows = await db
      .select({
        purchaseId:    creditPurchases.id,
        packageName:   creditPackages.name,
        creditsAmount: creditPurchases.creditsAmount,
        purchasedAt:   creditPurchases.createdAt,
      })
      .from(creditPurchases)
      .innerJoin(creditPackages, eq(creditPurchases.packageId, creditPackages.id))
      .where(
        and(
          eq(creditPurchases.userId, userId),
          eq(creditPurchases.paymentStatus, 'paid'),
          eq(creditPackages.category, 'session'),
        ),
      )
      .orderBy(asc(creditPurchases.createdAt));

    return rows;
  },
  ['session-packages'],
  { revalidate: 60, tags: ['session-packages'] },
);

const getCreditBalances = unstable_cache(
  async (userId: string): Promise<CreditBalance[]> => {
    const rows = await db
      .select({
        creditType: creditBalances.creditType,
        balance: creditBalances.balance,
        expiresAt: creditBalances.expiresAt,
      })
      .from(creditBalances)
      .where(eq(creditBalances.userId, userId));

    const DISPLAY_TYPES: CreditBalance['creditType'][] = ['pass', 'session'];
    return rows.filter((r): r is CreditBalance =>
      (DISPLAY_TYPES as readonly string[]).includes(r.creditType),
    );
  },
  ['credit-balances'],
  { revalidate: 60, tags: ['credit-balances'] },
);

const getUpcomingBookings = unstable_cache(
  async (userId: string): Promise<UpcomingBooking[]> => {
  // Alias the users table so we can join it twice-free
  // (once for the booking owner check — already filtered by userId —
  //  and once for the instructor's display name)
  const instructorUser = alias(users, 'instructor_user');

  const rows = await db
    .select({
      bookingId:        bookings.id,
      creditsSpent:     bookings.creditsSpent,
      creditType:       bookings.creditType,
      name:             classTemplates.name,
      classType:        classTemplates.classType,
      durationMinutes:  classTemplates.durationMinutes,
      location:         classTemplates.location,
      startsAt:         classSessions.startsAt,
      instructorName:   instructorUser.name,
      instructorAvatarUrl: instructors.avatarUrl,
    })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .leftJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
    .leftJoin(instructors, eq(classSessions.instructorId, instructors.id))
    .leftJoin(instructorUser, and(
      eq(instructors.userId, instructorUser.id),
      isNull(instructorUser.deletedAt),
    ))
    .where(
      and(
        eq(bookings.userId, userId),
        eq(bookings.status, 'confirmed'),
        gte(classSessions.startsAt, new Date()),
      ),
    )
    .orderBy(asc(classSessions.startsAt))
    .limit(10);

  return rows.map((r) => ({
    bookingId:          r.bookingId,
    creditsSpent:       r.creditsSpent,
    creditType:         r.creditType,
    name:               r.name ?? 'Unnamed Class',
    classType:          r.classType ?? 'mat_group',
    durationMinutes:    r.durationMinutes ?? 60,
    location:           r.location ?? null,
    startsAt:           r.startsAt,
    instructorName:     r.instructorName ?? null,
    instructorAvatarUrl: r.instructorAvatarUrl ?? null,
  }));
}, ['upcoming-bookings'], { revalidate: 60, tags: ['upcoming-bookings'] });

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;
  const userName = session.user.name ?? session.user.email ?? 'there';

  const [
    balances, sessionPackages, upcomingBookings, mercyContext, billing, membership,
    passLots, sessionLots, utilization,
  ] = await Promise.all([
    getCreditBalances(userId),
    getSessionPackages(userId),
    getUpcomingBookings(userId),
    cancellationService.getMercyContext(userId),
    getUserBillingStatus(userId),
    getMyMembershipAction(),
    lotService.getLotBreakdown(userId, 'pass'),
    lotService.getLotBreakdown(userId, 'session'),
    lotService.predictUtilization(userId, { lookbackDays: 90 }),
  ]);

  return (
    <div className="space-y-10">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <DashboardGreeting name={firstName(userName)} />

      {/* ── Streak (Phase 3) ─────────────────────────────────────────────────── */}
      {/* <StreakCard /> */}

      {/* ── Expiry warning ─────────────────────────────────────────────────── */}
      <ExpiryWarningBanner prediction={utilization} />

      {/* ── Open bills ─────────────────────────────────────────────────────── */}
      <OpenBillsCard openBills={billing.openBills} />

      {/* ── Active membership ───────────────────────────────────────────────── */}
      <MembershipStatusCard membership={membership ?? null} />

      {/* ── Credits ────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-linear-to-br from-[#faf9f7]/80 to-[#ede8e5]/60 p-6 backdrop-blur-xl border border-[#ede8e5]/80 shadow-[0_4px_20px_rgba(78,43,34,0.04)]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/80 text-[#6b3d32]">
              <CreditCardIcon className="size-4" aria-hidden />
            </span>
            <h2 className="text-lg font-semibold text-primary">Credit Balances</h2>
          </div>
          <Link
            href="/credits"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#4e2b22] px-4 py-2 text-xs font-semibold text-[#faf9f7] shadow-[0_4px_14px_rgba(78,43,34,0.25)] transition-all hover:bg-[#6b3d32] hover:shadow-[0_6px_20px_rgba(78,43,34,0.35)] hover:-translate-y-0.5"
          >
            Buy credits
            <ArrowRightIcon className="size-3.5" aria-hidden />
          </Link>
        </div>
        <CreditBalanceDisplay balances={balances} sessionPackages={sessionPackages} />

        {/* Lot-level breakdown for transparent expiry tracking */}
        {(passLots.length > 0 || sessionLots.length > 0) && (
          <div className="mt-5 space-y-4 border-t border-[#ede8e5]/60 pt-5">
            {passLots.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8b6b5c]">
                  Pass credit lots
                </p>
                <LotBreakdown lots={passLots} />
              </div>
            )}
            {sessionLots.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8b6b5c]">
                  Session credit lots
                </p>
                <LotBreakdown lots={sessionLots} />
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Upcoming bookings ───────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/80 text-[#6b3d32]">
              <CalendarDaysIcon className="size-4" aria-hidden />
            </span>
            <h2 className="text-lg font-semibold text-primary">
              Upcoming Classes
              {upcomingBookings.length > 0 && (
                <span className="ml-2 rounded-full bg-success/20 px-2.5 py-0.5 text-xs font-semibold text-success">
                  {upcomingBookings.length}
                </span>
              )}
            </h2>
          </div>
          <Link
            href="/book"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary hover:text-primary transition-colors"
          >
            Book a class
            <ArrowRightIcon className="size-4" aria-hidden />
          </Link>
        </div>
        <UpcomingBookingsList bookings={upcomingBookings} mercyUsesLeft={mercyContext.mercyUsesLeft} />
      </section>
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}

