'use client';

import { useState, useTransition, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { formatStudio } from '@/lib/utils/date.utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  adjustUserCreditsAction,
  getUserCreditAdjustmentsAction,
} from '@/modules/billing/actions/adminCredits.actions';
import {
  User,
  Coins,
  Plus,
  Minus,
  Search,
  ChevronRight,
  ChevronDown,
  History,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type CreditBalance = {
  id: string;
  creditType: string;
  balance: number;
  expiresAt: Date | null;
  updatedAt: Date;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  balances: CreditBalance[];
};

type Adjustment = {
  id: string;
  creditType: string;
  amountDelta: number;
  reason: string;
  newBalance: number;
  notes: string | null;
  createdAt: Date;
};

const CREDIT_TYPE_LABELS: Record<string, string> = {
  pass:    'Credits',
  session: 'Session Credits',
};

const CREDIT_TYPES = Object.keys(CREDIT_TYPE_LABELS) as (keyof typeof CREDIT_TYPE_LABELS)[];

const CREDIT_TYPE_COLORS: Record<string, string> = {
  pass:    'bg-[#c4a88a]/20 text-[#4e2b22] border-[#c4a88a]/40',
  session: 'bg-[#4e2b22]/10 text-[#4e2b22] border-[#4e2b22]/20',
};

function BalancePill({ creditType, balance }: { creditType: string; balance: number }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full text-xs font-semibold tabular-nums',
        CREDIT_TYPE_COLORS[creditType] ?? 'bg-[#ede8e5] text-[#8b6b5c]',
      )}
    >
      {balance} {CREDIT_TYPE_LABELS[creditType] ?? creditType}
    </Badge>
  );
}

