import { db } from '@/db';
import { creditBalances, creditTransactions, creditPurchases, creditLots } from '@/db/schema';
import type { CreditTransaction, CreditLot, CreditType } from '@/db/schema';
import { eq, and, lt, desc, asc, gt, sql } from 'drizzle-orm';
import { CREDIT_PACK_CATEGORIES } from '@/lib/config/financial-config';

// ─── Shared Result Types ──────────────────────────────────────────────────────

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: ServiceErrorCode };

export type ServiceErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'ALREADY_CANCELLED'
  | 'INSUFFICIENT_CREDITS'
  | 'BOOKING_ALREADY_EXISTS'
  | 'CLASS_FULL'
  | 'OUTSIDE_CANCELLATION_WINDOW'
  | 'WAITLIST_FULL'
  | 'ALREADY_ON_WAITLIST'
  | 'OFFER_EXPIRED'
  | 'INVALID_STATE'
  | 'DUPLICATE_PAYMENT'
  | 'DB_ERROR'
  | 'RATE_LIMITED'
  | 'OVERDUE_BILLS'
  | 'WELCOME_REQUIRED';

// ─── Param Types ──────────────────────────────────────────────────────────────

export type CreditDebitParams = {
  userId: string;
  creditType: CreditType;
  amount: number;
  bookingId?: string;
  description?: string;
};

export type CreditRefundParams = {
  userId: string;
  creditType: CreditType;
  amount: number;
  bookingId: string;
  description: string;
};

export type CreditAddParams = {
  userId: string;
  creditType: CreditType;
  amount: number;
  packageId?: string;
  // Direct link from the new lot to the credit_purchases row (pay-at-studio
  // and Stripe paths both populate this). Separate from packageId because
  // packageId points at the catalog SKU and purchaseId at the transaction.
  purchaseId?: string;
  expiresAt?: Date;
  validityWeeks?: number;
  description?: string;
  // [FIX-5] Required for Stripe webhook calls — prevents double-crediting on retries.
  // Phase 2: wired to stripeTransactions FOR UPDATE idempotency guard.
  stripeCheckoutSessionId?: string;
};

export type AddCreditsResult = {
  transaction: CreditTransaction;
  lot: CreditLot;
  newBalance: number;
};

// Default validity if neither expiresAt nor validityWeeks is provided.
// Mirrors creditPackages.validity_weeks default. Keeps the lot from
// living forever if a caller forgets to specify an expiry.
const DEFAULT_VALIDITY_WEEKS = Math.round(CREDIT_PACK_CATEGORIES.credit.defaultValidityDays / 7);

// [FIX-4] Cursor-based pagination result type.
export type PaginatedTransactionHistory = {
  data: CreditTransaction[];
  nextCursor: Date | null;
};

type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ─── Custom Errors ────────────────────────────────────────────────────────────

export class InsufficientCreditsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientCreditsError';
  }
}

class DuplicatePaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicatePaymentError';
  }
}

// ─── Logger ───────────────────────────────────────────────────────────────────

const logger = {
  info: (msg: string, meta?: object) =>
    console.info(JSON.stringify({ level: 'info', msg, ...meta })),
  error: (msg: string, meta?: object) =>
    console.error(JSON.stringify({ level: 'error', msg, ...meta })),
};

