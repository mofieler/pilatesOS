import Link from 'next/link';
import { Dumbbell, Layers, Users, AlertCircleIcon, ArrowRightIcon, UserIcon } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreditBalance = {
  creditType: 'mat' | 'reformer' | 'group' | 'session';
  balance: number;
  expiresAt: Date | null;
};

export type SessionPackage = {
  purchaseId: string;
  packageName: string;
  creditsAmount: number;
  purchasedAt: Date;
};

// ─── Pool config ──────────────────────────────────────────────────────────────

type PoolCreditType = 'reformer' | 'mat' | 'group';
type PoolBalance = { creditType: PoolCreditType; balance: number; expiresAt: Date | null };

const POOL = {
  reformer: {
    icon:        Dumbbell,
    title:       'Reformer Group',
    classes:     ['Reformer Group'],
    packages:    'Return to Life · Bloom',
    gradient:    'from-[#faf8f5] to-[#f0e8df]',
    ring:        'ring-[#c4a88a]/30',
    numberColor: 'text-[#4e2b22]',
    chipBg:      'bg-[#8b5a3c]/10 text-[#6b3d32] border-[#c4a88a]/20',
    iconBg:      'bg-[#8b5a3c]/10 text-[#6b3d32]',
    dot:         'bg-[#8b5a3c]',
    lowBg:       'bg-amber-50 border-amber-200 text-amber-700',
  },
  mat: {
    icon:        Layers,
    title:       'Mat Classes',
    classes:     ['MAT + Accessories', 'Private sessions', 'Duo sessions'],
    packages:    'Manual adjustment',
    gradient:    'from-[#f5f7f5] to-[#e8f0e8]',
    ring:        'ring-[#6b8e6b]/20',
    numberColor: 'text-[#3a5a3a]',
    chipBg:      'bg-[#6b8e6b]/10 text-[#4a6b4a] border-[#6b8e6b]/20',
    iconBg:      'bg-[#6b8e6b]/10 text-[#4a6b4a]',
    dot:         'bg-[#6b8e6b]',
    lowBg:       'bg-amber-50 border-amber-200 text-amber-700',
  },
  group: {
    icon:        Users,
    title:       'Yoga, Chair & More',
    classes:     ['Yoga', 'Chair Pilates', 'Sound Healing', 'Reformer Group', 'Mat Group'],
    packages:    'Essence · Empower',
    gradient:    'from-[#faf9f5] to-[#f5ede0]',
    ring:        'ring-[#c4a88a]/20',
    numberColor: 'text-[#4e2b22]',
    chipBg:      'bg-[#c4a88a]/15 text-[#4e2b22] border-[#c4a88a]/30',
    iconBg:      'bg-[#c4a88a]/20 text-[#4e2b22]',
    dot:         'bg-[#c4a88a]',
    lowBg:       'bg-amber-50 border-amber-200 text-amber-700',
  },
} as const;

// ─── Single pool card ─────────────────────────────────────────────────────────

