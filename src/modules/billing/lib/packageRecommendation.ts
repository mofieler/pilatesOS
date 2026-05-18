// Pure logic for the Paquita-style purchase recommender. No React/DOM here —
// keeps the rule set unit-testable and lets the component stay thin.

export type Intent = 'all' | 'mat_only';
export type Frequency = 'once' | 'multiple';

export type RecommendationStatus =
  | { kind: 'show' }
  | { kind: 'hide' }
  | { kind: 'disabled'; reasonKey: 'heads_up_validity_short' };

// Average pass credits a student spends per group class. Used by the projection
// when the user picks "All classes". Mat = 3, Reformer = 5, Chair = 4, Yoga = 3,
// Sound Healing = 2 → mean ≈ 3.5. We round up to 4 to be conservative (over-
// estimating consumption shrinks the recommended pack size, which is the safer
// failure mode — better to under-recommend than to leave the user with expired
// credits).
const AVG_PASS_CREDITS_PER_CLASS = 4;

// Mat-only students have only one mat-group slot per week and it costs 3 credits.
const MAT_ONLY_CREDITS_PER_WEEK = 3;

// "Once a week" projection across all class types. 1 class × 4 credits.
const ONCE_A_WEEK_CREDITS = AVG_PASS_CREDITS_PER_CLASS;

type PackageInput = {
  creditsAmount: number;
  validityWeeks: number;
  creditType: 'pass' | 'session';
};

/**
 * Decides whether a package card should be shown, hidden, or disabled given
 * the user's selected intent + frequency.
 *
 * Rules (mirror Paquita's behaviour exactly):
 *   - 'session' packages never participate — they're a separate section.
 *   - 'mat_only' intent hides any pass pack whose credits exceed ~90% of
 *     what 1 mat class per week can drain over the pack's validity.
 *   - 'all' + 'once' disables (greys out) any pass pack whose credits exceed
 *     ~90% of what 1 group class per week can drain.
 *   - 'all' + 'multiple' shows every pack.
 *
 * The 0.9 buffer accounts for holidays, sickness, missed weeks.
 */
export function recommendationStatus(
  pkg: PackageInput,
  intent: Intent,
  frequency: Frequency,
): RecommendationStatus {
  if (pkg.creditType === 'session') return { kind: 'show' };

  if (intent === 'mat_only') {
    const maxConsumable = MAT_ONLY_CREDITS_PER_WEEK * pkg.validityWeeks;
    if (pkg.creditsAmount > maxConsumable * 0.9) {
      return { kind: 'hide' };
    }
    return { kind: 'show' };
  }

  if (intent === 'all' && frequency === 'once') {
    const maxConsumable = ONCE_A_WEEK_CREDITS * pkg.validityWeeks;
    if (pkg.creditsAmount > maxConsumable * 0.9) {
      return { kind: 'disabled', reasonKey: 'heads_up_validity_short' };
    }
    return { kind: 'show' };
  }

  return { kind: 'show' };
}
