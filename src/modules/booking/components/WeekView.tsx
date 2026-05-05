'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  addDays,
  format,
  startOfWeek,
  isSameDay,
  isToday,
  parseISO,
  startOfToday,
} from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { ClassSessionCardProps } from './ClassSessionCard';
import { DATE_PARAM } from './DateScroller';

// ─── Colour map ───────────────────────────────────────────────────────────────

type ClassType = ClassSessionCardProps['classType'];

const BLOCK_BG: Record<ClassType, string> = {
  reformer: 'bg-[#8b5a3c]/10  border-[#c4a88a]/40  text-[#4e2b22]  hover:bg-[#8b5a3c]/20',
  mat:      'bg-[#6b8e6b]/10 border-[#6b8e6b]/30 text-[#4a7c4a] hover:bg-[#6b8e6b]/20',
  private:  'bg-[#4e2b22]/10 border-[#4e2b22]/20 text-[#4e2b22] hover:bg-[#4e2b22]/15',
  duo:      'bg-[#7c6b8e]/10 border-[#7c6b8e]/30 text-[#4a3d6b] hover:bg-[#7c6b8e]/20',
  group:    'bg-[#5a8e8b]/10 border-[#5a8e8b]/30 text-[#2e5a58] hover:bg-[#5a8e8b]/20',
  online:   'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200',
};

const BLOCK_DOT: Record<ClassType, string> = {
  reformer: 'bg-[#8b5a3c]',
  mat:      'bg-[#6b8e6b]',
  private:  'bg-[#4e2b22]',
  duo:      'bg-[#7c6b8e]',
  group:    'bg-[#5a8e8b]',
  online:   'bg-slate-400',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDateParam(raw: string | null): Date {
  if (!raw) return startOfToday();
  try { return parseISO(raw); } catch { return startOfToday(); }
}

// ─── Session block ────────────────────────────────────────────────────────────

function SessionBlock({
  session,
  onClick,
}: {
  session: ClassSessionCardProps;
  onClick: (s: ClassSessionCardProps) => void;
}) {
  const bg = BLOCK_BG[session.classType];
  const dot = BLOCK_DOT[session.classType];
  const isCancelled = session.status === 'cancelled';
  const isBooked = session.isBookedByUser;
  const isFull = !isBooked && session.bookedCount >= session.maxCapacity;

  return (
    <button
      type="button"
      onClick={() => { if (!isCancelled) onClick(session); }}
      disabled={isCancelled}
      className={[
        'w-full rounded-lg border px-2.5 py-2 text-left transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22]/20 focus-visible:ring-offset-1',
        bg,
        isCancelled ? 'opacity-40 cursor-default' : 'cursor-pointer',
        isBooked ? 'ring-1 ring-[#6b8e6b]' : '',
      ].join(' ')}
      aria-label={`${session.name} at ${format(session.startsAt, 'HH:mm')}`}
    >
      {/* Dot + time */}
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`size-1.5 rounded-full shrink-0 ${dot} ${isCancelled ? 'opacity-50' : ''}`} />
        <p className="text-[10px] font-semibold tabular-nums leading-none opacity-70">
          {format(session.startsAt, 'HH:mm')}
          {' · '}
          {session.durationMinutes}m
        </p>
      </div>

      {/* Class name */}
      <p className="mt-1 text-xs font-bold leading-snug line-clamp-2">
        {session.name}
      </p>

      {/* Credit cost */}
      <p className="mt-1 text-[10px] opacity-60">
        {session.creditCost}{' '}
        {session.creditType === 'private_session' ? 'Private' : session.creditType === 'mat_group' ? 'Mat' : 'Reformer'}
      </p>

      {/* Status badges */}
      {isBooked && (
        <p className="mt-1.5 text-[10px] font-semibold text-[#4a7c4a]">✓ Booked</p>
      )}
      {isFull && (
        <p className="mt-1.5 text-[10px] font-semibold opacity-60">Full</p>
      )}
      {isCancelled && (
        <p className="mt-1.5 text-[10px] font-semibold opacity-60">Cancelled</p>
      )}
    </button>
  );
}

// ─── Inner (requires Suspense for useSearchParams) ────────────────────────────

