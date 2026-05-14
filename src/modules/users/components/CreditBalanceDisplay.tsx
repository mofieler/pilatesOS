import Link from 'next/link';
import { Dumbbell, Layers, Users, AlertCircleIcon } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreditBalance = {
  creditType: 'mat' | 'reformer' | 'group';
  balance: number;
  expiresAt: Date | null;
};

// ─── Pool config ──────────────────────────────────────────────────────────────

const POOL = {
  reformer: {
    icon:        Dumbbell,
    title:       'Refo + Apparatus',
    classes:     ['Group classes', 'Private sessions', 'Duo sessions'],
    packages:    'Return to Life · Bloom · Session packs',
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
    packages:    'Mat session packages',
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
    title:       'All Group Classes',
    classes:     ['Chair + MAT', 'Yoga', 'Sound Healing', 'Refo (backup)', 'Mat (backup)'],
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

function PoolCard({ balance }: { balance: CreditBalance }) {
  const cfg = POOL[balance.creditType];
  const Icon = cfg.icon;
  const isLow   = balance.balance > 0 && balance.balance <= 3;
  const isEmpty  = balance.balance === 0;

  const expiryLabel = balance.expiresAt != null
    ? balance.expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-[#ede8e5]/60 bg-gradient-to-br ${cfg.gradient} p-5 ring-1 ${cfg.ring} shadow-[0_4px_14px_rgba(78,43,34,0.04)] transition-all duration-300 hover:shadow-[0_8px_24px_rgba(78,43,34,0.08)] hover:-translate-y-0.5`}>

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
          <Link href="/credits" className="underline underline-offset-2 font-semibold">
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

// ─── Public component ─────────────────────────────────────────────────────────

export function CreditBalanceDisplay({ balances }: { balances: CreditBalance[] }) {
  const ALL_TYPES: CreditBalance['creditType'][] = ['reformer', 'group', 'mat'];

  const filled = ALL_TYPES.map(
    (type) => balances.find((b) => b.creditType === type) ?? { creditType: type, balance: 0, expiresAt: null },
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {filled.map((b) => (
        <PoolCard key={b.creditType} balance={b} />
      ))}
    </div>
  );
}
