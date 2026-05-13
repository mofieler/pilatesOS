import { differenceInHours } from 'date-fns';
import { cn } from '@/lib/utils';
import { CANCELLATION_WINDOW_HOURS } from '@/constants/BOOKING_RULES';
import { AlertTriangleIcon, HeartHandshakeIcon, ShieldCheckIcon } from 'lucide-react';

// â”€â”€â”€ Policy resolver â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type CancellationPolicyState = 'free' | 'mercy' | 'loss';

export type CancellationPolicy = {
  state: CancellationPolicyState;
  hoursUntilStart: number;
  willReceiveRefund: boolean;
};


export function resolveCancellationPolicy(
  startsAt: Date,
  mercyAvailable: boolean,
  now: Date = new Date(),
): CancellationPolicy {
  const hoursUntilStart = differenceInHours(startsAt, now);
  const isWithinWindow = hoursUntilStart < CANCELLATION_WINDOW_HOURS;

  if (!isWithinWindow) {
    return { state: 'free', hoursUntilStart, willReceiveRefund: true };
  }
  if (mercyAvailable) {
    return { state: 'mercy', hoursUntilStart, willReceiveRefund: true };
  }
  return { state: 'loss', hoursUntilStart, willReceiveRefund: false };
}

// â”€â”€â”€ Banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const VARIANTS = {
  free: {
    icon: ShieldCheckIcon,
    container: 'border-emerald-200 bg-emerald-50',
    iconColor: 'text-emerald-600',
    title: 'Free cancellation',
    titleColor: 'text-emerald-800',
    descColor: 'text-emerald-700',
  },
  mercy: {
    icon: HeartHandshakeIcon,
    container: 'border-amber-200 bg-amber-50',
    iconColor: 'text-amber-600',
    title: 'One-time grace period applies',
    titleColor: 'text-amber-800',
    descColor: 'text-amber-700',
  },
  loss: {
    icon: AlertTriangleIcon,
    container: 'border-red-200 bg-red-50',
    iconColor: 'text-red-600',
    title: 'Late cancellation â€” credits will not be refunded',
    titleColor: 'text-red-800',
    descColor: 'text-red-700',
  },
} as const;

export type CancellationPolicyBannerProps = {
  startsAt: Date;
  mercyAvailable: boolean;
  creditsAtStake: number;
  creditType: 'reformer' | 'mat' | 'group' | 'sound_healing';
};

export function CancellationPolicyBanner({
  startsAt,
  mercyAvailable,
  creditsAtStake,
  creditType,
}: CancellationPolicyBannerProps) {
  const policy = resolveCancellationPolicy(startsAt, mercyAvailable);
  const v = VARIANTS[policy.state];
  const Icon = v.icon;

  const creditLabel = `${creditsAtStake} ${creditType} ${creditsAtStake === 1 ? 'credit' : 'credits'}`;

  // Build human-readable description per state
  let description: string;
  if (policy.state === 'free') {
    description = `You're outside the 24-hour window (${policy.hoursUntilStart}h remaining). You'll receive a full refund of ${creditLabel}.`;
  } else if (policy.state === 'mercy') {
    description = `You're within the 24-hour window, but as a one-time courtesy your grace period will be applied â€” you'll receive a full refund of ${creditLabel}. This grace can only be used once per account.`;
  } else {
    description = `You're within the 24-hour window and your one-time grace period has already been used. ${creditLabel} will be forfeited.`;
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