function PoolCard({ balance }: { balance: PoolBalance }) {
  const cfg = POOL[balance.creditType];
  const Icon = cfg.icon;
  const isLow  = balance.balance > 0 && balance.balance <= 3;
  const isEmpty = balance.balance === 0;

  const expiryLabel = balance.expiresAt != null
    ? balance.expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-[#ede8e5]/60 bg-linear-to-br ${cfg.gradient} p-5 ring-1 ${cfg.ring} shadow-[0_4px_14px_rgba(78,43,34,0.04)] transition-all duration-300 hover:shadow-[0_8px_24px_rgba(78,43,34,0.08)] hover:-translate-y-0.5`}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-flex size-8 items-center justify-center rounded-lg ${cfg.iconBg}`}>
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="text-sm font-semibold text-[#4e2b22]">{cfg.title}</span>
        </div>
        <span className={`size-2.5 rounded-full ${cfg.dot}`} />
      </div>

      {/* Balance */}
      <div>
        <p className={`text-4xl font-bold tabular-nums leading-none tracking-tight ${cfg.numberColor}`}>
          {balance.balance}
        </p>
        <p className="mt-1.5 text-xs text-[#8b6b5c]">
          {balance.balance === 1 ? 'credit available' : 'credits available'}
        </p>
      </div>

      {/* Low / empty warning */}
      {(isLow || isEmpty) && (
        <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${cfg.lowBg}`}>
          <AlertCircleIcon className="size-3 shrink-0" />
          {isEmpty ? 'No credits — ' : 'Running low — '}
          <Link href="/credits" className="underline underline-offset-2 font-semibold text-amber-700">
            buy more
          </Link>
        </div>
      )}

      {/* Class type chips */}
      <div className="flex flex-wrap gap-1.5">
        {cfg.classes.map((cls) => (
          <span
            key={cls}
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.chipBg}`}
          >
            {cls}
          </span>
        ))}
      </div>

      {/* Packages source + expiry */}
      <div className="mt-auto space-y-1 border-t border-[#ede8e5]/60 pt-2.5">
        <p className="text-[10px] text-[#a6856f]">
          <span className="font-semibold">From:</span> {cfg.packages}
        </p>
        {expiryLabel && (
          <p className="text-[10px] text-[#a6856f]">
            <span className="font-semibold">Expires:</span> {expiryLabel}
          </p>
        )}
      </div>
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
    ? sessionExpiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="mt-5 border-t border-[#ede8e5]/60 pt-5">
      {/* Section heading */}
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex size-7 items-center justify-center rounded-lg bg-[#4e2b22]/10 text-[#4e2b22]">
          <UserIcon className="size-3.5" aria-hidden />
        </span>
        <p className="text-sm font-semibold text-[#4e2b22]">Private &amp; Duo Sessions</p>
        <span className="text-[11px] text-[#a6856f]">· 1 credit per session · Reformer only</span>
      </div>

      {isEmpty ? (
        /* Empty state */
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
          {/* Credit balance */}
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

          {/* Low / empty warning */}
          {sessionBalance === 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
              <AlertCircleIcon className="size-3 shrink-0" />
              No session credits —{' '}
              <Link href="/credits" className="underline underline-offset-2 font-semibold text-amber-700">
                buy a pack
              </Link>
            </div>
          )}

          {/* Purchased packages list */}
          {hasPurchases && (
            <div className="border-t border-[#ede8e5]/60 pt-2.5 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a6856f]">Your packs</p>
              {packages.map((p) => (
                <div key={p.purchaseId} className="flex items-center justify-between">
                  <p className="text-xs font-medium text-[#4e2b22]">{p.packageName}</p>
                  <p className="text-[10px] text-[#a6856f]">
                    {p.purchasedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
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
  // reformer and group always shown (packages exist for both).
  // mat only shown if user has non-zero mat balance (admin adjustment only).
  const ALWAYS_SHOW: PoolCreditType[] = ['reformer', 'group'];

  const matBalance = balances.find((b) => b.creditType === 'mat');
  const showMat    = matBalance != null && matBalance.balance > 0;

  const cards: PoolBalance[] = [
    ...ALWAYS_SHOW.map(
      (type): PoolBalance => balances.find((b) => b.creditType === type) as PoolBalance ?? { creditType: type, balance: 0, expiresAt: null },
    ),
    ...(showMat ? [matBalance! as PoolBalance] : []),
  ];

  const cols = cards.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3';

  const sessionBal = balances.find((b) => b.creditType === 'session');

  return (
    <div>
      <div className={`grid grid-cols-1 gap-3 ${cols}`}>
        {cards.map((b) => (
          <PoolCard key={b.creditType} balance={b} />
        ))}
      </div>
      <SessionPackagesSection
        packages={sessionPackages}
        sessionBalance={sessionBal?.balance ?? 0}
        sessionExpiry={sessionBal?.expiresAt ?? null}
      />
    </div>
  );
}