// ─────────────────────────────────────────────────────────────────────────────
// CREDIT SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export const creditService = {
  /**
   * Get current balance for a user by credit type.
   */
  async getBalance(userId: string, creditType: CreditType): Promise<number> {
    const [row] = await db
      .select({ balance: creditBalances.balance })
      .from(creditBalances)
      .where(
        and(eq(creditBalances.userId, userId), eq(creditBalances.creditType, creditType)),
      )
      .limit(1);

    return row?.balance ?? 0;
  },

  /**
   * Get all credit balances for a user (dashboard display).
   */
  async getAllBalances(userId: string) {
    return db.select().from(creditBalances).where(eq(creditBalances.userId, userId));
  },

  /**
   * Debit credits for a booking. Public wrapper around debitInternal that
   * opens its own transaction. Use debitInternal when composing with another
   * transaction (createBooking does this so booking insert + debit are atomic).
   */
  async debit(params: CreditDebitParams): Promise<ServiceResult<CreditTransaction>> {
    const { userId, creditType, amount, bookingId, description } = params;

    if (amount <= 0) {
      return { success: false, error: 'Debit amount must be positive.', code: 'INVALID_STATE' };
    }

    try {
      const result = await db.transaction(async (tx) =>
        creditService.debitInternal(tx, {
          userId,
          creditType,
          amount,
          bookingId,
          description: description ?? `Credit debit for booking ${bookingId}`,
        }),
      );
      return { success: true, data: result };
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        return { success: false, error: err.message, code: 'INSUFFICIENT_CREDITS' };
      }
      logger.error('Credit debit failed', { err, userId, creditType, amount });
      return { success: false, error: 'Credit debit failed.', code: 'DB_ERROR' };
    }
  },

  /**
   * Internal debit — accepts an existing tx client for composition.
   * Throws InsufficientCreditsError so the caller's transaction rolls back cleanly.
   * Used by createBooking so the debit is atomic with the booking insert.
   *
   * Strategy:
   *   1. Lock and read active lots (status='active', expires_at > NOW())
   *      ordered by expires_at ASC. This is FIFO over expiry — credits that
   *      expire first are spent first.
   *   2. If the sum of remaining_amount across those lots is sufficient,
   *      iterate and decrement them one-by-one until `amount` is satisfied.
   *      Mark exhausted (remaining=0) lots as status='exhausted'.
   *   3. Decrement credit_balances.balance by the same amount.
   *   4. Insert one ledger entry (type='debit', amount=-amount).
   *
   * Defensive fallback: if a user has positive credit_balances.balance but
   * NO active lots, do a balance-only debit (legacy path). This protects
   * existing users during the dual-write transition before Sprint 5's
   * backfill has run. Once backfill is complete on the VPS, this branch
   * effectively never triggers; it can be removed in a later cleanup.
   */
  async debitInternal(
    tx: TxClient,
    params: CreditDebitParams & { description: string },
  ): Promise<CreditTransaction> {
    const { userId, creditType, amount, bookingId, description } = params;

    if (amount <= 0) {
      throw new Error('debitInternal: amount must be positive');
    }

    const now = new Date();

    // 1. Lock and read active, unexpired lots FIFO by expires_at.
    const activeLots = await tx
      .select({
        id: creditLots.id,
        remainingAmount: creditLots.remainingAmount,
        expiresAt: creditLots.expiresAt,
        acquiredAt: creditLots.acquiredAt,
      })
      .from(creditLots)
      .where(
        and(
          eq(creditLots.userId, userId),
          eq(creditLots.creditType, creditType),
          eq(creditLots.status, 'active'),
          gt(creditLots.expiresAt, now),
        ),
      )
      .orderBy(asc(creditLots.expiresAt))
      .for('update');

    const totalAvailableInLots = activeLots.reduce(
      (sum, lot) => sum + lot.remainingAmount,
      0,
    );

    // Path A — lots exist for this user/creditType: FIFO debit
    if (activeLots.length > 0) {
      if (totalAvailableInLots < amount) {
        throw new InsufficientCreditsError(
          `Insufficient ${creditType} credits. Has: ${totalAvailableInLots}, Needs: ${amount}`,
        );
      }

      let remaining = amount;
      for (const lot of activeLots) {
        if (remaining <= 0) break;
        const take = Math.min(lot.remainingAmount, remaining);
        const newLotRemaining = lot.remainingAmount - take;
        const newLotStatus = newLotRemaining === 0 ? 'exhausted' : 'active';
        await tx
          .update(creditLots)
          .set({ remainingAmount: newLotRemaining, status: newLotStatus })
          .where(eq(creditLots.id, lot.id));
        remaining -= take;
      }

      // Decrement aggregate balance cache.
      const [balanceRow] = await tx
        .select({
          id: creditBalances.id,
          balance: creditBalances.balance,
          expiresAt: creditBalances.expiresAt,
        })
        .from(creditBalances)
        .where(
          and(
            eq(creditBalances.userId, userId),
            eq(creditBalances.creditType, creditType),
          ),
        )
        .for('update')
        .limit(1);

      // Defensive: if the aggregate cache has drifted below the lot sum,
      // log a warning and clamp to zero rather than writing a negative balance.
      const rawBalance = balanceRow?.balance ?? totalAvailableInLots;
      if (balanceRow && balanceRow.balance < amount) {
        logger.error('Credit balance cache drift detected', {
          userId,
          creditType,
          cacheBalance: balanceRow.balance,
          lotSum: totalAvailableInLots,
          debitAmount: amount,
        });
      }
      const newBalance = Math.max(0, rawBalance - amount);

      // Find the earliest-expiring lot that still has credits after this debit.
      let debitRemaining = amount;
      const nextExpiry = activeLots.find((lot) => {
        const take = Math.min(lot.remainingAmount, debitRemaining);
        debitRemaining -= take;
        return lot.remainingAmount - take > 0;
      })?.expiresAt ?? null;

      const balanceUpdate: { balance: number; expiresAt?: Date | null; updatedAt: Date } = {
        balance: newBalance,
        updatedAt: now,
      };
      if (nextExpiry) {
        balanceUpdate.expiresAt = nextExpiry;
      } else if (newBalance === 0) {
        balanceUpdate.expiresAt = null;
      }

      if (balanceRow) {
        await tx
          .update(creditBalances)
          .set(balanceUpdate)
          .where(eq(creditBalances.id, balanceRow.id));
      } else {
        // Defensive: lots exist but aggregate cache is missing. Re-create it.
        await tx.insert(creditBalances).values({
          userId,
          creditType,
          balance: newBalance,
          expiresAt: balanceUpdate.expiresAt ?? nextExpiry ?? activeLots[activeLots.length - 1]?.expiresAt ?? now,
        });
      }

      const [transaction] = await tx
        .insert(creditTransactions)
        .values({
          userId,
          bookingId,
          type: 'debit',
          creditType,
          amount: -amount,
          balanceAfter: newBalance,
          description,
        })
        .returning();

      return transaction as CreditTransaction;
    }

    // Path B — no active lots: legacy balance-only debit (pre-backfill users)
    const [current] = await tx
      .select()
      .from(creditBalances)
      .where(
        and(eq(creditBalances.userId, userId), eq(creditBalances.creditType, creditType)),
      )
      .for('update')
      .limit(1);

    if (!current) {
      throw new InsufficientCreditsError(
        `No ${creditType} credits found for user ${userId}`,
      );
    }

    if (current.expiresAt && now > current.expiresAt) {
      throw new InsufficientCreditsError(
        `${creditType} credits expired on ${current.expiresAt.toISOString().slice(0, 10)}`,
      );
    }

    if (current.balance < amount) {
      throw new InsufficientCreditsError(
        `Insufficient ${creditType} credits. Has: ${current.balance}, Needs: ${amount}`,
      );
    }

    logger.info('debitInternal: legacy balance-only path (no lots present yet)', {
      userId, creditType, amount,
    });

    const newBalance = current.balance - amount;

    await tx
      .update(creditBalances)
      .set({
        balance: newBalance,
        expiresAt: newBalance === 0 ? null : current.expiresAt,
        updatedAt: now,
      })
      .where(eq(creditBalances.id, current.id));

    const [transaction] = await tx
      .insert(creditTransactions)
      .values({
        userId,
        bookingId,
        type: 'debit',
        creditType,
        amount: -amount,
        balanceAfter: newBalance,
        description,
      })
      .returning();

    return transaction as CreditTransaction;
  },

  /**
   * Public refund wrapper — creates its own transaction.
   */
  async refund(params: CreditRefundParams): Promise<ServiceResult<CreditTransaction>> {
    try {
      const result = await db.transaction(async (tx) => {
        return creditService.refundInternal(tx, params);
      });
      return { success: true, data: result };
    } catch (err) {
      logger.error('Credit refund failed', { err, ...params });
      return { success: false, error: 'Credit refund failed.', code: 'DB_ERROR' };
    }
  },

  /**
   * Internal refund — accepts a tx client for composition inside other transactions.
   * Used by cancellationService so refunds are atomic with the booking update.
   *
   * Strategy: create a fresh credit_lots row for the refunded amount with the
   * default validity (52 weeks). This is generous to the user — they get a
   * full new expiry rather than being tied to the original lot's remaining
   * lifetime. The balance cache is incremented and a ledger entry written.
   *
   * Future enhancement (out of scope): trace the original lot via the debit
   * ledger and write back to it, falling back to a fresh lot only if the
   * original is already expired. Requires a credit_transactions.lot_id link.
   */
  async refundInternal(tx: TxClient, params: CreditRefundParams): Promise<CreditTransaction> {
    const { userId, creditType, amount, bookingId, description } = params;

    if (amount <= 0) {
      throw new Error('refundInternal: amount must be positive');
    }

    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DEFAULT_VALIDITY_WEEKS * 7);

    // 1. Create a fresh lot for the refunded credits.
    await tx.insert(creditLots).values({
      userId,
      creditType,
      originalAmount: amount,
      remainingAmount: amount,
      expiresAt,
      status: 'active',
    });

    // 2. Increment aggregate balance.
    const [existing] = await tx
      .select()
      .from(creditBalances)
      .where(
        and(eq(creditBalances.userId, userId), eq(creditBalances.creditType, creditType)),
      )
      .for('update')
      .limit(1);

    let newBalance: number;

    if (existing) {
      newBalance = existing.balance + amount;
      // Extend balance.expiresAt if the new lot expires later.
      const keepExpiry =
        !existing.expiresAt
          ? expiresAt
          : expiresAt > existing.expiresAt
            ? expiresAt
            : existing.expiresAt;
      await tx
        .update(creditBalances)
        .set({ balance: newBalance, expiresAt: keepExpiry, updatedAt: now })
        .where(eq(creditBalances.id, existing.id));
    } else {
      newBalance = amount;
      await tx
        .insert(creditBalances)
        .values({ userId, creditType, balance: newBalance, expiresAt });
    }

    // 3. Ledger entry.
    const [transaction] = await tx
      .insert(creditTransactions)
      .values({
        userId,
        bookingId,
        type: 'refund',
        creditType,
        amount: +amount,
        balanceAfter: newBalance,
        description,
      })
      .returning();

    return transaction as CreditTransaction;
  },

  /**
   * Internal add-credits — composable inside an existing transaction.
   *
   * Dual-writes: creates a new credit_lots row AND updates the
   * credit_balances aggregate cache in the same transaction. Inserts a
   * credit_transactions ledger entry.
   *
   * Caller is responsible for:
   *   - Idempotency guard (Stripe session check)
   *   - Wrapping the call in db.transaction()
   *
   * The balance row's expires_at is kept at MAX(old, new) so a shorter-
   * validity top-up never silently shortens an existing longer expiry. The
   * lot retains its own true expiry, which is what FIFO debit reads from.
   */
  async addCreditsInternal(
    tx: TxClient,
    params: CreditAddParams,
  ): Promise<AddCreditsResult> {
    const { userId, creditType, amount, packageId, purchaseId, validityWeeks, description } = params;

    if (amount <= 0) {
      throw new Error('addCreditsInternal: amount must be positive');
    }

    // Compute expiry: explicit expiresAt > validityWeeks > default
    let expiresAt: Date;
    if (params.expiresAt) {
      expiresAt = params.expiresAt;
    } else {
      const weeks = validityWeeks && validityWeeks > 0 ? validityWeeks : DEFAULT_VALIDITY_WEEKS;
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + weeks * 7);
    }

    // 1. Upsert balance — keep the LATER expiry to avoid shortening older credits.
    const [existing] = await tx
      .select()
      .from(creditBalances)
      .where(
        and(eq(creditBalances.userId, userId), eq(creditBalances.creditType, creditType)),
      )
      .for('update')
      .limit(1);

    let newBalance: number;

    if (existing) {
      newBalance = existing.balance + amount;
      const keepExpiry =
        !existing.expiresAt
          ? expiresAt
          : expiresAt > existing.expiresAt
            ? expiresAt
            : existing.expiresAt;
      await tx
        .update(creditBalances)
        .set({
          balance: newBalance,
          expiresAt: keepExpiry,
          updatedAt: new Date(),
        })
        .where(eq(creditBalances.id, existing.id));
    } else {
      newBalance = amount;
      await tx.insert(creditBalances).values({
        userId,
        creditType,
        balance: newBalance,
        expiresAt,
      });
    }

    // 2. Insert lot — this is the FIFO record. Its expires_at is the
    //    authoritative source for when *these specific credits* expire.
    const [lot] = await tx
      .insert(creditLots)
      .values({
        userId,
        creditType,
        originalAmount: amount,
        remainingAmount: amount,
        purchaseId: purchaseId ?? null,
        expiresAt,
        status: 'active',
      })
      .returning();

    // 3. Ledger entry
    const [transaction] = await tx
      .insert(creditTransactions)
      .values({
        userId,
        packageId: packageId ?? null,
        type: 'purchase',
        creditType,
        amount: +amount,
        balanceAfter: newBalance,
        description: description ?? `Purchased ${amount} ${creditType} credits`,
      })
      .returning();

    return {
      transaction: transaction as CreditTransaction,
      lot: lot as CreditLot,
      newBalance,
    };
  },

  /**
   * Add credits after a purchase. Called by the Stripe webhook handler and by
   * other purchase paths that don't manage their own transaction context.
   *
   * [FIX-5] stripeCheckoutSessionId wires into a FOR UPDATE idempotency check
   * on creditPurchases to prevent double-crediting on webhook retries.
   */
  async addCredits(params: CreditAddParams): Promise<ServiceResult<CreditTransaction>> {
    const { userId, creditType, amount } = params;

    if (amount <= 0) {
      return { success: false, error: 'Amount must be positive.', code: 'INVALID_STATE' };
    }

    try {
      const result = await db.transaction(async (tx) => {
        // [FIX-5] Idempotency guard: if this Stripe session was already processed,
        // a creditPurchases row with this stripeSessionId already exists. Lock it
        // FOR UPDATE so concurrent webhook retries serialize and only one proceeds.
        if (params.stripeCheckoutSessionId) {
          const [processed] = await tx
            .select({ id: creditPurchases.id })
            .from(creditPurchases)
            .where(eq(creditPurchases.stripeSessionId, params.stripeCheckoutSessionId))
            .for('update')
            .limit(1);

          if (processed) {
            throw new DuplicatePaymentError(
              `Stripe session ${params.stripeCheckoutSessionId} already processed.`,
            );
          }
        }

        return creditService.addCreditsInternal(tx, params);
      });

      logger.info('Credits added', { userId, creditType, amount, lotId: result.lot.id });
      return { success: true, data: result.transaction };
    } catch (err) {
      if (err instanceof DuplicatePaymentError) {
        logger.info('Idempotency guard: duplicate Stripe webhook suppressed', {
          message: (err as Error).message,
        });
        return { success: false, error: (err as Error).message, code: 'DUPLICATE_PAYMENT' };
      }
      logger.error('Add credits failed', { err, userId, creditType, amount });
      return { success: false, error: 'Failed to add credits.', code: 'DB_ERROR' };
    }
  },

  /**
   * Read-only balance check for UI (disable booking button if insufficient).
   * Uses the lot ledger (ground truth) rather than the aggregate cache.
   */
  async hasSufficientCredits(
    userId: string,
    creditType: CreditType,
    requiredAmount: number,
  ): Promise<boolean> {
    const { lotService } = await import('@/modules/billing/services/lot.service');
    return lotService.hasSufficientCredits(userId, creditType, requiredAmount);
  },

  /**
   * Cursor-based paginated transaction history.
   * [FIX-4] Pass nextCursor from previous page as cursor on next call.
   */
  async getTransactionHistory(
    userId: string,
    limit = 20,
    cursor?: Date,
  ): Promise<PaginatedTransactionHistory> {
    const safeLimit = Math.min(limit, 100);

    const whereClause = cursor
      ? and(eq(creditTransactions.userId, userId), lt(creditTransactions.createdAt, cursor))
      : eq(creditTransactions.userId, userId);

    const rows = await db
      .select()
      .from(creditTransactions)
      .where(whereClause)
      .orderBy(desc(creditTransactions.createdAt))
      .limit(safeLimit + 1);

    const hasNextPage = rows.length > safeLimit;
    const data = hasNextPage ? rows.slice(0, safeLimit) : rows;
    const nextCursor = hasNextPage && data.length > 0 ? data[data.length - 1].createdAt : null;

    return { data: data as CreditTransaction[], nextCursor };
  },
};
