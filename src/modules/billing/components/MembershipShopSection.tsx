'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  BadgeCheckIcon, CheckCircleIcon, CalendarIcon,
  RefreshCwIcon, StarIcon, AlertCircleIcon, XCircleIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { LEGACY_CREDIT_TYPE_LABELS } from '@/lib/config/class-types';

const CREDIT_TYPE_LABEL = LEGACY_CREDIT_TYPE_LABELS;
import { getActiveMembershipPlansAction, getMyMembershipAction, subscribeMembershipAction, cancelMyMembershipAction } from '@/modules/billing/actions/membership.actions';
import type { MyMembership } from '@/modules/billing/actions/membership.actions';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Plan = Awaited<ReturnType<typeof getActiveMembershipPlansAction>>['data'][number];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

const CREDIT_BADGE: Record<string, string> = {
  pass:    'bg-[#d4a574]/10 text-[#8b5e3c] border-[#d4a574]/30',
  session: 'bg-[#4e2b22]/10 text-[#4e2b22] border-[#4e2b22]/20',
};

// ─── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
}) {
  const weeklyTotal = plan.weeklyCredits * plan.durationWeeks;

  return (
    <button
      onClick={onSelect}
      className={cn(
        'relative w-full text-left rounded-2xl border p-5 transition-all duration-200',
        'bg-gradient-to-br from-[#faf9f7]/90 to-[#f5f3f1]/80',
        selected
          ? 'border-[#4e2b22] shadow-[0_8px_30px_rgba(78,43,34,0.12)]'
          : 'border-[#ede8e5]/80 shadow-[0_4px_20px_rgba(78,43,34,0.04)] hover:border-[#c4a88a]/40 hover:shadow-[0_8px_30px_rgba(78,43,34,0.08)]',
      )}
    >
      {selected && (
        <div className="absolute top-3 right-3">
          <CheckCircleIcon className="size-6 text-[#4e2b22]" />
        </div>
      )}

      {/* Name + type */}
      <div className="flex items-start justify-between mb-3 pr-6">
        <div>
          <h3 className="text-lg font-semibold text-[#4e2b22]">{plan.name}</h3>
          {plan.description && (
            <p className="text-sm text-[#8b6b5c] mt-1">{plan.description}</p>
          )}
        </div>
        <Badge variant="outline" className={cn('ml-2 shrink-0 text-[10px] px-2 py-0.5 capitalize', CREDIT_BADGE[plan.creditType])}>
          {CREDIT_TYPE_LABEL[plan.creditType]}
        </Badge>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-3xl font-bold text-[#4e2b22]">
          {formatPrice(plan.priceCents, plan.currency)}
        </span>
        <span className="text-sm text-[#8b6b5c]">total</span>
      </div>

      {/* Details */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-white/60 p-2 text-center">
          <p className="text-[10px] text-[#8b6b5c] uppercase tracking-wide">Weekly</p>
          <p className="text-sm font-bold text-[#4e2b22]">{plan.weeklyCredits} cr</p>
        </div>
        <div className="rounded-lg bg-white/60 p-2 text-center">
          <p className="text-[10px] text-[#8b6b5c] uppercase tracking-wide">Duration</p>
          <p className="text-sm font-bold text-[#4e2b22]">{plan.durationWeeks}w</p>
        </div>
        <div className="rounded-lg bg-white/60 p-2 text-center">
          <p className="text-[10px] text-[#8b6b5c] uppercase tracking-wide">Total cr</p>
          <p className="text-sm font-bold text-[#4e2b22]">{weeklyTotal}</p>
        </div>
      </div>
    </button>
  );
}

// ─── Active membership view ────────────────────────────────────────────────────

function ActiveMembershipView({ membership, onCancelled }: { membership: MyMembership; onCancelled: () => void }) {
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      const res = await cancelMyMembershipAction();
      if (!res.success) {
        toast.error(res.error ?? 'Could not cancel membership.');
        return;
      }
      toast.success('Membership cancelled', {
        description: 'No further credits will be granted. Existing credits remain on your account.',
      });
      onCancelled();
    });
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-[#faf9f7]/80 p-6">
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <BadgeCheckIcon className="size-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-[#4e2b22]">{membership.planName}</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          </div>
          {membership.planDescription && (
            <p className="text-sm text-[#8b6b5c] mb-3">{membership.planDescription}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white/70 p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <RefreshCwIcon className="size-3 text-[#8b6b5c]" />
                <p className="text-[11px] font-medium text-[#8b6b5c] uppercase tracking-wide">Weekly credits</p>
              </div>
              <p className="text-sm font-bold text-[#4e2b22]">
                {membership.weeklyCredits} {CREDIT_TYPE_LABEL[membership.creditType]}
              </p>
            </div>
            <div className="rounded-lg bg-white/70 p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <CalendarIcon className="size-3 text-[#8b6b5c]" />
                <p className="text-[11px] font-medium text-[#8b6b5c] uppercase tracking-wide">Expires</p>
              </div>
              <p className="text-sm font-bold text-[#4e2b22]">
                {format(membership.endsAt, 'd MMM yyyy')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-[#8b6b5c]">
          Cancellation stops future credit grants. Credits already on your account remain valid.
        </p>
        <AlertDialog>
          <AlertDialogTrigger className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600">
            <XCircleIcon className="size-3.5" aria-hidden />
            Cancel
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel membership?</AlertDialogTitle>
              <AlertDialogDescription>
                This will stop all future weekly credit grants for <strong>{membership.planName}</strong>.
                Credits already on your account will not be removed.
                This action cannot be undone — you would need to subscribe to a new plan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Keep membership</AlertDialogCancel>
              <AlertDialogAction
                disabled={isPending}
                onClick={handleCancel}
                className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 disabled:opacity-60"
              >
                {isPending ? 'Cancelling…' : 'Yes, cancel membership'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ─── Subscribe form ────────────────────────────────────────────────────────────

function SubscribeForm({ plan }: { plan: Plan }) {
  const [acceptedTerms, setAcceptedTerms]               = useState(false);
  const [acceptedSubscription, setAcceptedSubscription] = useState(false);
  const [acceptedWithdrawal, setAcceptedWithdrawal]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubscribe() {
    if (!acceptedTerms || !acceptedSubscription || !acceptedWithdrawal) {
      setError('Please accept all required terms before subscribing.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await subscribeMembershipAction({
        planId: plan.id,
        acceptedTerms: true,
        acceptedWithdrawalWaiver: true,
      });
      if (!res.success) { setError(res.error); return; }
      setSuccess(true);
    });
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <BadgeCheckIcon className="mx-auto size-12 text-emerald-600 mb-3" />
        <h3 className="text-lg font-semibold text-[#4e2b22] mb-2">Membership activated!</h3>
        <p className="text-sm text-[#6b3d32]">
          Your <strong>{plan.name}</strong> is now active. Credits will be granted every 7 days.
          Please pay{' '}
          <strong>{formatPrice(plan.priceCents, plan.currency)}</strong> at the studio within 14 days.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6 space-y-4">
      <h3 className="font-semibold text-[#4e2b22]">Order Summary</h3>

      {/* Summary rows */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-[#6b3d32]">Plan</span>
          <span className="font-medium text-[#4e2b22]">{plan.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6b3d32]">Credits per week</span>
          <span className="font-medium text-[#4e2b22]">{plan.weeklyCredits} {CREDIT_TYPE_LABEL[plan.creditType]}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6b3d32]">Duration</span>
          <span className="font-medium text-[#4e2b22]">{plan.durationWeeks} weeks</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6b3d32]">Payment method</span>
          <span className="font-medium text-[#4e2b22]">Pay at Studio</span>
        </div>
        <div className="border-t border-[#ede8e5] pt-2 mt-2 flex justify-between">
          <span className="font-semibold text-[#4e2b22]">Total</span>
          <span className="text-lg font-bold text-[#4e2b22]">{formatPrice(plan.priceCents, plan.currency)}</span>
        </div>
      </div>

      {/* Pay-at-studio info box */}
      <div className="rounded-xl bg-[#d4a574]/10 p-4 text-sm text-[#6b3d32]">
        <span className="font-medium">Pay at Studio:</span> Your membership starts immediately and credits are
        granted every 7 days. Please bring the invoice amount to the studio within{' '}
        <span className="font-semibold">14 days</span>. Late payment pauses further bookings until settled.
      </div>

      {/* Legal checkboxes — §312j BGB, §356 IV BGB, §312k BGB */}
      <div className="space-y-3">
        {/* 1. T&Cs + Privacy */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 size-4 rounded border-[#c4a88a] text-[#4e2b22] focus:ring-[#4e2b22]"
          />
          <span className="text-xs text-[#6b3d32] leading-relaxed">
            I have read and accept the{' '}
            <Link href="/agb" target="_blank" className="text-[#4e2b22] underline underline-offset-2">
              General Terms and Conditions (AGB)
            </Link>
            {' '}– including the Liability Waiver and Cancellation Policy – and the{' '}
            <Link href="/datenschutz" target="_blank" className="text-[#4e2b22] underline underline-offset-2">
              Privacy Policy (Datenschutzerklärung)
            </Link>. <span className="text-red-500">*</span>
          </span>
        </label>

        {/* 2. Subscription acknowledgement — §312k BGB + EGBGB Art. 246a */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedSubscription}
            onChange={(e) => setAcceptedSubscription(e.target.checked)}
            className="mt-0.5 size-4 rounded border-[#c4a88a] text-[#4e2b22] focus:ring-[#4e2b22]"
          />
          <span className="text-xs text-[#6b3d32] leading-relaxed">
            I acknowledge that this is a <span className="font-medium">fixed-term subscription</span> of{' '}
            <span className="font-medium">{plan.durationWeeks} weeks</span>, granting{' '}
            <span className="font-medium">{plan.weeklyCredits} {CREDIT_TYPE_LABEL[plan.creditType]} credits per week</span>.
            The total price of{' '}
            <span className="font-medium">{formatPrice(plan.priceCents, plan.currency)}</span> is due in
            full at the studio. I understand I can request cancellation through my studio for future periods. <span className="text-red-500">*</span>
          </span>
        </label>

        {/* 3. Withdrawal waiver — §356 Abs. 4 BGB */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedWithdrawal}
            onChange={(e) => setAcceptedWithdrawal(e.target.checked)}
            className="mt-0.5 size-4 rounded border-[#c4a88a] text-[#4e2b22] focus:ring-[#4e2b22]"
          />
          <span className="text-xs text-[#6b3d32] leading-relaxed">
            I expressly request that my membership begins immediately and acknowledge that I{' '}
            <span className="font-medium">waive my statutory 14-day right of withdrawal</span> (§ 355 BGB) once the
            first weekly credit grant is applied to my account. <span className="text-red-500">*</span>
          </span>
        </label>

        {/* Withdrawal info box */}
        <div className="rounded-lg bg-[#ede8e5]/40 p-3 text-xs text-[#6b3d32] leading-relaxed">
          <strong>Widerrufsbelehrung:</strong> You have the right to withdraw from this contract within
          14 days without giving reasons (§ 355 BGB). The withdrawal period begins upon conclusion of the
          contract. If you request immediate performance, you lose the right of withdrawal once the service
          has been fully provided. For the full cancellation policy, see our{' '}
          <Link href="/agb" target="_blank" className="text-[#4e2b22] underline underline-offset-2">
            AGB
          </Link>.
        </div>

        <p className="text-[10px] text-[#a6856f]">
          <span className="text-red-500">*</span> Required fields
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertCircleIcon className="size-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Button-Lösung §312j BGB */}
      <Button
        variant="boutique"
        className="w-full"
        onClick={handleSubscribe}
        disabled={pending || !acceptedTerms || !acceptedSubscription || !acceptedWithdrawal}
      >
        {pending ? 'Processing…' : 'Subscribe now – binding order'}
      </Button>
      <p className="text-[10px] text-center text-[#a6856f] leading-snug">
        By clicking this button you place a binding order (§ 312j BGB). Payment is due in person at the studio within 14 days.
      </p>
    </div>
  );
}

// ─── Main exported section ────────────────────────────────────────────────────

export function MembershipShopSection() {
  const [plans, setPlans]               = useState<Plan[]>([]);
  const [myMembership, setMyMembership] = useState<MyMembership | null | undefined>(undefined);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    Promise.all([
      getActiveMembershipPlansAction(),
      getMyMembershipAction(),
    ]).then(([plansRes, membership]) => {
      setPlans(plansRes.data ?? []);
      setMyMembership(membership ?? null);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2].map((i) => (
          <div key={i} className="h-40 rounded-2xl bg-[#ede8e5]/50" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active membership banner */}
      {myMembership && (
        <ActiveMembershipView
          membership={myMembership}
          onCancelled={() => setMyMembership(null)}
        />
      )}

      {/* Plan list */}
      {!myMembership && (
        <>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/80 text-[#6b3d32]">
              <StarIcon className="size-4" aria-hidden />
            </span>
            <h2 className="text-lg font-semibold text-[#4e2b22]">
              {plans.length > 0 ? 'Available Plans' : 'No Plans Available'}
            </h2>
          </div>

          {plans.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#ede8e5] bg-[#faf9f7] py-10 text-center">
              <StarIcon className="mx-auto size-8 text-[#c4a88a] mb-3" />
              <p className="text-sm font-medium text-[#6b3d32]">No membership plans configured yet.</p>
              <p className="text-xs text-[#8b6b5c] mt-1">Contact your studio to enquire about memberships.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  selected={selectedPlan === plan.id}
                  onSelect={() => setSelectedPlan((p) => p === plan.id ? null : plan.id)}
                />
              ))}
            </div>
          )}

          {/* Order form */}
          {selectedPlan && (() => {
            const plan = plans.find((p) => p.id === selectedPlan);
            return plan ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <SubscribeForm plan={plan} />
              </div>
            ) : null;
          })()}
        </>
      )}
    </div>
  );
}
