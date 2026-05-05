import { FlameIcon, Sparkles } from 'lucide-react';

export function StreakCard({ streak = 0 }: { streak?: number }) {
  return (
    <div className="group flex items-center gap-4 rounded-2xl border border-[#ede8e5]/60 bg-gradient-to-br from-[#faf9f7] to-[#f5ebe0] p-5 shadow-[0_4px_14px_rgba(78,43,34,0.04)] backdrop-blur-sm transition-all duration-300 hover:shadow-[0_8px_24px_rgba(78,43,34,0.08)] hover:-translate-y-0.5">
      {/* Flame icon */}
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#d4a574]/20 to-[#c4a88a]/30 ring-1 ring-[#c4a88a]/20">
        <FlameIcon className="size-6 text-[#c45c4a]" aria-hidden />
      </div>

      {/* Text */}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#4e2b22] flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-[#c4a88a]" />
          Class Streak
        </p>
        {streak > 0 ? (
          <p className="text-2xl font-bold tabular-nums text-[#c45c4a] mt-1">
            {streak}
            <span className="ml-1.5 text-sm font-medium text-[#8b6b5c]">
              {streak === 1 ? 'week' : 'weeks'}
            </span>
          </p>
        ) : (
          <p className="text-sm text-[#8b6b5c] mt-1">Book your first class to start your streak!</p>
        )}
      </div>

      {/* Coming soon badge */}
      <span className="ml-auto shrink-0 rounded-full bg-[#ede8e5]/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#8b6b5c] border border-[#c4a88a]/20">
        Phase 3
      </span>
    </div>
  );
}
