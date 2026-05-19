'use client';

import { Suspense, useState } from 'react';
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
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from 'lucide-react';
import type { WeekViewSessionData } from '@/modules/classes/actions/class.actions';

// ─── Colour maps ──────────────────────────────────────────────────────────────

type ClassType = WeekViewSessionData['classType'];

const BLOCK_BG: Record<ClassType, string> = {
  reformer_group:   'bg-[#8b5a3c]/10 border-[#c4a88a]/40 text-[#4e2b22]',
  reformer_private: 'bg-[#8b5a3c]/15 border-[#c4a88a]/50 text-[#4e2b22]',
  reformer_duo:     'bg-[#8b5a3c]/10 border-[#c4a88a]/35 text-[#4e2b22]',
  mat_group:        'bg-[#6b8e6b]/10 border-[#6b8e6b]/30 text-[#4a7c4a]',
  mat_private:      'bg-[#6b8e6b]/15 border-[#6b8e6b]/40 text-[#4a7c4a]',
  mat_duo:          'bg-[#6b8e6b]/10 border-[#6b8e6b]/25 text-[#4a7c4a]',
  chair:            'bg-amber-100 border-amber-300 text-amber-800',
  online:           'bg-slate-100 border-slate-200 text-slate-600',
  sound_healing:    'bg-[#9333ea]/10 border-[#9333ea]/30 text-[#9333ea]',
};

const BLOCK_DOT: Record<ClassType, string> = {
  reformer_group:   'bg-[#8b5a3c]',
  reformer_private: 'bg-[#8b5a3c]',
  reformer_duo:     'bg-[#8b5a3c]',
  mat_group:        'bg-[#6b8e6b]',
  mat_private:      'bg-[#6b8e6b]',
  mat_duo:          'bg-[#6b8e6b]',
  chair:            'bg-amber-500',
  online:           'bg-slate-400',
  sound_healing:    'bg-[#9333ea]',
};

export const ADMIN_WEEK_DATE_PARAM = 'week';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDateParam(raw: string | null): Date {
  if (!raw) return startOfToday();
  try { return parseISO(raw); } catch { return startOfToday(); }
}

// ─── GCal block ───────────────────────────────────────────────────────────────

function GCalBlock({
  block,
}: {
  block: { startsAt: Date; endsAt: Date; summary: string | null };
}) {
  return (
    <div
      className="w-full rounded-lg border border-[#c4a88a]/30 bg-[#f5f3f1] px-2.5 py-2 text-left cursor-default"
      title={block.summary ?? 'Google Calendar block'}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <span className="size-1.5 rounded-full shrink-0 bg-[#c4a88a]" />
        <p className="text-[10px] font-semibold tabular-nums leading-none text-[#8b6b5c]">
          {format(block.startsAt, 'HH:mm')}
          {' – '}
          {format(block.endsAt, 'HH:mm')}
        </p>
      </div>
      <p className="mt-1 text-xs font-bold leading-snug line-clamp-2 text-[#8b6b5c]">
        {block.summary ?? 'Blocked'}
      </p>
      <p className="mt-0.5 text-[10px] text-[#c4a88a]">Google Cal</p>
    </div>
  );
}

// ─── Pilateq session block ────────────────────────────────────────────────────

function AdminSessionBlock({
  session,
  onViewSession,
}: {
  session: WeekViewSessionData;
  onViewSession: (id: string) => void;
}) {
  const bg = BLOCK_BG[session.classType];
  const dot = BLOCK_DOT[session.classType];
  const isCancelled = session.status === 'cancelled';
  const isFull = session.bookedCount >= session.maxCapacity;

  return (
    <button
      type="button"
      onClick={() => { if (!isCancelled) onViewSession(session.id); }}
      className={[
        'w-full rounded-lg border px-2.5 py-2 text-left transition-all hover:brightness-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22]/20',
        bg,
        isCancelled ? 'opacity-40 cursor-default' : 'cursor-pointer',
      ].join(' ')}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`size-1.5 rounded-full shrink-0 ${dot} ${isCancelled ? 'opacity-50' : ''}`} />
        <p className="text-[10px] font-semibold tabular-nums leading-none opacity-70">
          {format(session.startsAt, 'HH:mm')}
          {' · '}
          {session.durationMinutes}m
        </p>
      </div>

      <p className="mt-1 text-xs font-bold leading-snug line-clamp-2">
        {session.templateName}
      </p>

      {session.instructorName && (
        <p className="mt-0.5 text-[10px] opacity-60 truncate">{session.instructorName}</p>
      )}

      <div className="mt-1.5 flex items-center gap-1.5">
        <span
          className={`text-[10px] font-semibold tabular-nums ${
            isFull ? 'text-red-500' : 'opacity-60'
          }`}
        >
          {session.bookedCount}/{session.maxCapacity}
        </span>
        {isCancelled && (
          <span className="text-[10px] font-semibold opacity-60">Cancelled</span>
        )}
      </div>
    </button>
  );
}

// ─── Inner (requires Suspense for useSearchParams) ────────────────────────────

type GCalBlockData = {
  id: string;
  instructorId: string | null;
  startsAt: Date;
  endsAt: Date;
  summary: string | null;
};

