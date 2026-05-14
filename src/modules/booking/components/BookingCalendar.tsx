'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { format, isSameDay, isToday, parseISO, startOfToday } from 'date-fns';
import { CalendarDaysIcon, CalendarX2Icon, LayoutListIcon } from 'lucide-react';
import { DateScroller, DATE_PARAM } from './DateScroller';
import { ClassSessionCard, type ClassSessionCardProps } from './ClassSessionCard';
import { BookingConfirmModal } from './BookingConfirmModal';
import { BookedClassModal } from './BookedClassModal';
import { WeekView, WeekNav } from './WeekView';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BookingCalendarProps = {
  sessions: ClassSessionCardProps[];
};

type ViewMode = 'list' | 'week';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDateParam(raw: string | null): Date {
  if (!raw) return startOfToday();
  try {
    return parseISO(raw);
  } catch {
    return startOfToday();
  }
}

// ─── View toggle ──────────────────────────────────────────────────────────────

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-[#ede8e5] p-0.5">
      <button
        type="button"
        onClick={() => onChange('list')}
        aria-pressed={view === 'list'}
        className={[
          'flex items-center gap-1.5 rounded-lg px-3 py-2 h-9 text-xs font-semibold transition-all',
          view === 'list'
            ? 'bg-[#faf9f7] text-[#4e2b22] shadow-sm ring-1 ring-[#ede8e5]'
            : 'text-[#8b6b5c] hover:text-[#6b3d32]',
        ].join(' ')}
      >
        <LayoutListIcon className="size-3.5" aria-hidden />
        List
      </button>
      <button
        type="button"
        onClick={() => onChange('week')}
        aria-pressed={view === 'week'}
        className={[
          'flex items-center gap-1.5 rounded-lg px-3 py-2 h-9 text-xs font-semibold transition-all',
          view === 'week'
            ? 'bg-[#faf9f7] text-[#4e2b22] shadow-sm ring-1 ring-[#ede8e5]'
            : 'text-[#8b6b5c] hover:text-[#6b3d32]',
        ].join(' ')}
      >
        <CalendarDaysIcon className="size-3.5" aria-hidden />
        Week
      </button>
    </div>
  );
}

// ─── Session list (list view body) ────────────────────────────────────────────

function SessionList({
  sessions,
  onBook,
}: {
  sessions: ClassSessionCardProps[];
  onBook: (session: ClassSessionCardProps) => void;
}) {
  const searchParams = useSearchParams();
  const selectedDate = parseDateParam(searchParams.get(DATE_PARAM));

  const filtered = sessions
    .filter((s) => isSameDay(s.startsAt, selectedDate))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const dateHeading = isToday(selectedDate)
    ? `Today · ${format(selectedDate, 'd MMMM')}`
    : format(selectedDate, 'EEEE · d MMMM');

  return (
    <div>
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-[#4e2b22]">{dateHeading}</h2>
        <span className="text-xs font-medium text-[#8b6b5c]">
          {filtered.length === 0
            ? 'No classes'
            : `${filtered.length} ${filtered.length === 1 ? 'class' : 'classes'}`}
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyDay />
      ) : (
        <ul className="space-y-3">
          {filtered.map((session) => (
            <li key={session.id}>
              <ClassSessionCard {...session} onBook={() => onBook(session)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyDay() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-[#ede8e5]/60 ring-1 ring-[#c4a88a]/20">
        <CalendarX2Icon className="size-8 text-[#c4a88a]" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-[#4e2b22]">No classes scheduled</p>
      <p className="mt-1.5 text-xs text-[#8b6b5c]">Try selecting another date</p>
    </div>
  );
}

function SessionListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="mb-5 flex items-baseline justify-between">
        <div className="h-4 w-32 animate-pulse rounded-lg bg-[#ede8e5]/60" />
        <div className="h-3 w-12 animate-pulse rounded-lg bg-[#ede8e5]/60" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-52 animate-pulse rounded-2xl bg-gradient-to-br from-[#ede8e5]/40 to-[#e5dfdb]/40" />
      ))}
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function BookingCalendar({ sessions }: BookingCalendarProps) {
  const [view, setView] = useState<ViewMode>('list');
  const [sessionToBook, setSessionToBook] = useState<ClassSessionCardProps | null>(null);
  const [bookedSession, setBookedSession] = useState<ClassSessionCardProps | null>(null);

  function handleSessionClick(session: ClassSessionCardProps) {
    if (session.isBookedByUser) {
      setBookedSession(session);
    } else {
      setSessionToBook(session);
    }
  }

  return (
    <div>
      {/*
        Persistent sticky header — always visible regardless of view.
        List mode: DateScroller fills the left side, toggle pinned right.
        Week mode: empty left side, toggle pinned right (week nav lives inside WeekView).
        -mx-6 breaks out of dashboard p-6; px-4 restores inner padding.
      */}
      <div className="sticky top-0 z-10 -mx-6 border-b border-[#ede8e5]/80 bg-[#faf9f7]/90 px-4 pb-3 pt-3 shadow-[0_4px_14px_rgba(78,43,34,0.04)] backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1 overflow-hidden">
            {view === 'list' ? <DateScroller /> : <WeekNav />}
          </div>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {/* ── List view body ────────────────────────────────────────────────────── */}
      {view === 'list' && (
        <div className="pt-5">
          <Suspense fallback={<SessionListSkeleton />}>
            <SessionList sessions={sessions} onBook={handleSessionClick} />
          </Suspense>
        </div>
      )}

      {/* ── Week view body ────────────────────────────────────────────────────── */}
      {view === 'week' && (
        <div className="pt-4">
          <WeekView sessions={sessions} onBook={handleSessionClick} />
        </div>
      )}

      {/* ── Shared confirm modal (unbooked sessions) ──────────────────────────── */}
      <BookingConfirmModal
        session={sessionToBook}
        onClose={() => setSessionToBook(null)}
      />

      {/* ── Booked class modal (already-booked sessions) ────────────────────────── */}
      <BookedClassModal
        session={bookedSession}
        onClose={() => setBookedSession(null)}
      />
    </div>
  );
}
