import { AlertTriangleIcon } from 'lucide-react';
import { formatStudio } from '@/lib/utils/date.utils';
import type { UtilizationPrediction } from '@/modules/billing/services/lot.service';

/**
 * Banner shown on the dashboard / credits page when the user's projected
 * consumption can't drain one or more lots before they expire. Driven by
 * lot.service.predictUtilization().
 */
export function ExpiryWarningBanner({ prediction }: { prediction: UtilizationPrediction }) {
  if (prediction.atRiskLots.length === 0 || prediction.totalAtRiskAmount === 0) {
    return null;
  }

  // Pick the lot expiring soonest as the headline urgency.
  const nextLot = prediction.atRiskLots[0];

  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5"
      role="alert"
    >
      <AlertTriangleIcon className="size-5 shrink-0 text-amber-600 mt-0.5" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-800">
          {prediction.totalAtRiskAmount}{' '}
          {prediction.totalAtRiskAmount === 1 ? 'credit' : 'credits'} at risk of expiring unused
        </p>
        <p className="mt-1 text-xs text-amber-700 leading-relaxed">
          At your current pace ({prediction.avgCreditsPerWeek.toFixed(1)} credits/week
          over the last {prediction.lookbackDays} days), the lot expiring on{' '}
          <span className="font-semibold">{formatStudio(nextLot.expiresAt, 'd MMMM yyyy')}</span>{' '}
          won't be fully used. Book a few more classes — or pick a smaller pack next time.
        </p>
      </div>
    </div>
  );
}