// ─── Adjustment Form ──────────────────────────────────────────────────────────
function AdjustForm({
  userId,
  userName,
  onSuccess,
}: {
  userId: string;
  userName: string;
  onSuccess: (delta: number, creditType: string, newBalance: number) => void;
}) {
  const [mode, setMode]           = useState<'add' | 'deduct'>('add');
  const [creditType, setCreditType] = useState(CREDIT_TYPES[0]);
  const [amount, setAmount]       = useState('');
  const [reason, setReason]       = useState('');
  const [notes, setNotes]         = useState('');
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const n = parseInt(amount, 10);
    if (!n || n <= 0) { setError('Enter a positive whole number.'); return; }
    if (!reason.trim()) { setError('Reason is required.'); return; }

    const delta = mode === 'add' ? n : -n;

    startTransition(async () => {
      const result = await adjustUserCreditsAction({
        userId,
        creditType: creditType as any,
        amountDelta: delta,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });

      if (!result.success) {
        setError(result.error ?? 'Something went wrong');
        return;
      }

      setSuccess(
        `${mode === 'add' ? '+' : '-'}${n} ${CREDIT_TYPE_LABELS[creditType]} credits. New balance: ${result.data.newBalance}`,
      );
      onSuccess(delta, creditType, result.data.newBalance);
      setAmount('');
      setReason('');
      setNotes('');
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <p className="text-sm font-semibold text-[#4e2b22]">Adjust credits for {userName}</p>

      {/* Add / Deduct toggle */}
      <div className="flex rounded-xl overflow-hidden border border-[#ede8e5]">
        {(['add', 'deduct'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              'flex-1 py-2 text-sm font-semibold flex items-center justify-center gap-1.5 transition-all',
              mode === m
                ? m === 'add'
                  ? 'bg-[#6b8e6b] text-white'
                  : 'bg-[#c45c4a] text-white'
                : 'bg-[#faf9f7] text-[#8b6b5c] hover:bg-[#ede8e5]',
            )}
          >
            {m === 'add' ? <Plus className="size-3.5" /> : <Minus className="size-3.5" />}
            {m === 'add' ? 'Add credits' : 'Deduct credits'}
          </button>
        ))}
      </div>

      {/* Credit type */}
      <div>
        <label className="block text-xs font-medium text-[#8b6b5c] mb-1.5">Credit Type</label>
        <select
          value={creditType}
          onChange={(e) => setCreditType(e.target.value as any)}
          className="w-full rounded-xl border border-[#ede8e5] bg-[#faf9f7] px-3 py-2 text-sm text-[#4e2b22] focus:border-[#c4a88a] focus:outline-none"
        >
          {CREDIT_TYPES.map((t) => (
            <option key={t} value={t}>{CREDIT_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-xs font-medium text-[#8b6b5c] mb-1.5">
          Amount <span className="text-[#c45c4a]">*</span>
        </label>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 5"
          disabled={isPending}
          className="w-full rounded-xl border border-[#ede8e5] bg-[#faf9f7] px-3 py-2 text-sm text-[#4e2b22] placeholder:text-[#a6856f] focus:border-[#c4a88a] focus:outline-none"
        />
      </div>

      {/* Reason (required — stored in audit log) */}
      <div>
        <label className="block text-xs font-medium text-[#8b6b5c] mb-1.5">
          Reason <span className="text-[#c45c4a]">*</span>
          <span className="ml-1 font-normal">(stored in audit log)</span>
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Goodwill adjustment, trial class, corrective entry"
          disabled={isPending}
          maxLength={500}
          className="w-full rounded-xl border border-[#ede8e5] bg-[#faf9f7] px-3 py-2 text-sm text-[#4e2b22] placeholder:text-[#a6856f] focus:border-[#c4a88a] focus:outline-none"
        />
      </div>

      {/* Notes (optional) */}
      <div>
        <label className="block text-xs font-medium text-[#8b6b5c] mb-1.5">
          Admin notes <span className="text-[#a6856f] font-normal">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes — not shown to the student"
          disabled={isPending}
          rows={2}
          maxLength={1000}
          className="w-full rounded-xl border border-[#ede8e5] bg-[#faf9f7] px-3 py-2 text-sm text-[#4e2b22] placeholder:text-[#a6856f] focus:border-[#c4a88a] focus:outline-none resize-none"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-[#c45c4a]/10 px-3 py-2.5 text-sm text-[#c45c4a]">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-xl bg-[#6b8e6b]/10 px-3 py-2.5 text-sm text-[#4a7c4a]">
          <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
          {success}
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending || !amount || !reason}
        className={cn(
          'w-full rounded-xl font-semibold',
          mode === 'add'
            ? 'bg-[#6b8e6b] hover:bg-[#4a7c4a] text-white'
            : 'bg-[#c45c4a] hover:bg-[#a33a29] text-white',
        )}
      >
        {isPending
          ? 'Saving…'
          : mode === 'add'
          ? `Add credits`
          : `Deduct credits`}
      </Button>
    </form>
  );
}

// ─── History Panel ────────────────────────────────────────────────────────────
function AdjustmentHistory({ userId }: { userId: string }) {
  const [history, setHistory]   = useState<Adjustment[]>([]);
  const [loaded, setLoaded]     = useState(false);
  const [loading, setLoading]   = useState(false);

  async function load() {
    setLoading(true);
    const result = await getUserCreditAdjustmentsAction(userId);
    if (result.success) setHistory(result.data as Adjustment[]);
    setLoaded(true);
    setLoading(false);
  }

  if (!loaded) {
    return (
      <button
        onClick={load}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs text-[#8b6b5c] hover:text-[#4e2b22] transition-colors mt-3"
      >
        <History className="size-3.5" />
        {loading ? 'Loading history…' : 'View adjustment history'}
      </button>
    );
  }

  if (history.length === 0) {
    return <p className="text-xs text-[#a6856f] mt-3">No manual adjustments yet.</p>;
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold text-[#8b6b5c] uppercase tracking-wide">Adjustment History</p>
      {history.map((h) => (
        <div key={h.id} className="flex items-start justify-between gap-3 rounded-lg bg-[#faf9f7] border border-[#ede8e5] px-3 py-2.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  'text-xs font-bold tabular-nums',
                  h.amountDelta > 0 ? 'text-[#4a7c4a]' : 'text-[#c45c4a]',
                )}
              >
                {h.amountDelta > 0 ? '+' : ''}{h.amountDelta}
              </span>
              <span className="text-xs text-[#8b6b5c]">{CREDIT_TYPE_LABELS[h.creditType] ?? h.creditType}</span>
              <span className="text-xs text-[#a6856f]">→ balance: {h.newBalance}</span>
            </div>
            <p className="text-xs text-[#6b3d32] mt-0.5 truncate">{h.reason}</p>
            {h.notes && <p className="text-xs text-[#a6856f] mt-0.5 italic">{h.notes}</p>}
          </div>
          <span className="text-xs text-[#a6856f] shrink-0 whitespace-nowrap">
            {formatStudio(new Date(h.createdAt), 'dd.MM.yy')}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── User Card ────────────────────────────────────────────────────────────────
function UserCard({ user }: { user: UserRow }) {
  const [open, setOpen]             = useState(false);
  const [balances, setBalances]     = useState(user.balances);
  const initials = (user.name ?? user.email ?? '?').charAt(0).toUpperCase();
  const totalCredits = balances.reduce((s, b) => s + b.balance, 0);

  function handleAdjustment(delta: number, creditType: string, newBalance: number) {
    setBalances((prev) => {
      const exists = prev.find((b) => b.creditType === creditType);
      if (exists) {
        return prev.map((b) =>
          b.creditType === creditType ? { ...b, balance: newBalance, updatedAt: new Date() } : b,
        );
      }
      return [
        ...prev,
        {
          id:        crypto.randomUUID(),
          creditType,
          balance:   newBalance,
          expiresAt: null,
          updatedAt: new Date(),
        },
      ];
    });
  }

  return (
    <div
      className={cn(
        'rounded-2xl border transition-[border-color,box-shadow]',
        open
          ? 'border-[#c4a88a] shadow-[0_4px_20px_rgba(78,43,34,0.08)]'
          : 'border-[#ede8e5] hover:border-[#c4a88a]/50',
        'bg-gradient-to-br from-[#faf9f7]/90 to-[#f5f3f1]/60',
      )}
    >
      {/* Header row */}
      <button
        className="w-full flex items-center justify-between gap-4 p-4 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-full bg-gradient-to-br from-[#4e2b22] to-[#6b3d32] flex items-center justify-center text-[#faf9f7] text-sm font-bold">
            {initials}
          </div>
          <div>
            <p className="font-semibold text-[#4e2b22] text-sm">{user.name ?? '—'}</p>
            <p className="text-xs text-[#8b6b5c]">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {balances.length === 0 ? (
            <span className="text-xs text-[#a6856f]">no credits</span>
          ) : (
            <div className="flex flex-wrap gap-1 justify-end max-w-xs">
              {balances
                .filter((b) => b.balance > 0)
                .slice(0, 3)
                .map((b) => (
                  <BalancePill key={b.id} creditType={b.creditType} balance={b.balance} />
                ))}
              {balances.filter((b) => b.balance > 0).length > 3 && (
                <span className="text-xs text-[#a6856f]">+{balances.filter((b) => b.balance > 0).length - 3} more</span>
              )}
            </div>
          )}
          {open ? (
            <ChevronDown className="size-4 text-[#8b6b5c] shrink-0" />
          ) : (
            <ChevronRight className="size-4 text-[#8b6b5c] shrink-0" />
          )}
        </div>
      </button>

      {/* Expanded panel */}
      <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
        <div className="border-t border-[#ede8e5] px-4 pb-4 pt-4">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: all balances */}
            <div>
              <p className="text-xs font-semibold text-[#8b6b5c] uppercase tracking-wide mb-3">
                Current Balances
              </p>
              {balances.length === 0 ? (
                <p className="text-sm text-[#a6856f]">No credits.</p>
              ) : (
                <div className="space-y-2">
                  {CREDIT_TYPES.map((ct) => {
                    const b = balances.find((x) => x.creditType === ct);
                    return (
                      <div
                        key={ct}
                        className="flex items-center justify-between rounded-xl border border-[#ede8e5] bg-white px-3 py-2"
                      >
                        <span className="text-sm text-[#6b3d32]">{CREDIT_TYPE_LABELS[ct]}</span>
                        <span
                          className={cn(
                            'font-bold tabular-nums text-sm',
                            (b?.balance ?? 0) > 0 ? 'text-[#4e2b22]' : 'text-[#a6856f]',
                          )}
                        >
                          {b?.balance ?? 0}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <AdjustmentHistory userId={user.id} />
            </div>

            {/* Right: adjustment form */}
            <div className="border-l border-[#ede8e5] pl-6">
              <AdjustForm
                userId={user.id}
                userName={user.name ?? user.email ?? 'User'}
                onSuccess={handleAdjustment}
              />
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────
export function UserCreditsClient({ users }: { users: UserRow[] }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        !q ||
        (u.name ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q),
    );
  }, [users, search]);

  const totalUsers   = users.length;
  const usersWithCredits = users.filter((u) => u.balances.some((b) => b.balance > 0)).length;

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total students', value: totalUsers },
          { label: 'Students with credits', value: usersWithCredits },
          { label: 'Showing', value: filtered.length },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#4e2b22]/10 to-[#6b3d32]/5 p-4"
          >
            <p className="text-xs text-[#8b6b5c]">{label}</p>
            <p className="text-2xl font-bold text-[#4e2b22]">{value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#8b6b5c]" />
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#ede8e5] bg-[#faf9f7]/80 text-[#4e2b22] placeholder:text-[#a6856f] focus:border-[#c4a88a] focus:outline-none"
        />
      </div>

      {/* User list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <User className="size-8 text-[#c4a88a] mx-auto mb-3" />
            <p className="text-[#8b6b5c]">No students found.</p>
          </div>
        ) : (
          filtered.map((u) => <UserCard key={u.id} user={u} />)
        )}
      </div>
    </div>
  );
}
