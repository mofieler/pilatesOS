import Link from 'next/link';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { BadgeCheckIcon, ArrowRightIcon, RefreshCwIcon, CalendarIcon } from 'lucide-react';
import { LEGACY_CREDIT_TYPE_LABELS } from '@/lib/config/class-types';

const CREDIT_TYPE_LABEL = LEGACY_CREDIT_TYPE_LABELS;
import type { MyMembership } from '@/modules/billing/actions/membership.actions';

// ─── Credit type accent colours ───────────────────────────────────────────────

const CREDIT_ACCENT: Record<string, { bg: string; text: string; dot: string }> = {
  pass:    { bg: 'bg-[#d4a574]/10', text: 'text-[#8b5e3c]', dot: 'bg-[#d4a574]' },
  session: { bg: 'bg-[#4e2b22]/8',  text: 'text-[#4e2b22]', dot: 'bg-[#4e2b22]' },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  membership: MyMembership | null;
}

export function MembershipStatusCard({ membership }: Props) {
  if (!membership) return null;

  const accent   = CREDIT_ACCENT[membership.creditType] ?? CREDIT_ACCENT.pass;
  const expired  = isPast(membership.endsAt);
  const nextGrant = membership.nextCreditGrantAt;

  return (
    <section className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/90 to-[#ede8e5]/50 p-6 shadow-[0_4px_20px_rgba(78,43,34,0.04)]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#4e2b22]/10 text-[#4e2b22]">
            <BadgeCheckIcon className="size-4" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold text-primary">Membership</h2>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${expired ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>
          <span className={`size-1.5 rounded-full ${expired ? 'bg-slate-400' : 'bg-emerald-500'}`} />
          {expired ? 'Expired' : 'Active'}
        </span>
      </div>

      {/* Plan name + credit type */}
      <div className="mb-5">
        <h3 className="text-xl font-bold text-[#4e2b22]">{membership.planName}</h3>
        {membership.planDescription && (
          <p className="mt-1 text-sm text-[#8b6b5c]">{membership.planDescription}</p>
        )}
        <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${accent.bg} ${accent.text}`}>
          <span className={`size-1.5 rounded-full ${accent.dot}`} />
          {CREDIT_TYPE_LABEL[membership.creditType]} · {membership.weeklyCredits} credit{membership.weeklyCredits !== 1 ? 's' : ''}/week
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl bg-white/60 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <CalendarIcon className="size-3.5 text-[#8b6b5c]" />
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#8b6b5c]">Valid Until</p>
          </div>
          <p className="text-sm font-semibold text-[#4e2b22]">
            {format(membership.endsAt, 'd MMM yyyy')}
          </p>
          <p className="text-[11px] text-[#a6856f] mt-0.5">
            {expired ? 'Expired' : formatDistanceToNow(membership.endsAt, { addSuffix: true })}
          </p>
        </div>

        <div className="rounded-xl bg-white/60 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <RefreshCwIcon className="size-3.5 text-[#8b6b5c]" />
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#8b6b5c]">Next Credits</p>
          </div>
          {nextGrant && !expired ? (
            <>
              <p className="text-sm font-semibold text-[#4e2b22]">
                {format(nextGrant, 'd MMM yyyy')}
              </p>
              <p className="text-[11px] text-[#a6856f] mt-0.5">
                {formatDistanceToNow(nextGrant, { addSuffix: true })}
              </p>
            </>
          ) : (
            <p className="text-sm font-semibold text-[#8b6b5c]">—</p>
          )}
        </div>
      </div>

      {/* CTA */}
      <Link
        href="/credits?tab=membership"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#4e2b22] hover:text-[#6b3d32] transition-colors"
      >
        View membership details
        <ArrowRightIcon className="size-4" aria-hidden />
      </Link>
    </section>
  );
}