function AdminWeekViewInner({
  sessions,
  gcalBlocks,
  onNewClass,
  onViewSession,
}: {
  sessions: WeekViewSessionData[];
  gcalBlocks: GCalBlockData[];
  onNewClass: (date: string) => void;
  onViewSession: (id: string) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedDate = parseDateParam(searchParams.get(ADMIN_WEEK_DATE_PARAM));

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function navigate(weeks: -1 | 1) {
    const newDate = addDays(weekStart, weeks * 7);
    const params = new URLSearchParams(searchParams.toString());
    params.set(ADMIN_WEEK_DATE_PARAM, format(newDate, 'yyyy-MM-dd'));
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
          className="flex size-9 items-center justify-center rounded-xl border border-[#ede8e5] text-[#8b6b5c] transition-all hover:bg-[#ede8e5]/60 hover:text-[#4e2b22]"
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
          className="flex size-9 items-center justify-center rounded-xl border border-[#ede8e5] text-[#8b6b5c] transition-all hover:bg-[#ede8e5]/60 hover:text-[#4e2b22]"
        >
          <ChevronRightIcon className="size-4" />
        </button>
      </div>

      {/* 7-column grid */}
      <div className="overflow-x-auto rounded-xl border border-[#ede8e5]/80 bg-[#faf9f7] shadow-[0_4px_14px_rgba(78,43,34,0.04)]">
        <div className="flex min-w-[700px] divide-x divide-[#ede8e5]/60">
          {weekDays.map((day) => {
            const current = isToday(day);
            const daySessions = sessions
              .filter((s) => isSameDay(s.startsAt, day))
              .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
            const dayBlocks = gcalBlocks
              .filter((b) => isSameDay(b.startsAt, day))
              .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

            // Merge and sort sessions + blocks by start time
            const combined: Array<
              | { kind: 'session'; data: WeekViewSessionData }
              | { kind: 'block'; data: GCalBlockData }
            > = [
              ...daySessions.map((s) => ({ kind: 'session' as const, data: s })),
              ...dayBlocks.map((b) => ({ kind: 'block' as const, data: b })),
            ].sort((a, b) => a.data.startsAt.getTime() - b.data.startsAt.getTime());

            return (
              <div
                key={day.toISOString()}
                className={[
                  'flex min-w-0 flex-1 flex-col',
                  current ? 'bg-[#6b8e6b]/5' : 'bg-[#faf9f7]',
                ].join(' ')}
              >
                {/* Day header */}
                <div
                  className={[
                    'flex flex-col items-center border-b px-1 py-2 relative',
                    current ? 'border-[#6b8e6b]/20' : 'border-[#ede8e5]/60',
                  ].join(' ')}
                >
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest ${
                      current ? 'text-[#6b8e6b]' : 'text-[#8b6b5c]'
                    }`}
                  >
                    {format(day, 'EEE')}
                  </span>
                  <span
                    className={`mt-1 flex size-7 items-center justify-center rounded-full text-sm font-bold tabular-nums ${
                      current ? 'bg-[#4e2b22] text-[#faf9f7]' : 'text-[#4e2b22]'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>

                  {/* "+" add button */}
                  <button
                    type="button"
                    onClick={() => onNewClass(format(day, 'yyyy-MM-dd'))}
                    title={`Schedule class on ${format(day, 'EEEE d MMM')}`}
                    className="absolute right-1 top-1/2 -translate-y-1/2 flex size-5 items-center justify-center rounded-full bg-[#4e2b22]/10 text-[#4e2b22] hover:bg-[#4e2b22] hover:text-white transition-all"
                  >
                    <PlusIcon className="size-3" />
                  </button>
                </div>

                {/* Event blocks */}
                <div className="flex flex-col gap-1.5 p-1.5">
                  {combined.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => onNewClass(format(day, 'yyyy-MM-dd'))}
                      className="flex items-center justify-center py-6 w-full rounded-lg border border-dashed border-[#ede8e5] hover:border-[#c4a88a]/60 hover:bg-[#faf9f7] transition-all group"
                    >
                      <span className="text-[10px] font-medium text-[#c4a88a]/50 group-hover:text-[#c4a88a]">
                        + add class
                      </span>
                    </button>
                  ) : (
                    combined.map((item, idx) =>
                      item.kind === 'session' ? (
                        <AdminSessionBlock
                          key={item.data.id}
                          session={item.data}
                          onViewSession={onViewSession}
                        />
                      ) : (
                        <GCalBlock key={`block-${idx}`} block={item.data} />
                      ),
                    )
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
            {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#8b6b5c]">
          <span className="size-2 rounded-full bg-[#c4a88a]" />
          Google Calendar
        </span>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="size-9 animate-pulse rounded-xl bg-[#ede8e5]/60" />
        <div className="h-4 w-36 animate-pulse rounded-lg bg-[#ede8e5]/60" />
        <div className="size-9 animate-pulse rounded-xl bg-[#ede8e5]/60" />
      </div>
      <div className="overflow-hidden rounded-xl border border-[#ede8e5]/60 bg-[#faf9f7]">
        <div className="flex min-w-[700px] divide-x divide-[#ede8e5]/40">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-1 flex-col">
              <div className="flex flex-col items-center border-b border-[#ede8e5]/40 py-2.5 gap-1.5">
                <div className="h-2.5 w-6 animate-pulse rounded-md bg-[#ede8e5]/60" />
                <div className="size-7 animate-pulse rounded-full bg-[#ede8e5]/60" />
              </div>
              <div className="flex flex-col gap-1.5 p-1.5">
                {i % 3 !== 2 && <div className="h-16 animate-pulse rounded-lg bg-[#ede8e5]/40" />}
                {i % 4 === 0 && <div className="h-14 animate-pulse rounded-lg bg-[#ede8e5]/40" />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

export type AdminWeekViewProps = {
  sessions: WeekViewSessionData[];
  gcalBlocks: GCalBlockData[];
  onNewClass: (date: string) => void;
  onViewSession: (id: string) => void;
};

export function AdminWeekView(props: AdminWeekViewProps) {
  return (
    <Suspense fallback={<Skeleton />}>
      <AdminWeekViewInner {...props} />
    </Suspense>
  );
}

export type { GCalBlockData };
