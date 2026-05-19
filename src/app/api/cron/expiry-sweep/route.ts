import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/db';
import { creditLots, creditBalances, creditTransactions } from '@/db/schema';
import { and, eq, gt, lte, sql } from 'drizzle-orm';

// POST /api/cron/expiry-sweep
// Runs daily (e.g. every day at 02:00 UTC via Coolify scheduled task).
// Auth: Authorization: Bearer <CRON_SECRET>
//
// For every active credit_lots row whose expires_at <= NOW():
//   1. Mark the lot as status='expired'
//   2. Decrement credit_balances by the lot's remaining_amount
//   3. Append a credit_transactions ledger entry of type 'expiry' for audit
//
// The sweep is idempotent: re-running it on the same day does nothing,
// because previously-swept lots are already 'expired' (not 'active').

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const logger = {
  info: (msg: string, meta?: object) =>
    console.info(JSON.stringify({ level: 'info', msg, ...meta })),
  error: (msg: string, meta?: object) =>
    console.error(JSON.stringify({ level: 'error', msg, ...meta })),
};

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const startedAt = Date.now();

  // Step 1: Find all lots that need to expire (status='active' AND expires_at <= NOW())
  const expiringLots = await db
    .select()
    .from(creditLots)
    .where(
      and(
        eq(creditLots.status, 'active'),
        lte(creditLots.expiresAt, now),
        gt(creditLots.remainingAmount, 0),
      ),
    );

  if (expiringLots.length === 0) {
    logger.info('Expiry sweep: nothing to expire', { durationMs: Date.now() - startedAt });
    return NextResponse.json({
      success: true,
      expiredLots: 0,
      expiredCredits: 0,
      durationMs: Date.now() - startedAt,
    });
  }

  let expiredLotCount = 0;
  let expiredCreditTotal = 0;
  let errors = 0;

  // Step 2: For each lot, atomically expire it + decrement balance + audit entry.
  // Per-lot transactions keep the failure blast radius small (one bad row
  // doesn't roll back the entire sweep).
  for (const lot of expiringLots) {
    try {
      let expiredAmount = 0;

      await db.transaction(async (tx) => {
        // Re-read lot under lock — guard against concurrent debits stealing
        // from this lot between our outer SELECT and the UPDATE.
        const [locked] = await tx
          .select()
          .from(creditLots)
          .where(eq(creditLots.id, lot.id))
          .for('update')
          .limit(1);

        if (!locked || locked.status !== 'active' || locked.remainingAmount === 0) {
          // Another process already handled this row — skip silently.
          return;
        }

        const amount = locked.remainingAmount;
        expiredAmount = amount;

        // Mark lot as expired
        await tx
          .update(creditLots)
          .set({ status: 'expired', remainingAmount: 0 })
          .where(eq(creditLots.id, lot.id));

        // Decrement aggregate balance cache (or create if missing)
        const [balanceRow] = await tx
          .select()
          .from(creditBalances)
          .where(
            and(
              eq(creditBalances.userId, lot.userId),
              eq(creditBalances.creditType, lot.creditType),
            ),
          )
          .for('update')
          .limit(1);

        const newBalance = Math.max(0, (balanceRow?.balance ?? 0) - amount);

        // Find the next active lot's expiry so we shrink expires_at.
        const [nextLot] = await tx
          .select({ expiresAt: creditLots.expiresAt })
          .from(creditLots)
          .where(
            and(
              eq(creditLots.userId, lot.userId),
              eq(creditLots.creditType, lot.creditType),
              eq(creditLots.status, 'active'),
              gt(creditLots.expiresAt, now),
            ),
          )
          .orderBy(creditLots.expiresAt)
          .limit(1);

        const balanceUpdate: { balance: number; expiresAt?: Date | null; updatedAt: Date } = {
          balance: newBalance,
          updatedAt: now,
        };
        if (nextLot) {
          balanceUpdate.expiresAt = nextLot.expiresAt;
        } else if (newBalance === 0) {
          balanceUpdate.expiresAt = null;
        }

        if (balanceRow) {
          await tx
            .update(creditBalances)
            .set(balanceUpdate)
            .where(eq(creditBalances.id, balanceRow.id));
        } else {
          // Defensive: phantom balance row — recreate it so the cache stays consistent.
          await tx.insert(creditBalances).values({
            userId: lot.userId,
            creditType: lot.creditType,
            balance: newBalance,
            expiresAt: balanceUpdate.expiresAt ?? null,
          });
        }

        // Audit ledger entry — explains the missing credits to the user
        await tx.insert(creditTransactions).values({
          userId: lot.userId,
          type: 'expiry',
          creditType: lot.creditType,
          amount: -amount,
          balanceAfter: newBalance,
          description: `Expired ${amount} ${lot.creditType} credit${amount === 1 ? '' : 's'} (lot acquired ${lot.acquiredAt.toISOString().slice(0, 10)})`,
        });
      });

      if (expiredAmount > 0) {
        expiredLotCount += 1;
        expiredCreditTotal += expiredAmount;
      }
    } catch (err) {
      errors += 1;
      logger.error('Failed to expire lot', { lotId: lot.id, userId: lot.userId, err });
    }
  }

  const durationMs = Date.now() - startedAt;
  logger.info('Expiry sweep complete', {
    expiredLotCount,
    expiredCreditTotal,
    errors,
    durationMs,
  });

  return NextResponse.json({
    success: errors === 0,
    expiredLots: expiredLotCount,
    expiredCredits: expiredCreditTotal,
    errors,
    durationMs,
  });
}

// Helper unused but kept for future "force-expire by user" admin tooling
const _UNUSED_HELPER_PLACEHOLDER = sql`SELECT 1`;
void _UNUSED_HELPER_PLACEHOLDER;
