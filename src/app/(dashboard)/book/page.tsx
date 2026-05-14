import { addDays, startOfToday } from 'date-fns';
import { eq, and, gte, lt } from 'drizzle-orm';
import { db } from '@/db';
import { classSessions, creditBalances } from '@/db/schema';
import { auth } from '@/lib/auth/auth';
import { BookingCalendar } from '@/modules/booking/components/BookingCalendar';
import type { ClassSessionCardProps } from '@/modules/booking/components/ClassSessionCard';

// ─── Data layer ───────────────────────────────────────────────────────────────

// Class types where group credits are accepted as fallback when primary is insufficient
const GROUP_FALLBACK_TYPES = new Set(['reformer_group', 'mat_group']);

type Balance = { creditType: string; balance: number };

// Determines which credit type will actually be charged — mirrors booking action logic
function resolveDisplayCreditType(
  classType: string,
  primaryCreditType: string,
  creditCost: number,
  balances: Balance[],
): ClassSessionCardProps['creditType'] {
  if (GROUP_FALLBACK_TYPES.has(classType) && primaryCreditType !== 'group') {
    const primary = balances.find(b => b.creditType === primaryCreditType);
    if (!primary || primary.balance < creditCost) return 'group';
  }
  return primaryCreditType as ClassSessionCardProps['creditType'];
}

async function getUpcomingSessions(userId: string): Promise<ClassSessionCardProps[]> {
  const today = startOfToday();
  const cutoff = addDays(today, 14);

  const [rows, balances] = await Promise.all([
    db.query.classSessions.findMany({
      with: {
        template: true,
        instructor: { with: { user: true } },
        bookings: {
          where: (b, { and: dbAnd, eq: dbEq }) =>
            dbAnd(dbEq(b.userId, userId), dbEq(b.status, 'confirmed')),
          columns: { id: true },
        },
      },
      where: and(
        gte(classSessions.startsAt, today),
        lt(classSessions.startsAt, cutoff),
        eq(classSessions.status, 'scheduled'),
      ),
      orderBy: (s, { asc }) => [asc(s.startsAt)],
    }),
    db.select({ creditType: creditBalances.creditType, balance: creditBalances.balance })
      .from(creditBalances)
      .where(eq(creditBalances.userId, userId)),
  ]);

  return rows.map((s) => {
    const classType      = s.template?.classType ?? 'mat_group';
    const primaryType    = s.template?.creditType ?? 'mat';
    const creditCost     = s.template?.creditCost ?? 1;

    return {
      id:               s.id,
      name:             s.template?.name ?? 'Unnamed Class',
      classType,
      startsAt:         s.startsAt,
      durationMinutes:  s.template?.durationMinutes ?? 60,
      instructorName:   s.instructor?.user?.name ?? 'TBA',
      instructorAvatarUrl: null,
      vibeTags:         (s.template?.vibeTags ?? []) as string[],
      bookedCount:      s.bookedCount,
      maxCapacity:      s.maxCapacity,
      creditCost,
      creditType:       resolveDisplayCreditType(classType, primaryType, creditCost, balances),
      status:           s.status,
      isBookedByUser:   s.bookings.length > 0,
      location:         s.template?.location ?? null,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function BookPage() {
  const authSession = await auth();
  // Dashboard layout already redirects unauthenticated users, but guard defensively.
  const userId = authSession?.user?.id ?? '';

  const sessions = userId ? await getUpcomingSessions(userId) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative">
        <h1 className="text-3xl font-bold text-[#4e2b22]">Book a Class</h1>
        <p className="mt-2 text-sm text-[#8b6b5c]">
          Browse and book sessions for the next two weeks
        </p>
      </div>

      {/* Calendar Container */}
      <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/90 to-[#ede8e5]/60 p-6 backdrop-blur-xl shadow-[0_4px_20px_rgba(78,43,34,0.04)]">
        <BookingCalendar sessions={sessions} />
      </div>
    </div>
  );
}
