import { db } from '@/db';
import { creditLots, bookings, classTemplates, classSessions } from '@/db/schema';
import type { CreditLot, CreditType } from '@/db/schema';
import { and, eq, gt, sql, gte, isNotNull } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LotBreakdownEntry = {
  id: string;
  creditType: CreditType;
  remainingAmount: number;
  originalAmount: number;
  acquiredAt: Date;
  expiresAt: Date;
  daysUntilExpiry: number;
  /** True when projected consumption can't drain this lot before it expires. */
  atRisk: boolean;
};

export type UtilizationPrediction = {
  /** Average credits spent per week over the lookback window. */
  avgCreditsPerWeek: number;
  /** Lookback window in days (90 by default). */
  lookbackDays: number;
  /** Lots that are projected to expire with credits remaining. */
  atRiskLots: LotBreakdownEntry[];
  /** Total credits at risk of expiring unused. */
  totalAtRiskAmount: number;
};

// ─── Read methods ─────────────────────────────────────────────────────────────

export const lotService = {
  /**
   * All active, unexpired lots for a user, optionally filtered by credit type.
   * Sorted FIFO by expiresAt — matches the debit order so the user sees
   * exactly which lot will be spent next.
   */
  async getLotBreakdown(
    userId: string,
    creditType?: CreditType,
  ): Promise<LotBreakdownEntry[]> {
    const now = new Date();
    const conditions = [
      eq(creditLots.userId, userId),
      eq(creditLots.status, 'active'),
      gt(creditLots.expiresAt, now),
    ];
    if (creditType) conditions.push(eq(creditLots.creditType, creditType));

    const rows = await db
      .select()
      .from(creditLots)
      .where(and(...conditions))
      .orderBy(creditLots.expiresAt);

    return rows.map((r) => mapLotToEntry(r, now, /*atRisk*/ false));
  },

  /**
   * Quick check used by createBooking / acceptDuoInvite to decide whether a
   * booking would succeed without actually mutating any rows. FIFO-aware.
   */
  async hasSufficientCredits(
    userId: string,
    creditType: CreditType,
    requiredAmount: number,
  ): Promise<boolean> {
    const [row] = await db
      .select({ sum: sql<number>`COALESCE(SUM(${creditLots.remainingAmount}), 0)::int` })
      .from(creditLots)
      .where(
        and(
          eq(creditLots.userId, userId),
          eq(creditLots.creditType, creditType),
          eq(creditLots.status, 'active'),
          gt(creditLots.expiresAt, new Date()),
        ),
      );
    return (row?.sum ?? 0) >= requiredAmount;
  },

  /**
   * Project whether the user's current lots will be drained before they
   * expire, based on their recent booking frequency. Returns an "at risk"
   * flag per lot — used by the dashboard expiry-warning banner and by the
   * package recommender during checkout to prevent over-buying.
   */
  async predictUtilization(
    userId: string,
    opts: { lookbackDays?: number } = {},
  ): Promise<UtilizationPrediction> {
    const lookbackDays = opts.lookbackDays ?? 90;
    const since = new Date();
    since.setDate(since.getDate() - lookbackDays);
    const now = new Date();

    // Sum credits spent in the lookback window from completed bookings.
    // creditsSpent is the snapshot value at booking time, so this is exact.
    const [spentRow] = await db
      .select({ total: sql<number>`COALESCE(SUM(${bookings.creditsSpent}), 0)::int` })
      .from(bookings)
      .where(
        and(
          eq(bookings.userId, userId),
          eq(bookings.status, 'confirmed'),
          gte(bookings.bookedAt, since),
        ),
      );
    const totalSpent = spentRow?.total ?? 0;
    const weeks = Math.max(1, lookbackDays / 7);
    const avgCreditsPerWeek = totalSpent / weeks;

    // Walk active lots in FIFO order, simulating consumption at the avg rate.
    const lots = await db
      .select()
      .from(creditLots)
      .where(
        and(
          eq(creditLots.userId, userId),
          eq(creditLots.status, 'active'),
          gt(creditLots.expiresAt, now),
        ),
      )
      .orderBy(creditLots.expiresAt);

    let projectedAlreadySpent = 0;
    const atRiskLots: LotBreakdownEntry[] = [];
    let totalAtRiskAmount = 0;

    for (const lot of lots) {
      const weeksUntilExpiry = Math.max(
        0,
        (lot.expiresAt.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000),
      );
      // Capacity = how many credits the user would spend before this lot expires,
      // minus what's already projected to be drained from earlier (FIFO) lots.
      const totalProjectedByExpiry = avgCreditsPerWeek * weeksUntilExpiry;
      const availableCapacity = Math.max(0, totalProjectedByExpiry - projectedAlreadySpent);
      const projectedConsumed = Math.min(lot.remainingAmount, availableCapacity);
      const projectedWaste = lot.remainingAmount - projectedConsumed;

      projectedAlreadySpent += projectedConsumed;

      if (projectedWaste > 0) {
        const entry = mapLotToEntry(lot, now, /*atRisk*/ true);
        atRiskLots.push(entry);
        totalAtRiskAmount += Math.round(projectedWaste);
      }
    }

    return {
      avgCreditsPerWeek,
      lookbackDays,
      atRiskLots,
      totalAtRiskAmount,
    };
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapLotToEntry(lot: CreditLot, now: Date, atRisk: boolean): LotBreakdownEntry {
  const daysUntilExpiry = Math.max(
    0,
    Math.ceil((lot.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
  );
  return {
    id: lot.id,
    creditType: lot.creditType,
    remainingAmount: lot.remainingAmount,
    originalAmount: lot.originalAmount,
    acquiredAt: lot.acquiredAt,
    expiresAt: lot.expiresAt,
    daysUntilExpiry,
    atRisk,
  };
}
