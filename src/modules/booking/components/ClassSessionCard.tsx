'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { CheckCircleIcon, ClockIcon, MapPinIcon, UsersIcon, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClassSessionCardProps = {
  id: string;
  name: string;
  classType: 'mat' | 'reformer' | 'private' | 'duo' | 'group' | 'online' | 'sound_healing';
  startsAt: Date;
  durationMinutes: number;
  instructorName: string;
  instructorAvatarUrl?: string | null;
  vibeTags?: string[];
  bookedCount: number;
  maxCapacity: number;
  creditCost: number;
  creditType: 'mat_group' | 'reformer_group' | 'private_session' | 'duo_group' | 'general_group' | 'online_class' | 'sound_healing';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  isBookedByUser: boolean;
  location?: string | null;
  /** Marked true when the instructor has an overlapping external Google Calendar event. */
  isBlocked?: boolean;
  /** Tooltip/label shown when isBlocked is true. */
  blockReason?: string | null;
  onBook?: (sessionId: string) => void;
  onJoinWaitlist?: (sessionId: string) => void;
};

type CardState = 'available' | 'nearly-full' | 'full' | 'cancelled' | 'booked-by-user';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveState({
  status,
  isBookedByUser,
  bookedCount,
  maxCapacity,
}: ClassSessionCardProps): CardState {
  if (status === 'cancelled') return 'cancelled';
  if (isBookedByUser) return 'booked-by-user';
  if (maxCapacity > 0 && bookedCount >= maxCapacity) return 'full';
  const fillRatio = maxCapacity > 0 ? bookedCount / maxCapacity : 0;
  if (fillRatio >= 0.8) return 'nearly-full';
  return 'available';
}

const CLASS_TYPE_LABEL: Record<ClassSessionCardProps['classType'], string> = {
  mat: 'Mat Class',
  reformer: 'Reformer Class',
  private: 'Private Session',
  duo: 'Duo Session',
  group: 'Group Class',
  online: 'Online Class',
  sound_healing: 'Sound Healing',
};

const CLASS_TYPE_ICON: Record<ClassSessionCardProps['classType'], string> = {
  mat: 'Mat',
  reformer: 'Ref',
  private: 'Prv',
  duo: 'Duo',
  group: 'Grp',
  online: 'Web',
  sound_healing: 'Sound',
};

const CREDIT_DOT: Record<ClassSessionCardProps['creditType'], string> = {
  mat_group: 'bg-[#8b6b5c]',
  reformer_group: 'bg-[#6b8e6b]',
  private_session: 'bg-[#c4a88a]',
  duo_group: 'bg-[#6366f1]',
  general_group: 'bg-[#0891b2]',
  online_class: 'bg-[#ea580c]',
  sound_healing: 'bg-[#9333ea]',
};

const CREDIT_LABEL: Record<ClassSessionCardProps['creditType'], string> = {
  mat_group: 'Mat Credit',
  reformer_group: 'Reformer Credit',
  private_session: 'Private Session',
  duo_group: 'Duo Credit',
  general_group: 'Group Credit',
  online_class: 'Online Credit',
  sound_healing: 'Sound Healing Credit',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function InstructorAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (avatarUrl) {
    return (
      <div className="relative">
        <img
          src={avatarUrl}
          alt={name}
          className="size-10 rounded-full object-cover ring-2 ring-[#ede8e5] shadow-sm"
        />
        <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-[#4e2b22]/10" />
      </div>
    );
  }

  return (
    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ede8e5] to-[#e5dfdb] text-sm font-semibold text-[#6b3d32] ring-2 ring-[#faf9f7] shadow-sm">
      {initials}
    </span>
  );
}

function SpotBar({
  fillPercent,
  barColor,
}: {
  fillPercent: number;
  barColor: string;
}) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#ede8e5]/60">
      <div
        className={cn("h-full rounded-full transition-all duration-500 ease-out", barColor)}
        style={{ width: `${fillPercent}%` }}
      />
    </div>
  );
}