function WeekViewInner({
  sessions,
  onBook,
}: {
  sessions: ClassSessionCardProps[];
  onBook: (session: ClassSessionCardProps) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedDate = parseDateParam(searchParams.get(DATE_PARAM));

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function navigate(weeks: -1 | 1) {
    const newDate = addDays(weekStart, weeks * 7);
    const params = new URLSearchParams(searchParams.toString());
    params.set(DATE_PARAM, format(newDate, 'yyyy-MM-dd'));
    router.push(`?${params.toString()}`, { scroll: false });
  }

  function selectDay(day: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(DATE_PARAM, format(day, 'yyyy-MM-dd'));
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div>
      {/* Week navigation */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Previous week"
          className="flex size-9 items-center justify-center rounded-xl border border-[#ede8e5] text-[#8b6b5c] transition-all hover:bg-[#ede8e5]/60 hover:text-[#4e2b22] hover:shadow-sm"
        >
          <ChevronLeftIcon className="size-4" />
        </button>

        <span className="text-sm font-semibold text-[#4e2b22] tabular-nums">
          {format(weekStart, 'd MMM')}
          {' – '}
          {format(addDays(weekStart, 6), 'd MMM yyyy')}
        </span>

        <button
          type="button"
          onClick={() => navigate(1)}
          aria-label="Next week"
          className="flex size-9 items-center justify-center rounded-xl border border-[#ede8e5] text-[#8b6b5c] transition-all hover:bg-[#ede8e5]/60 hover:text-[#4e2b22] hover:shadow-sm"
        >
          <ChevronRightIcon className="size-4" />
        </button>
      </div>

      {/* 7-column grid — horizontally scrollable on small screens */}
      <div className="overflow-x-auto rounded-xl border border-[#ede8e5]/80 bg-[#faf9f7] shadow-[0_4px_14px_rgba(78,43,34,0.04)]">
        <div className="flex min-w-[700px] divide-x divide-[#ede8e5]/60">
          {weekDays.map((day) => {
            const current = isToday(day);
            const selected = isSameDay(day, selectedDate);
            const daySessions = sessions
              .filter((s) => isSameDay(s.startsAt, day))
              .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

            return (
              <div
                key={day.toISOString()}
                className={[
                  'flex min-w-0 flex-1 flex-col',
                  current ? 'bg-[#6b8e6b]/5' : 'bg-[#faf9f7]',
                ].join(' ')}
              >
                {/* Day header */}
                <button
                  type="button"
                  onClick={() => selectDay(day)}
                  className={[
                    'group flex flex-col items-center border-b px-1 py-2.5 transition-all',
                    current ? 'border-[#6b8e6b]/20 hover:bg-[#6b8e6b]/10' : 'border-[#ede8e5]/60 hover:bg-[#ede8e5]/40',
                    selected && !current ? 'bg-[#ede8e5]/60' : '',
                  ].join(' ')}
                >
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest ${
                      current ? 'text-[#6b8e6b]' : 'text-[#8b6b5c] group-hover:text-[#6b3d32]'
                    }`}
                  >
                    {format(day, 'EEE')}
                  </span>
                  <span
                    className={`mt-1 flex size-7 items-center justify-center rounded-full text-sm font-bold tabular-nums transition-colors ${
                      current
                        ? 'bg-[#4e2b22] text-[#faf9f7]'
                        : selected
                          ? 'bg-[#4e2b22] text-[#faf9f7]'
                          : 'text-[#4e2b22] group-hover:bg-[#ede8e5]'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                </button>

                {/* Session blocks */}
                <div className="flex flex-col gap-1.5 p-1.5">
                  {daySessions.length === 0 ? (
                    <div className="flex items-center justify-center py-6">
                      <span className="text-[10px] font-medium text-[#c4a88a]/50">–</span>
                    </div>
                  ) : (
                    daySessions.map((session) => (
                      <SessionBlock
                        key={session.id}
                        session={session}
                        onClick={onBook}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 px-0.5">
        {(Object.entries(BLOCK_DOT) as [ClassType, string][]).map(([type, dot]) => (
          <span key={type} className="flex items-center gap-1.5 text-[11px] font-medium text-[#8b6b5c]">
            <span className={`size-2 rounded-full ${dot}`} />
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function WeekViewSkeleton() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="size-9 animate-pulse rounded-xl bg-[#ede8e5]/60" />
        <div className="h-4 w-36 animate-pulse rounded-lg bg-[#ede8e5]/60" />
        <div className="size-9 animate-pulse rounded-xl bg-[#ede8e5]/60" />
      </div>
      <div className="overflow-hidden rounded-xl border border-[#ede8e5]/60 bg-[#faf9f7] shadow-sm" aria-hidden>
        <div className="flex min-w-[700px] divide-x divide-[#ede8e5]/40">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-1 flex-col">
              <div className="flex flex-col items-center border-b border-[#ede8e5]/40 py-2.5 gap-1.5">
                <div className="h-2.5 w-6 animate-pulse rounded-md bg-[#ede8e5]/60" />
                <div className="size-7 animate-pulse rounded-full bg-[#ede8e5]/60" />
              </div>
              <div className="flex flex-col gap-1.5 p-1.5">
                {i % 3 !== 2 && (
                  <div className="h-16 animate-pulse rounded-lg bg-[#ede8e5]/40" />
                )}
                {i % 4 === 0 && (
                  <div className="h-14 animate-pulse rounded-lg bg-[#ede8e5]/40" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

export type WeekViewProps = {
  sessions: ClassSessionCardProps[];
  onBook: (session: ClassSessionCardProps) => void;
};

export function WeekView({ sessions, onBook }: WeekViewProps) {
  return (
    <Suspense fallback={<WeekViewSkeleton />}>
      <WeekViewInner sessions={sessions} onBook={onBook} />
    </Suspense>
  );
}
