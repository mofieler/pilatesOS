import { Users, Dumbbell, Sparkles } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreditBalance = {
  creditType: 'mat' | 'reformer';
  balance: number;
  expiresAt: Date | null;
};

// ─── Config per credit tier ───────────────────────────────────────────────────

const TIER = {
  mat: {
    label: 'Mat Credits',
    icon: Users,
    pill: 'bg-[#6b8e6b]/15 text-[#4a7c4a] border-[#6b8e6b]/20',
    ring: 'ring-[#6b8e6b]/20',
    dot: 'bg-[#6b8e6b]',
    numberColor: 'text-[#4a7c4a]',
    gradient: 'from-[#f5f7f5] to-[#e8f0e8]',
  },
  reformer: {
    label: 'Reformer Credits',
    icon: Dumbbell,
    pill: 'bg-[#8b5a3c]/15 text-[#6b3d32] border-[#c4a88a]/30',
    ring: 'ring-[#c4a88a]/20',
    dot: 'bg-[#8b5a3c]',
    numberColor: 'text-[#6b3d32]',
    gradient: 'from-[#faf8f5] to-[#f5ebe0]',
  },
} as const;

// ─── Single credit card ───────────────────────────────────────────────────────

function CreditCard({ balance }: { balance: CreditBalance }) {
  const cfg = TIER[balance.creditType];
  const Icon = cfg.icon;

  const expiryLabel =
    balance.expiresAt != null
      ? `Expires ${balance.expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : null;

  return (
    <div
      className={`group flex flex-col gap-4 rounded-2xl border border-[#ede8e5]/60 bg-gradient-to-br ${cfg.gradient} p-5 shadow-[0_4px_14px_rgba(78,43,34,0.04)] backdrop-blur-sm ring-1 ${cfg.ring} transition-all duration-300 hover:shadow-[0_8px_24px_rgba(78,43,34,0.08)] hover:-translate-y-0.5`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-sm ${cfg.pill}`}
        >
          <Icon className="size-3.5" aria-hidden />
          {cfg.label}
        </span>
        <span className={`size-3 rounded-full shadow-sm ${cfg.dot}`} />
      </div>

      {/* Balance */}
      <div className="mt-1">
        <p className={`text-4xl font-bold tabular-nums leading-none tracking-tight ${cfg.numberColor}`}>
          {balance.balance}
        </p>
        <p className="mt-2 text-xs font-medium text-[#8b6b5c]">
          {balance.balance === 1 ? 'credit' : 'credits'} available
        </p>
      </div>

      {/* Expiry */}
      {expiryLabel && (
        <p className="text-[11px] font-medium text-[#c4a88a]">{expiryLabel}</p>
      )}
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function CreditBalanceDisplay({ balances }: { balances: CreditBalance[] }) {
  const ALL_TYPES: CreditBalance['creditType'][] = ['mat', 'reformer'];

  // Ensure all three tiers are always shown, even if balance row doesn't exist yet
  const filled = ALL_TYPES.map(
    (type) => balances.find((b) => b.creditType === type) ?? { creditType: type, balance: 0, expiresAt: null },
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {filled.map((b) => (
        <CreditCard key={b.creditType} balance={b} />
      ))}
    </div>
  );
}
