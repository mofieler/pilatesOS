import { AlertTriangleIcon, CalendarClockIcon } from 'lucide-react';
import { formatStudio } from '@/lib/utils/date.utils';
import type { LotBreakdownEntry } from '@/modules/billing/services/lot.service';

// ─── Single lot row ───────────────────────────────────────────────────────────

function LotRow({ lot }: { lot: LotBreakdownEntry }) {
  const isExpiringSoon = lot.daysUntilExpiry <= 14;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#ede8e5]/60 bg-white/70 px-3 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base font-bold tabular-nums text-[#4e2b22] shrink-0">
          {lot.remainingAmount}
        </span>
        <span className="text-xs text-[#8b6b5c] truncate">
          of {lot.originalAmount}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {lot.atRisk && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            <AlertTriangleIcon className="size-3" aria-hidden />
            at risk
          </span>
        )}
        <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${
          isExpiringSoon ? 'text-amber-700' : 'text-[#8b6b5c]'
        }`}>
          <CalendarClockIcon className="size-3 shrink-0" aria-hidden />
          {formatStudio(lot.expiresAt, 'd MMM yyyy')}
        </span>
      </div>
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function LotBreakdown({
  lots,
  emptyText = 'No active lots.',
}: {
  lots: LotBreakdownEntry[];
  emptyText?: string;
}) {
  if (lots.length === 0) {
    return (
      <p className="text-xs italic text-[#a6856f]">{emptyText}</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {lots.map((lot) => (
        <LotRow key={lot.id} lot={lot} />
      ))}
    </div>
  );
}
