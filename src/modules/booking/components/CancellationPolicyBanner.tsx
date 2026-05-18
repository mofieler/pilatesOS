import { differenceInHours, addHours } from 'date-fns';
import { CANCELLATION_WINDOW_HOURS, MERCY_USES_PER_MONTH } from '@/constants/BOOKING_RULES';
import { AlertTriangleIcon, CalendarClockIcon, HeartHandshakeIcon, ShieldCheckIcon } from 'lucide-react';

// ─── Policy resolver ──────────────────────────────────────────────────────────

// 'free'         — ≥24h before class, no mercy needed
// 'rescheduled'  — class was rescheduled after booking; bonus window applies
// 'mercy'        — <24h, mercy will be consumed, refund issued (still ≥2 left after)
// 'mercy_last'   — <24h, this is the LAST mercy for the month (1 left)
// 'loss'         — <24h, no mercy left this month; credits will be forfeited
export type CancellationPolicyState =
  | 'free'
  | 'rescheduled'
  | 'mercy'
  | 'mercy_last'
  | 'loss';

export type CancellationPolicy = {
  state: CancellationPolicyState;
  hoursUntilStart: number;
  willReceiveRefund: boolean;
  mercyUsesLeft: number;       // remaining BEFORE this cancellation
  mercyUsesLeftAfter: number;  // remaining AFTER this cancellation (informational)
  mercyUsesLimit: number;
};

export function resolveCancellationPolicy(
  startsAt: Date,
  mercyUsesLeft: number,
  now: Date = new Date(),
  rescheduledAt?: Date | null,
  bookedAt?: Date | null,
): CancellationPolicy {
  const hoursUntilStart = differenceInHours(startsAt, now);
  const isWithinWindow = hoursUntilStart < CANCELLATION_WINDOW_HOURS;
  const classHasStarted = now >= startsAt;

  // Mirrors server-side grace logic in cancellationService.cancel().
  const rescheduledGrace =
    !!rescheduledAt &&
    !!bookedAt &&
    rescheduledAt > bookedAt &&
    now < addHours(rescheduledAt, CANCELLATION_WINDOW_HOURS) &&
    !classHasStarted;

  const base = {
    hoursUntilStart,
    mercyUsesLeft,
    mercyUsesLimit: MERCY_USES_PER_MONTH,
  };

  if (rescheduledGrace) {
    return { ...base, state: 'rescheduled', willReceiveRefund: true, mercyUsesLeftAfter: mercyUsesLeft };
  }
  if (!isWithinWindow) {
    return { ...base, state: 'free', willReceiveRefund: true, mercyUsesLeftAfter: mercyUsesLeft };
  }
  if (mercyUsesLeft >= 2) {
    return { ...base, state: 'mercy', willReceiveRefund: true, mercyUsesLeftAfter: mercyUsesLeft - 1 };
  }
  if (mercyUsesLeft === 1) {
    return { ...base, state: 'mercy_last', willReceiveRefund: true, mercyUsesLeftAfter: 0 };
  }
  return { ...base, state: 'loss', willReceiveRefund: false, mercyUsesLeftAfter: 0 };
}

// ─── Banner ───────────────────────────────────────────────────────────────────

const VARIANTS = {
  free: {
    icon: ShieldCheckIcon,
    container: 'border-emerald-200 bg-emerald-50',
    iconColor: 'text-emerald-600',
    title: 'Free cancellation',
    titleColor: 'text-emerald-800',
    descColor: 'text-emerald-700',
  },
  rescheduled: {
    icon: CalendarClockIcon,
    container: 'border-blue-200 bg-blue-50',
    iconColor: 'text-blue-600',
    title: 'Free cancellation — class was rescheduled',
    titleColor: 'text-blue-800',
    descColor: 'text-blue-700',
  },
  mercy: {
    icon: HeartHandshakeIcon,
    container: 'border-amber-200 bg-amber-50',
    iconColor: 'text-amber-600',
    title: 'Late-cancellation mercy will apply',
    titleColor: 'text-amber-800',
    descColor: 'text-amber-700',
  },
  mercy_last: {
    icon: AlertTriangleIcon,
    container: 'border-orange-200 bg-orange-50',
    iconColor: 'text-orange-600',
    title: 'Last mercy this month',
    titleColor: 'text-orange-800',
    descColor: 'text-orange-700',
  },
  loss: {
    icon: AlertTriangleIcon,
    container: 'border-red-200 bg-red-50',
    iconColor: 'text-red-600',
    title: 'Late cancellation — credits will not be refunded',
    titleColor: 'text-red-800',
    descColor: 'text-red-700',
  },
} as const;

export type CancellationPolicyBannerProps = {
  startsAt: Date;
  /** Mercy uses still available this calendar month (0..MERCY_USES_PER_MONTH). */
  mercyUsesLeft: number;
  creditsAtStake: number;
  creditType: 'pass' | 'session';
  rescheduledAt?: Date | null;
  bookedAt?: Date | null;
};

export function CancellationPolicyBanner({
  startsAt,
  mercyUsesLeft,
  creditsAtStake,
  creditType,
  rescheduledAt,
  bookedAt,
}: CancellationPolicyBannerProps) {
  const policy = resolveCancellationPolicy(startsAt, mercyUsesLeft, new Date(), rescheduledAt, bookedAt);
  const v = VARIANTS[policy.state];
  const Icon = v.icon;

  const isSession = creditType === 'session';
  const creditNoun = isSession ? 'Session credit' : 'Credit';
  const creditLabel = `${creditsAtStake} ${creditNoun}${creditsAtStake === 1 ? '' : 's'}`;
  const windowHours = CANCELLATION_WINDOW_HOURS;
  const limit = policy.mercyUsesLimit;

  let description: string;
  if (policy.state === 'rescheduled') {
    description = `This class was rescheduled after you booked. You have ${windowHours} hours from the reschedule notice to cancel for a full refund of ${creditLabel}.`;
  } else if (policy.state === 'free') {
    description = `You're outside the ${windowHours}-hour window (${policy.hoursUntilStart}h remaining). You'll receive a full refund of ${creditLabel}.`;
  } else if (policy.state === 'mercy') {
    description = `You're within the ${windowHours}-hour window. ${creditLabel} will be refunded — this counts as one mercy use. You have ${policy.mercyUsesLeft} of ${limit} mercy uses left this month.`;
  } else if (policy.state === 'mercy_last') {
    description = `This is your LAST late-cancellation mercy this month. ${creditLabel} will be refunded, but any further late cancellation before the 1st will forfeit credits.`;
  } else {
    description = `You've used all ${limit} late-cancellation mercy uses this month. ${creditLabel} will be forfeited. Your quota resets on the 1st.`;
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${v.container}`}
      role={policy.state === 'loss' ? 'alert' : 'note'}
    >
      <Icon className={`size-5 shrink-0 ${v.iconColor}`} aria-hidden />
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${v.titleColor}`}>{v.title}</p>
        <p className={`mt-0.5 text-xs leading-relaxed ${v.descColor}`}>{description}</p>
      </div>
    </div>
  );
}
