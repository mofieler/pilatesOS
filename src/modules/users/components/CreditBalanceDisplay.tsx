import Link from 'next/link';
import { Layers, AlertCircleIcon, ArrowRightIcon, UserIcon } from 'lucide-react';
import { formatStudio } from '@/lib/utils/date.utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreditBalance = {
  creditType: 'pass' | 'session';
  balance: number;
  expiresAt: Date | null;
};

export type SessionPackage = {
  purchaseId: string;
  packageName: string;
  creditsAmount: number;
  purchasedAt: Date;
};

// ─── Pass credits card ────────────────────────────────────────────────────────

function PassCard({ balance }: { balance: CreditBalance }) {
  const isLow = balance.balance > 0 && balance.balance <= 3;
  const isEmpty = balance.balance === 0;

  const expiryLabel = balance.expiresAt != null
    ? formatStudio(balance.expiresAt, 'd MMM yyyy')
    : null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#ede8e5]/60 bg-linear-to-br from-[#faf9f5] to-[#f5ede0] p-5 ring-1 ring-[#c4a88a]/30 shadow-[0_4px_14px_rgba(78,43,34,0.04)] transition-all duration-300 hover:shadow-[0_8px_24px_rgba(78,43,34,0.08)] hover:-translate-y-0.5">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[#c4a88a]/20 text-[#4e2b22]">
          <Layers className="size-4" aria-hidden />
        </span>
        <p className="text-sm font-semibold text-[#4e2b22]">Pass Credits</p>
      </div>

      <p className="text-[11px] text-[#8b6b5c]">
        Use for any group class — Mat, Reformer, Chair, Yoga, Sound Healing.
        Cost varies by class type.
      </p>

      <div>
        <p className="text-4xl font-bold tabular-nums leading-none tracking-tight text-[#4e2b22]">
          {balance.balance}
        </p>
        <p className="mt-1 text-xs text-[#8b6b5c]">
          {balance.balance === 1 ? 'credit available' : 'credits available'}
        </p>
      </div>

      {isLow && !isEmpty && (
        <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
          <AlertCircleIcon className="size-3 shrink-0" />
          Running low — consider topping up
        </div>
      )}

      {isEmpty && (
        <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
          <AlertCircleIcon className="size-3 shrink-0" />
          No credits —{' '}
          <Link href="/credits" className="underline underline-offset-2 font-semibold text-amber-700">
            buy a pack
          </Link>
        </div>
      )}

      {expiryLabel && (
        <p className="text-[10px] text-[#a6856f]">
          <span className="font-semibold">Expires:</span> {expiryLabel}
        </p>
      )}
    </div>
  );
}

// ─── Private & Duo session section ───────────────────────────────────────────

function SessionPackagesSection({
  packages,
  sessionBalance,
  sessionExpiry,
}: {
  packages: SessionPackage[];
  sessionBalance: number;
  sessionExpiry: Date | null;
}) {
  const hasCredits  = sessionBalance > 0;
  const hasPurchases = packages.length > 0;
  const isEmpty     = !hasCredits && !hasPurchases;

  const expiryLabel = sessionExpiry != null
    ? formatStudio(sessionExpiry, 'd MMM yyyy')
    : null;

  return (
    <div className="mt-5 border-t border-[#ede8e5]/60 pt-5">
      {/* Section heading */}
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex size-7 items-center justify-center rounded-lg bg-[#4e2b22]/10 text-[#4e2b22]">
          <UserIcon className="size-3.5" aria-hidden />
        </span>
        <p className="text-sm font-semibold text-[#4e2b22]">Private &amp; Duo Sessions</p>
        <span className="text-[11px] text-[#a6856f]">· Mat 3 · Reformer 5 credits</span>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-[#c4a88a]/40 bg-[#faf9f7]/60 px-4 py-6 text-center">
          <p className="text-sm font-medium text-[#6b3d32]">No session pack yet</p>
          <p className="text-xs text-[#a6856f]">Private and duo sessions require a session pack</p>
          <Link
            href="/credits"
            className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#4e2b22] px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#6b3d32]"
          >
            Browse session packs
            <ArrowRightIcon className="size-3" aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-[#ede8e5]/80 bg-white/60 px-4 py-4 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl font-bold tabular-nums leading-none tracking-tight text-[#4e2b22]">
                {sessionBalance}
              </p>
              <p className="mt-1 text-xs text-[#8b6b5c]">
                {sessionBalance === 1 ? 'session credit available' : 'session credits available'}
              </p>
            </div>
            {expiryLabel && (
              <p className="text-[10px] text-[#a6856f] text-right">
                <span className="font-semibold">Expires:</span><br />{expiryLabel}
              </p>
            )}
          </div>

          {sessionBalance === 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
              <AlertCircleIcon className="size-3 shrink-0" />
              No session credits —{' '}
              <Link href="/credits" className="underline underline-offset-2 font-semibold text-amber-700">
                buy a pack
              </Link>
            </div>
          )}

          {hasPurchases && (
            <div className="border-t border-[#ede8e5]/60 pt-2.5 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a6856f]">Your packs</p>
              {packages.map((p) => (
                <div key={p.purchaseId} className="flex items-center justify-between">
                  <p className="text-xs font-medium text-[#4e2b22]">{p.packageName}</p>
                  <p className="text-[10px] text-[#a6856f]">
                    {formatStudio(p.purchasedAt, 'd MMM yyyy')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function CreditBalanceDisplay({
  balances,
  sessionPackages,
}: {
  balances: CreditBalance[];
  sessionPackages: SessionPackage[];
}) {
  const passBalance = balances.find((b) => b.creditType === 'pass')
    ?? { creditType: 'pass' as const, balance: 0, expiresAt: null };
  const sessionBalance = balances.find((b) => b.creditType === 'session');

  return (
    <div>
      <PassCard balance={passBalance} />
      <SessionPackagesSection
        packages={sessionPackages}
        sessionBalance={sessionBalance?.balance ?? 0}
        sessionExpiry={sessionBalance?.expiresAt ?? null}
      />
    </div>
  );
}
