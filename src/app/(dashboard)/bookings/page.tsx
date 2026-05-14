import { and, desc, eq, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { format, isPast, isToday, isTomorrow, addDays } from 'date-fns';
import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { bookings, classSessions, classTemplates, instructors, users } from '@/db/schema';
import { CancelBookingButton } from '@/modules/users/components/CancelBookingButton';
import { getMercyAvailable } from '@/modules/users/actions/user.actions';
import { CalendarCheck, CalendarX, Clock, MapPin, User, HistoryIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingWithDetails = {
  bookingId: string;
  sessionId: string;
  status: 'confirmed' | 'cancelled' | 'attended' | 'no_show' | 'waitlisted';
  creditsSpent: number;
  creditType: 'reformer' | 'mat' | 'group' | 'session' | 'sound_healing';
  name: string;
  classType: 'reformer_group' | 'reformer_private' | 'reformer_duo' | 'mat_group' | 'mat_private' | 'mat_duo' | 'chair' | 'online' | 'sound_healing';
  durationMinutes: number;
  location: string | null;
  startsAt: Date;
  instructorName: string | null;
  instructorAvatarUrl: string | null;
  isPast: boolean;
};

// ─── Data Fetchers ───────────────────────────────────────────────────────────

async function getUserBookings(userId: string): Promise<{
  upcoming: BookingWithDetails[];
  past: BookingWithDetails[];
}> {
  const instructorUser = alias(users, 'instructor_user');

  const rows = await db
    .select({
      bookingId: bookings.id,
      sessionId: classSessions.id,
      bookingStatus: bookings.status,
      creditsSpent: bookings.creditsSpent,
      creditType: bookings.creditType,
      name: classTemplates.name,
      classType: classTemplates.classType,
      durationMinutes: classTemplates.durationMinutes,
      location: classTemplates.location,
      startsAt: classSessions.startsAt,
      instructorName: instructorUser.name,
      instructorAvatarUrl: instructors.avatarUrl,
    })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .leftJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
    .leftJoin(instructors, eq(classSessions.instructorId, instructors.id))
    .leftJoin(
      instructorUser,
      and(eq(instructors.userId, instructorUser.id), isNull(instructorUser.deletedAt))
    )
    .where(eq(bookings.userId, userId))
    .orderBy(desc(classSessions.startsAt));

  const allBookings: BookingWithDetails[] = rows.map((r) => ({
    bookingId: r.bookingId,
    sessionId: r.sessionId,
    status: r.bookingStatus,
    creditsSpent: r.creditsSpent,
    creditType: r.creditType as BookingWithDetails['creditType'],
    name: r.name ?? 'Unnamed Class',
    classType: (r.classType ?? 'mat_group') as BookingWithDetails['classType'],
    durationMinutes: r.durationMinutes ?? 60,
    location: r.location ?? null,
    startsAt: r.startsAt,
    instructorName: r.instructorName ?? null,
    instructorAvatarUrl: r.instructorAvatarUrl ?? null,
    isPast: isPast(r.startsAt),
  }));

  return {
    upcoming: allBookings.filter((b) => !b.isPast && b.status !== 'cancelled'),
    past: allBookings.filter((b) => b.isPast || b.status === 'cancelled'),
  };
}

// ─── Components ─────────────────────────────────────────────────────────────

function BookingCard({
  booking,
  mercyAvailable,
  isPast,
}: {
  booking: BookingWithDetails;
  mercyAvailable: boolean;
  isPast: boolean;
}) {
  const dateLabel = isToday(booking.startsAt)
    ? 'Today'
    : isTomorrow(booking.startsAt)
    ? 'Tomorrow'
    : format(booking.startsAt, 'EEEE, MMMM d');

  const canCancel =
    !isPast &&
    booking.status === 'confirmed' &&
    booking.startsAt.getTime() - Date.now() > 24 * 60 * 60 * 1000;

  const CLASS_TYPE_LABEL: Record<BookingWithDetails['classType'], string> = {
    reformer_group:   'Reformer Group',
    reformer_private: 'Reformer Private',
    reformer_duo:     'Reformer Duo',
    mat_group:        'Mat Group',
    mat_private:      'Mat Private',
    mat_duo:          'Mat Duo',
    chair:            'Chair Pilates',
    online:           'Online Class',
    sound_healing:    'Sound Healing',
  };
  const classTypeLabel = CLASS_TYPE_LABEL[booking.classType];

  const CREDIT_LABEL: Record<BookingWithDetails['creditType'], string> = {
    mat:           'Mat Credit',
    reformer:      'Reformer Credit',
    group:         'Group Credit',
    session:       'Session Credit',
    sound_healing: 'Sound Healing Credit',
  };
  const creditLabel = CREDIT_LABEL[booking.creditType];

  const CREDIT_DOT: Record<BookingWithDetails['creditType'], string> = {
    mat:           'bg-[#6b8e6b]',
    reformer:      'bg-[#8b5a3c]',
    group:         'bg-[#c4a88a]',
    session:       'bg-[#4e2b22]',
    sound_healing: 'bg-purple-500',
  };

  return (
    <div
      className={`group relative rounded-2xl border p-5 transition-all ${
        isPast
          ? 'border-[#ede8e5]/60 bg-[#faf9f7]/60 opacity-70'
          : 'border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/90 to-[#f5f3f1]/80 shadow-[0_4px_20px_rgba(78,43,34,0.04)]'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className={`text-xs rounded-full ${
                booking.classType.startsWith('mat')
                  ? 'bg-[#6b8e6b]/10 text-[#4a7c4a] border-[#6b8e6b]/20'
                  : booking.classType.startsWith('reformer')
                  ? 'bg-[#8b5a3c]/10 text-[#6b3d32] border-[#c4a88a]/30'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {classTypeLabel}
            </Badge>
            {booking.status === 'cancelled' && (
              <Badge variant="outline" className="text-xs rounded-full bg-[#c45c4a]/10 text-[#c45c4a]">
                Cancelled
              </Badge>
            )}
            {booking.status === 'attended' && (
              <Badge variant="outline" className="text-xs rounded-full bg-[#6b8e6b]/10 text-[#4a7c4a]">
                Attended
              </Badge>
            )}
          </div>
          <h3 className="text-lg font-semibold text-primary">{booking.name}</h3>
        </div>

        {/* Credit badge */}
        <div className="flex items-center gap-1.5 rounded-full bg-[#ede8e5]/60 px-3 py-1.5 text-xs">
          <span className={`size-2 rounded-full ${CREDIT_DOT[booking.creditType]}`} />
          <span className="font-medium text-primary">
            {booking.creditsSpent} {creditLabel}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-secondary">
          <CalendarCheck className="size-4 text-muted" />
          <span className="font-medium">{dateLabel}</span>
          <span className="text-muted">
            at {format(booking.startsAt, 'HH:mm')} ({booking.durationMinutes} min)
          </span>
        </div>

        {booking.instructorName && (
          <div className="flex items-center gap-2 text-secondary">
            <User className="size-4 text-muted" />
            <span>{booking.instructorName}</span>
          </div>
        )}

        {booking.location && (
          <div className="flex items-center gap-2 text-secondary">
            <MapPin className="size-4 text-muted" />
            <span>{booking.location}</span>
          </div>
        )}
      </div>

      {/* Cancel button for upcoming classes */}
      {!isPast && booking.status === 'confirmed' && (
        <div className="mt-4 pt-4 border-t border-[#ede8e5]/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted">
              <Clock className="size-3.5" />
              <span>
                {canCancel
                  ? 'Free cancellation available'
                  : 'Late cancellation may forfeit credits'}
              </span>
            </div>
            <CancelBookingButton
              bookingId={booking.bookingId}
              className={booking.name}
              startsAt={booking.startsAt}
              creditsSpent={booking.creditsSpent}
              creditType={booking.creditType}
              mercyAvailable={mercyAvailable}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ type }: { type: 'upcoming' | 'past' }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#c4a88a]/30 bg-gradient-to-br from-[#faf9f7]/60 to-[#ede8e5]/30 py-14 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-[#ede8e5]/60 ring-1 ring-[#c4a88a]/20">
        {type === 'upcoming' ? (
          <CalendarCheck className="size-8 text-[#c4a88a]" />
        ) : (
          <CalendarX className="size-8 text-[#c4a88a]" />
        )}
      </div>
      <p className="text-sm font-semibold text-primary">
        {type === 'upcoming' ? 'No upcoming classes' : 'No past classes'}
      </p>
      <p className="mt-1 text-sm text-muted">
        {type === 'upcoming'
          ? 'Head to the booking calendar to reserve a spot'
          : 'Your class history will appear here'}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MyBookingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;
  const { upcoming, past } = await getUserBookings(userId);
  const mercyAvailable = await getMercyAvailable();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-sm font-medium text-[#6b3d32]">My Classes</p>
        <h1 className="mt-1">My Bookings</h1>
        <p className="mt-2 text-sm text-[#6b3d32]">
          View your upcoming classes and booking history
        </p>
      </div>

      {/* Stats Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-5">
          <p className="text-sm font-medium text-secondary">Upcoming</p>
          <p className="text-2xl font-bold text-primary">{upcoming.length}</p>
          <p className="text-xs text-muted">Classes booked</p>
        </div>
        <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-5">
          <p className="text-sm font-medium text-secondary">Past 30 Days</p>
          <p className="text-2xl font-bold text-primary">
            {past.filter((b) => b.startsAt > addDays(new Date(), -30)).length}
          </p>
          <p className="text-xs text-muted">Classes attended</p>
        </div>
        <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-5">
          <p className="text-sm font-medium text-secondary">Total</p>
          <p className="text-2xl font-bold text-primary">{upcoming.length + past.length}</p>
          <p className="text-xs text-muted">All-time bookings</p>
        </div>
      </div>

      {/* Upcoming Classes */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/80 text-[#6b3d32]">
              <CalendarCheck className="size-4" />
            </span>
            <h2 className="text-lg font-semibold text-primary">Upcoming Classes</h2>
          </div>
          <a
            href="/book"
            className="text-sm font-medium text-secondary hover:text-primary transition-colors"
          >
            Book a class →
          </a>
        </div>

        {upcoming.length === 0 ? (
          <EmptyState type="upcoming" />
        ) : (
          <div className="space-y-3">
            {upcoming.map((booking) => (
              <BookingCard
                key={booking.bookingId}
                booking={booking}
                mercyAvailable={mercyAvailable}
                isPast={false}
              />
            ))}
          </div>
        )}
      </section>

      {/* Past Classes */}
      <section>
        <div className="mb-4 flex items-center gap-2.5">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/80 text-[#6b3d32]">
            <HistoryIcon className="size-4" />
          </span>
          <h2 className="text-lg font-semibold text-primary">History</h2>
        </div>

        {past.length === 0 ? (
          <EmptyState type="past" />
        ) : (
          <div className="space-y-3">
            {past.slice(0, 10).map((booking) => (
              <BookingCard
                key={booking.bookingId}
                booking={booking}
                mercyAvailable={mercyAvailable}
                isPast={true}
              />
            ))}
            {past.length > 10 && (
              <p className="text-center text-sm text-muted py-4">
                +{past.length - 10} more classes in history
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
