import { addDays } from 'date-fns';
import { startOfStudioDay } from '@/lib/utils/date.utils';
import { and, eq, gte, lt } from 'drizzle-orm';
import { db } from '@/db';
import { classSessions } from '@/db/schema';
import { auth } from '@/lib/auth/auth';
import { BookingCalendar } from '@/modules/booking/components/BookingCalendar';
import type { ClassSessionCardProps } from '@/modules/booking/components/ClassSessionCard';
import { cancellationService } from '@/modules/booking/services/cancellation.service';
import { unstable_cache } from 'next/cache';

const getUpcomingSessions = unstable_cache(
  async (userId: string): Promise<ClassSessionCardProps[]> => {
  const today = startOfStudioDay();
  const cutoff = addDays(today, 14);

  const [rows, mercyContext] = await Promise.all([
    db.query.classSessions.findMany({
      with: {
        template: true,
        instructor: { with: { user: true } },
        bookings: {
          where: (b, { and: dbAnd, eq: dbEq }) =>
            dbAnd(dbEq(b.userId, userId), dbEq(b.status, 'confirmed')),
          columns: { id: true, creditsSpent: true, bookedAt: true },
        },
      },
      where: and(
        gte(classSessions.startsAt, today),
        lt(classSessions.startsAt, cutoff),
        eq(classSessions.status, 'scheduled'),
      ),
      orderBy: (s, { asc }) => [asc(s.startsAt)],
    }),
    cancellationService.getMercyContext(userId),
  ]);

  const mercyUsesLeft = mercyContext.mercyUsesLeft;

  return rows.map((s) => {
    const classType   = s.template?.classType ?? 'mat_group';
    const creditType  = (s.template?.creditType ?? 'pass') as ClassSessionCardProps['creditType'];
    const creditCost  = s.template?.creditCost ?? 1;

    return {
      id:                  s.id,
      name:                s.template?.name ?? 'Unnamed Class',
      classType,
      startsAt:            s.startsAt,
      durationMinutes:     s.template?.durationMinutes ?? 60,
      instructorName:      s.instructor?.user?.name ?? 'TBA',
      instructorAvatarUrl: null,
      vibeTags:            (s.template?.vibeTags ?? []) as string[],
      bookedCount:         s.bookedCount,
      maxCapacity:         s.maxCapacity,
      creditCost,
      creditType,
      status:              s.status,
      isBookedByUser:      s.bookings.length > 0,
      bookingId:           s.bookings[0]?.id,
      creditsSpent:        s.bookings[0]?.creditsSpent,
      bookedAt:            s.bookings[0]?.bookedAt ?? null,
      rescheduledAt:       s.rescheduledAt ?? null,
      mercyUsesLeft,
      location:            s.template?.location ?? null,
    };
  });
}, ['upcoming-sessions'], { revalidate: 60, tags: ['upcoming-sessions'] });

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
