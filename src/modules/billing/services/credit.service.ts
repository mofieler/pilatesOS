import { db } from '@/db';
import { creditBalances, creditTransactions } from '@/db/schema';
import type { CreditTransaction, CreditType } from '@/db/schema';
import { eq, and, lt, desc } from 'drizzle-orm';

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
  | 'WAIVER_REQUIRED'
  | 'RATE_LIMITED';

// ─── Param Types ──────────────────────────────────────────────────────────────

export type CreditDebitParams = {
  userId: string;
  creditType: CreditType;
  amount: number;
  bookingId: string;
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
  expiresAt?: Date;
  description?: string;
  // [FIX-5] Required for Stripe webhook calls — prevents double-crediting on retries.
  // Phase 2: wired to stripeTransactions FOR UPDATE idempotency guard.
  stripeCheckoutSessionId?: string;
};

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
   * Debit credits for a booking. Acquires FOR UPDATE lock to prevent race conditions.
   */
  async debit(params: CreditDebitParams): Promise<ServiceResult<CreditTransaction>> {
    const { userId, creditType, amount, bookingId, description } = params;

    if (amount <= 0) {
      return { success: false, error: 'Debit amount must be positive.', code: 'INVALID_STATE' };
    }

    try {
      const result = await db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(creditBalances)
          .where(
            and(eq(creditBalances.userId, userId), eq(creditBalances.creditType, creditType)),
          )
          .for('update')
          .limit(1);

        const currentAmount = current?.balance ?? 0;

        if (currentAmount < amount) {
          throw new InsufficientCreditsError(
            `Insufficient ${creditType} credits. Has: ${currentAmount}, Needs: ${amount}`,
          );
        }

        const newBalance = currentAmount - amount;

        await tx
          .update(creditBalances)
          .set({ balance: newBalance, updatedAt: new Date() })
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
            description: description ?? `Credit debit for booking ${bookingId}`,
          })
          .returning();

        return transaction;
      });

      return { success: true, data: result as CreditTransaction };
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
   */
  async debitInternal(
    tx: TxClient,
    params: CreditDebitParams & { description: string },
  ): Promise<CreditTransaction> {
    const { userId, creditType, amount, bookingId, description } = params;

    const [current] = await tx
      .select()
      .from(creditBalances)
      .where(and(eq(creditBalances.userId, userId), eq(creditBalances.creditType, creditType)))
      .for('update')
      .limit(1);

    const currentAmount = current?.balance ?? 0;

    if (currentAmount < amount) {
      throw new InsufficientCreditsError(
        `Insufficient ${creditType} credits. Has: ${currentAmount}, Needs: ${amount}`,
      );
    }

    const newBalance = currentAmount - amount;

    await tx
      .update(creditBalances)
      .set({ balance: newBalance, updatedAt: new Date() })
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
   */
  async refundInternal(tx: TxClient, params: CreditRefundParams): Promise<CreditTransaction> {
    const { userId, creditType, amount, bookingId, description } = params;

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
      await tx
        .update(creditBalances)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(creditBalances.id, existing.id));
    } else {
      newBalance = amount;
      await tx.insert(creditBalances).values({ userId, creditType, balance: newBalance });
    }

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
   * Add credits after a purchase. Called by the Stripe webhook handler.
   *
   * [FIX-5] Phase 2: stripeCheckoutSessionId wires into a FOR UPDATE idempotency
   * check on stripeTransactions to prevent double-crediting on webhook retries.
   * The guard is stubbed here until stripeTransactions is added in Phase 2.
   */
  async addCredits(params: CreditAddParams): Promise<ServiceResult<CreditTransaction>> {
    const { userId, creditType, amount, packageId, expiresAt, description } = params;

    if (amount <= 0) {
      return { success: false, error: 'Amount must be positive.', code: 'INVALID_STATE' };
    }

    try {
      const result = await db.transaction(async (tx) => {
        // [FIX-5] Phase 2 TODO: add stripeTransactions FOR UPDATE idempotency check here
        // before any balance mutation when stripeCheckoutSessionId is present.

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
          await tx
            .update(creditBalances)
            .set({
              balance: newBalance,
              expiresAt: expiresAt ?? existing.expiresAt,
              updatedAt: new Date(),
            })
            .where(eq(creditBalances.id, existing.id));
        } else {
          newBalance = amount;
          await tx.insert(creditBalances).values({
            userId,
            creditType,
            balance: newBalance,
            expiresAt: expiresAt ?? null,
          });
        }

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

        return transaction;
      });

      logger.info('Credits added', { userId, creditType, amount });
      return { success: true, data: result as CreditTransaction };
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
   */
  async hasSufficientCredits(
    userId: string,
    creditType: CreditType,
    requiredAmount: number,
  ): Promise<boolean> {
    const balance = await creditService.getBalance(userId, creditType);
    return balance >= requiredAmount;
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
