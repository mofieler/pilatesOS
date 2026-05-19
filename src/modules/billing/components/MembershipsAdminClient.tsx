'use client';

import { useState, useTransition } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { PlusIcon, PencilIcon, TrashIcon, XIcon, CheckIcon, UserPlusIcon, BanIcon, CalendarIcon, CoinsIcon, RefreshCwIcon, StarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  createMembershipPlanAction,
  updateMembershipPlanAction,
  deleteMembershipPlanAction,
  assignMembershipAction,
  cancelUserMembershipAction,
  type MembershipPlanRow,
  type ActiveMembershipRow,
} from '@/modules/billing/actions/membership.actions';
import { getCreditTypeValues, LEGACY_CREDIT_TYPE_LABELS } from '@/lib/config/class-types';

const CREDIT_TYPE_LABEL = LEGACY_CREDIT_TYPE_LABELS;
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

type Student = { id: string; name: string | null; email: string };

interface Props {
  plans: MembershipPlanRow[];
  memberships: ActiveMembershipRow[];
  students: Student[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

const STATUS_STYLES: Record<string, string> = {
  active:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  paused:    'bg-amber-50 text-amber-700 border-amber-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  expired:   'bg-slate-50 text-slate-600 border-slate-200',
};

const CREDIT_TYPE_BADGE: Record<string, string> = {
  pass:    'bg-[#d4a574]/10 text-[#8b5e3c] border-[#d4a574]/30',
  session: 'bg-[#4e2b22]/10 text-[#4e2b22] border-[#4e2b22]/20',
};

// ─── Plan form (create / edit) ─────────────────────────────────────────────────

interface PlanFormState {
  name: string;
  description: string;
  creditType: string;
  weeklyCredits: string;
  durationWeeks: string;
  priceCents: string;
  currency: string;
  isActive: boolean;
  sortOrder: string;
}

const EMPTY_PLAN: PlanFormState = {
  name: '', description: '', creditType: 'pass',
  weeklyCredits: '1', durationWeeks: '4', priceCents: '',
  currency: 'eur', isActive: true, sortOrder: '0',
};

function PlanFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: MembershipPlanRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PlanFormState>(
    initial
      ? {
          name:          initial.name,
          description:   initial.description ?? '',
          creditType:    initial.creditType,
          weeklyCredits: String(initial.weeklyCredits),
          durationWeeks: String(initial.durationWeeks),
          priceCents:    String(initial.priceCents / 100),
          currency:      initial.currency,
          isActive:      initial.isActive,
          sortOrder:     String(initial.sortOrder),
        }
      : EMPTY_PLAN,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function field(k: keyof PlanFormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      name:          form.name.trim(),
      description:   form.description.trim() || null,
      creditType:    form.creditType as never,
      weeklyCredits: Number(form.weeklyCredits),
      durationWeeks: Number(form.durationWeeks),
      priceCents:    Math.round(Number(form.priceCents) * 100),
      currency:      form.currency,
      isActive:      form.isActive,
      sortOrder:     Number(form.sortOrder),
    };
    startTransition(async () => {
      const res = initial
        ? await updateMembershipPlanAction({ id: initial.id, ...payload })
        : await createMembershipPlanAction(payload);
      if (!res.success) { setError(res.error); return; }
      onSaved();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-[#ede8e5] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#ede8e5] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#4e2b22]">
            {initial ? 'Edit Plan' : 'New Membership Plan'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#8b6b5c] hover:bg-[#ede8e5]/60 transition-colors">
            <XIcon className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Name */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#6b3d32] mb-1.5">Plan Name</label>
              <input
                required value={form.name} onChange={field('name')}
                placeholder="e.g. Reformer Monthly"
                className="w-full rounded-lg border border-[#ede8e5] bg-[#faf9f7] px-3 py-2 text-sm text-[#4e2b22] placeholder:text-[#c4a88a] focus:border-[#4e2b22] focus:outline-none focus:ring-1 focus:ring-[#4e2b22]/20"
              />
            </div>

            {/* Description */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#6b3d32] mb-1.5">Description (optional)</label>
              <textarea
                value={form.description} onChange={field('description')}
                rows={2}
                placeholder="Short description visible to students"
                className="w-full rounded-lg border border-[#ede8e5] bg-[#faf9f7] px-3 py-2 text-sm text-[#4e2b22] placeholder:text-[#c4a88a] focus:border-[#4e2b22] focus:outline-none focus:ring-1 focus:ring-[#4e2b22]/20 resize-none"
              />
            </div>

            {/* Credit type */}
            <div>
              <label className="block text-xs font-medium text-[#6b3d32] mb-1.5">Credit Type</label>
              <select
                value={form.creditType} onChange={field('creditType')}
                className="w-full rounded-lg border border-[#ede8e5] bg-[#faf9f7] px-3 py-2 text-sm text-[#4e2b22] focus:border-[#4e2b22] focus:outline-none"
              >
                {getCreditTypeValues().map((t) => (
                  <option key={t} value={t}>{CREDIT_TYPE_LABEL[t]}</option>
                ))}
              </select>
            </div>

            {/* Weekly credits */}
            <div>
              <label className="block text-xs font-medium text-[#6b3d32] mb-1.5">Credits / Week</label>
              <input
                required type="number" min={1} step={1}
                value={form.weeklyCredits} onChange={field('weeklyCredits')}
                className="w-full rounded-lg border border-[#ede8e5] bg-[#faf9f7] px-3 py-2 text-sm text-[#4e2b22] focus:border-[#4e2b22] focus:outline-none"
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-xs font-medium text-[#6b3d32] mb-1.5">Duration (weeks)</label>
              <input
                required type="number" min={1} step={1}
                value={form.durationWeeks} onChange={field('durationWeeks')}
                className="w-full rounded-lg border border-[#ede8e5] bg-[#faf9f7] px-3 py-2 text-sm text-[#4e2b22] focus:border-[#4e2b22] focus:outline-none"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-xs font-medium text-[#6b3d32] mb-1.5">Price (€)</label>
              <input
                required type="number" min={0} step={0.01}
                value={form.priceCents} onChange={field('priceCents')}
                placeholder="0.00"
                className="w-full rounded-lg border border-[#ede8e5] bg-[#faf9f7] px-3 py-2 text-sm text-[#4e2b22] focus:border-[#4e2b22] focus:outline-none"
              />
            </div>

            {/* Sort order */}
            <div>
              <label className="block text-xs font-medium text-[#6b3d32] mb-1.5">Sort Order</label>
              <input
                type="number" min={0} step={1}
                value={form.sortOrder} onChange={field('sortOrder')}
                className="w-full rounded-lg border border-[#ede8e5] bg-[#faf9f7] px-3 py-2 text-sm text-[#4e2b22] focus:border-[#4e2b22] focus:outline-none"
              />
            </div>

            {/* Active toggle */}
            <div className="col-span-2 flex items-center gap-3">
              <input
                type="checkbox" id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="size-4 rounded border-[#c4a88a] text-[#4e2b22] focus:ring-[#4e2b22]"
              />
              <label htmlFor="isActive" className="text-sm text-[#6b3d32]">
                Plan is active (visible to students)
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-[#ede8e5] px-6 py-4 bg-[#faf9f7]/50">
          <Button type="button" variant="outline" onClick={onClose} className="border-[#ede8e5] text-[#6b3d32]">
            Cancel
          </Button>
          <Button type="submit" variant="boutique" disabled={pending}>
            {pending ? 'Saving…' : initial ? 'Save Changes' : 'Create Plan'}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── Assign membership modal ──────────────────────────────────────────────────

function AssignModal({
  plans,
  students,
  onClose,
  onSaved,
}: {
  plans: MembershipPlanRow[];
  students: Student[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [planId, setPlanId] = useState('');
  const [userId, setUserId] = useState('');
  const [startedAt, setStartedAt] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const activePlans = plans.filter((p) => p.isActive);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await assignMembershipAction({
        userId,
        planId,
        startedAt: new Date(startedAt),
      });
      if (!res.success) { setError(res.error); return; }
      onSaved();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-[#ede8e5] overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-[#ede8e5] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#4e2b22]">Assign Membership</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#8b6b5c] hover:bg-[#ede8e5]/60">
            <XIcon className="size-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div>
            <label className="block text-xs font-medium text-[#6b3d32] mb-1.5">Student</label>
            <select
              required value={userId} onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded-lg border border-[#ede8e5] bg-[#faf9f7] px-3 py-2 text-sm text-[#4e2b22] focus:border-[#4e2b22] focus:outline-none"
            >
              <option value="">Select student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name ?? s.email} — {s.email}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6b3d32] mb-1.5">Plan</label>
            <select
              required value={planId} onChange={(e) => setPlanId(e.target.value)}
              className="w-full rounded-lg border border-[#ede8e5] bg-[#faf9f7] px-3 py-2 text-sm text-[#4e2b22] focus:border-[#4e2b22] focus:outline-none"
            >
              <option value="">Select plan…</option>
              {activePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {CREDIT_TYPE_LABEL[p.creditType]} · {p.weeklyCredits} cr/wk · {formatPrice(p.priceCents, p.currency)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6b3d32] mb-1.5">Start Date</label>
            <input
              required type="date"
              value={startedAt} onChange={(e) => setStartedAt(e.target.value)}
              className="w-full rounded-lg border border-[#ede8e5] bg-[#faf9f7] px-3 py-2 text-sm text-[#4e2b22] focus:border-[#4e2b22] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-[#ede8e5] px-6 py-4 bg-[#faf9f7]/50">
          <Button type="button" variant="outline" onClick={onClose} className="border-[#ede8e5] text-[#6b3d32]">
            Cancel
          </Button>
          <Button type="submit" variant="boutique" disabled={pending || !userId || !planId}>
            {pending ? 'Assigning…' : 'Assign Membership'}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── Plans tab ─────────────────────────────────────────────────────────────────

function PlansTab({
  plans,
  onMutate,
}: {
  plans: MembershipPlanRow[];
  onMutate: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<MembershipPlanRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete(id: string) {
    if (!confirm('Delete this plan? Students on this plan will not be affected, but no new assignments will be possible.')) return;
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteMembershipPlanAction({ id });
      if (!res.success) { setDeleteError(res.error); return; }
      onMutate();
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#6b3d32]">
          {plans.length} plan{plans.length !== 1 ? 's' : ''}
        </p>
        <Button variant="boutique" size="sm" onClick={() => setShowCreate(true)}>
          <PlusIcon className="size-4 mr-1.5" />
          New Plan
        </Button>
      </div>

      {deleteError && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{deleteError}</p>
      )}

      {/* Plan cards */}
      {plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#ede8e5] bg-[#faf9f7] py-12 text-center">
          <StarIcon className="mx-auto size-8 text-[#c4a88a] mb-3" />
          <p className="text-sm font-medium text-[#6b3d32]">No plans yet</p>
          <p className="text-xs text-[#8b6b5c] mt-1">Create your first membership plan to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                'rounded-2xl border bg-gradient-to-br from-[#faf9f7]/90 to-[#f5f3f1]/80 p-5 transition-all',
                plan.isActive ? 'border-[#ede8e5]/80' : 'border-[#ede8e5]/40 opacity-60',
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-[#4e2b22] truncate">{plan.name}</h3>
                    {!plan.isActive && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50 text-slate-500 border-slate-200">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  {plan.description && (
                    <p className="text-xs text-[#8b6b5c] line-clamp-2">{plan.description}</p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={cn('ml-2 shrink-0 text-[10px] px-2 py-0.5 capitalize', CREDIT_TYPE_BADGE[plan.creditType])}
                >
                  {CREDIT_TYPE_LABEL[plan.creditType]}
                </Badge>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="rounded-lg bg-white/60 p-2 text-center">
                  <p className="text-xs text-[#8b6b5c]">Weekly</p>
                  <p className="text-sm font-bold text-[#4e2b22]">{plan.weeklyCredits} cr</p>
                </div>
                <div className="rounded-lg bg-white/60 p-2 text-center">
                  <p className="text-xs text-[#8b6b5c]">Duration</p>
                  <p className="text-sm font-bold text-[#4e2b22]">{plan.durationWeeks}w</p>
                </div>
                <div className="rounded-lg bg-white/60 p-2 text-center">
                  <p className="text-xs text-[#8b6b5c]">Price</p>
                  <p className="text-sm font-bold text-[#4e2b22]">{formatPrice(plan.priceCents, plan.currency)}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  className="flex-1 border-[#ede8e5] text-[#6b3d32] text-xs"
                  onClick={() => setEditing(plan)}
                >
                  <PencilIcon className="size-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="border-red-200 text-red-600 hover:bg-red-50 text-xs"
                  onClick={() => handleDelete(plan.id)}
                  disabled={pending}
                >
                  <TrashIcon className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <PlanFormModal onClose={() => setShowCreate(false)} onSaved={onMutate} />
      )}
      {editing && (
        <PlanFormModal initial={editing} onClose={() => setEditing(null)} onSaved={onMutate} />
      )}
    </div>
  );
}

// ─── Members tab ──────────────────────────────────────────────────────────────

function MembersTab({
  memberships,
  plans,
  students,
  onMutate,
}: {
  memberships: ActiveMembershipRow[];
  plans: MembershipPlanRow[];
  students: Student[];
  onMutate: () => void;
}) {
  const [showAssign, setShowAssign] = useState(false);
  const [pending, startTransition] = useTransition();
  const [cancelError, setCancelError] = useState<string | null>(null);

  function handleCancel(membershipId: string, name: string | null) {
    if (!confirm(`Cancel membership for ${name ?? 'this student'}? This cannot be undone.`)) return;
    setCancelError(null);
    startTransition(async () => {
      const res = await cancelUserMembershipAction({ membershipId });
      if (!res.success) { setCancelError(res.error); return; }
      onMutate();
    });
  }

  const active = memberships.filter((m) => m.status === 'active');
  const other  = memberships.filter((m) => m.status !== 'active');

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#6b3d32]">
          {active.length} active member{active.length !== 1 ? 's' : ''}
        </p>
        <Button variant="boutique" size="sm" onClick={() => setShowAssign(true)}>
          <UserPlusIcon className="size-4 mr-1.5" />
          Assign Membership
        </Button>
      </div>

      {cancelError && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{cancelError}</p>
      )}

      {memberships.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#ede8e5] bg-[#faf9f7] py-12 text-center">
          <UserPlusIcon className="mx-auto size-8 text-[#c4a88a] mb-3" />
          <p className="text-sm font-medium text-[#6b3d32]">No memberships yet</p>
          <p className="text-xs text-[#8b6b5c] mt-1">Assign a plan to a student to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...active, ...other].map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-4 rounded-xl border border-[#ede8e5]/80 bg-white/70 px-4 py-3 transition-all hover:bg-white/90"
            >
              {/* Avatar */}
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#4e2b22]/10 text-[#4e2b22] font-semibold text-sm">
                {(m.userName ?? m.userEmail)[0]?.toUpperCase() ?? '?'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-[#4e2b22] truncate">{m.userName ?? m.userEmail}</span>
                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 capitalize', STATUS_STYLES[m.status] ?? '')}>
                    {m.status}
                  </Badge>
                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 capitalize', CREDIT_TYPE_BADGE[m.creditType] ?? '')}>
                    {CREDIT_TYPE_LABEL[m.creditType]}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-[#8b6b5c] flex-wrap">
                  <span>{m.planName}</span>
                  <span className="text-[#c4a88a]">·</span>
                  <span>{m.weeklyCredits} cr/week</span>
                  <span className="text-[#c4a88a]">·</span>
                  <span>until {format(m.endsAt, 'd MMM yyyy')}</span>
                  {m.nextCreditGrantAt && m.status === 'active' && (
                    <>
                      <span className="text-[#c4a88a]">·</span>
                      <span className="flex items-center gap-1">
                        <RefreshCwIcon className="size-3" />
                        Next grant {formatDistanceToNow(m.nextCreditGrantAt, { addSuffix: true })}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Cancel */}
              {m.status === 'active' && (
                <Button
                  variant="outline" size="sm"
                  className="shrink-0 border-red-200 text-red-600 hover:bg-red-50 text-xs"
                  onClick={() => handleCancel(m.id, m.userName)}
                  disabled={pending}
                >
                  <BanIcon className="size-3 mr-1" />
                  Cancel
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAssign && (
        <AssignModal
          plans={plans}
          students={students}
          onClose={() => setShowAssign(false)}
          onSaved={onMutate}
        />
      )}
    </div>
  );
}

// ─── Root client component ────────────────────────────────────────────────────

type Tab = 'plans' | 'members';

export function MembershipsAdminClient({ plans, memberships, students }: Props) {
  const [tab, setTab] = useState<Tab>('plans');
  const router = useRouter();

  function refresh() { router.refresh(); }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <p className="text-sm font-medium text-[#6b3d32]">Billing</p>
        <h1 className="mt-1 text-3xl font-bold text-[#4e2b22]">Memberships</h1>
        <p className="mt-1 text-sm text-[#8b6b5c]">
          Manage recurring membership plans and student subscriptions
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-[#ede8e5] bg-[#faf9f7]/80 p-0.5 w-fit">
        {([['plans', 'Plans', StarIcon], ['members', 'Members', UserPlusIcon]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all',
              tab === key
                ? 'bg-[#faf9f7] text-[#4e2b22] shadow-sm ring-1 ring-[#ede8e5]'
                : 'text-[#8b6b5c] hover:text-[#6b3d32]',
            )}
          >
            <Icon className="size-4" />
            {label}
            {key === 'members' && memberships.filter((m) => m.status === 'active').length > 0 && (
              <span className="ml-0.5 rounded-full bg-[#4e2b22]/10 px-2 py-0.5 text-xs font-bold text-[#4e2b22]">
                {memberships.filter((m) => m.status === 'active').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'plans' ? (
        <PlansTab plans={plans} onMutate={refresh} />
      ) : (
        <MembersTab memberships={memberships} plans={plans} students={students} onMutate={refresh} />
      )}
    </div>
  );
}