function StatusBadge({ state, isBookedByUser }: { state: CardState; isBookedByUser: boolean }) {
  if (isBookedByUser) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6b8e6b]/15 px-3 py-1 text-xs font-semibold text-[#4a7c4a] backdrop-blur-sm">
        <CheckCircleIcon className="size-3.5" aria-hidden />
        Booked
      </span>
    );
  }

  if (state === 'cancelled') {
    return (
      <span className="rounded-full bg-[#c45c4a]/10 px-3 py-1 text-xs font-semibold text-[#c45c4a]">
        Cancelled
      </span>
    );
  }

  if (state === 'nearly-full') {
    return (
      <span className="rounded-full bg-[#d4a574]/15 px-3 py-1 text-xs font-semibold text-[#b58a5c]">
        Almost full
      </span>
    );
  }

  if (state === 'full') {
    return (
      <span className="rounded-full bg-[#c45c4a]/10 px-3 py-1 text-xs font-semibold text-[#c45c4a]">
        Full
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#6b8e6b]/10 px-3 py-1 text-xs font-medium text-[#5a7d5a]">
      <Sparkles className="size-3" aria-hidden />
      Available
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ClassSessionCard(props: ClassSessionCardProps) {
  const {
    id,
    name,
    classType,
    startsAt,
    durationMinutes,
    instructorName,
    instructorAvatarUrl,
    vibeTags = [],
    bookedCount,
    maxCapacity,
    creditCost,
    creditType,
    location,
    isBlocked = false,
    blockReason,
    onBook,
    onJoinWaitlist,
  } = props;



  function handleBookClick() {
    onBook?.(id);
  }


  const state = deriveState(props);
  const spotsLeft = Math.max(0, maxCapacity - bookedCount);
  const fillRatio = maxCapacity > 0 ? bookedCount / maxCapacity : 0;
  const fillPercent = Math.min(fillRatio * 100, 100);

  const barColor =
    fillRatio >= 1
      ? 'bg-gradient-to-r from-[#c45c4a] to-[#d47260]'
      : fillRatio >= 0.8
        ? 'bg-gradient-to-r from-[#d4a574] to-[#e5b88a]'
        : 'bg-gradient-to-r from-[#6b8e6b] to-[#8ab38a]';

  const spotsText =
    state === 'full'
      ? 'Fully booked'
      : spotsLeft === 1
        ? '1 spot left'
        : `${spotsLeft} spots left`;

  const isCancelled = state === 'cancelled';
  const isBookedByUser = state === 'booked-by-user';

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-2xl border border-[#ede8e5]/80 p-5 transition-all duration-300",
        "bg-gradient-to-br from-[#faf9f7]/90 to-[#f5f3f1]/80",
        "backdrop-blur-xl shadow-[0_4px_20px_rgba(78,43,34,0.04),0_8px_40px_rgba(78,43,34,0.02)]",
        "hover:shadow-[0_8px_30px_rgba(78,43,34,0.08),0_16px_60px_rgba(78,43,34,0.04)]",
        "hover:-translate-y-1 hover:border-[#c4a88a]/30",
        isCancelled && "opacity-60 grayscale",
        isBlocked && !isCancelled && "opacity-70"
      )}
      title={isBlocked ? blockReason ?? 'Instructor unavailable' : undefined}
    >
      {/* ── Top row: class type + state badge ── */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-[#ede8e5]/60 text-[9px] font-bold uppercase tracking-wide text-[#6b3d32]" aria-hidden>
            {CLASS_TYPE_ICON[classType]}
          </span>
          <Badge
            variant="outline"
            className="rounded-full border-[#c4a88a]/40 bg-[#ede8e5]/50 px-2.5 py-0.5 text-xs font-medium capitalize text-[#6b3d32] backdrop-blur-sm"
          >
            {CLASS_TYPE_LABEL[classType]}
          </Badge>
        </div>

        <StatusBadge state={state} isBookedByUser={isBookedByUser} />
      </div>

      {/* ── Class name ── */}
      <h3 className="mb-3 text-lg font-semibold leading-snug text-primary">{name}</h3>

      {/* ── Instructor ── */}
      <div className="mb-4 flex items-center gap-3">
        <InstructorAvatar name={instructorName} avatarUrl={instructorAvatarUrl} />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-primary">{instructorName}</span>
          <span className="text-xs text-muted">Instructor</span>
        </div>
      </div>

      {/* ── Meta: time · duration · location ── */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-secondary">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-cream/50 px-2.5 py-1">
          <ClockIcon className="size-4 shrink-0 text-muted" aria-hidden />
          <span className="font-medium text-primary">{format(startsAt, 'HH:mm')}</span>
          <span className="text-muted">· {durationMinutes} min</span>
        </span>
        {location && (
          <span className="inline-flex items-center gap-1.5 text-muted">
            <MapPinIcon className="size-4 shrink-0" aria-hidden />
            {location}
          </span>
        )}
      </div>

      {/* ── Vibe tags ── */}
      {vibeTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {vibeTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[#faf9f7] border border-[#ede8e5] px-3 py-1 text-xs font-medium text-[#6b3d32] shadow-sm"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* ── Spot availability ── */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <UsersIcon className="size-4" aria-hidden />
            {spotsText}
          </span>
          <span className="text-xs font-medium text-muted">
            {spotsLeft}/{maxCapacity} spots
          </span>
        </div>
        <SpotBar fillPercent={fillPercent} barColor={barColor} />
      </div>

      {/* ── Footer: credit cost + CTA ── */}
      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 rounded-full bg-[#ede8e5]/60 px-3 py-1.5 backdrop-blur-sm">
          <span className={cn("size-2.5 rounded-full", CREDIT_DOT[creditType])} />
          <span className="text-sm font-medium text-[#4e2b22]">
            {creditCost} {CREDIT_LABEL[creditType]}
          </span>
        </div>

        {!isCancelled && !isBookedByUser && !isBlocked && (
          <>
            {state === 'full' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onJoinWaitlist?.(id)}
                className="rounded-xl border-[#c4a88a]/50 text-[#6b3d32] hover:bg-[#ede8e5]/80"
              >
                Join Waitlist
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleBookClick}
                disabled={false}
                className="rounded-xl bg-gradient-to-r from-[#4e2b22] to-[#6b3d32] text-[#faf9f7] hover:from-[#5a3228] hover:to-[#7a4538] shadow-[0_4px_14px_rgba(78,43,34,0.25)] hover:shadow-[0_6px_20px_rgba(78,43,34,0.35)] transition-all duration-200"
              >
                Book Class
              </Button>
            )}
          </>
        )}

        {isBlocked && !isCancelled && !isBookedByUser && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8b6b5c]">
            Instructor unavailable
          </span>
        )}

        {isBookedByUser && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5a7d5a]">
            <CheckCircleIcon className="size-4" />
            {"You're in"}
          </span>
        )}
      </div>

    </article>
  );
}
