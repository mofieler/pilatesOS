import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/db';
import { creditLots, creditBalances, creditTransactions } from '@/db/schema';
import { and, eq, gt, lte } from 'drizzle-orm';

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
//
// [PERF] Batch-by-user: one transaction per (userId, creditType) group
// instead of one transaction per lot. A typical user has 1-5 lots, so
// this cuts transaction count by ~5-10x at scale.

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
  // We only need the identifying fields; the tx will re-read under lock.
  const expiringLots = await db
    .select({
      id: creditLots.id,
      userId: creditLots.userId,
      creditType: creditLots.creditType,
      remainingAmount: creditLots.remainingAmount,
      acquiredAt: creditLots.acquiredAt,
    })
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

  // Group by (userId, creditType) so each group gets one transaction.
  const groups = new Map<string, typeof expiringLots>();
  for (const lot of expiringLots) {
    const key = `${lot.userId}:${lot.creditType}`;
    const arr = groups.get(key);
    if (arr) {
      arr.push(lot);
    } else {
      groups.set(key, [lot]);
    }
  }

  let expiredLotCount = 0;
  let expiredCreditTotal = 0;
  let errors = 0;

  // Step 2: For each (user, creditType) group, atomically expire all lots,
  // decrement balance once, find next expiry once, and batch-insert audit rows.
  for (const [key, lots] of groups) {
    try {
      let groupExpiredAmount = 0;
      const userId = lots[0].userId;
      const creditType = lots[0].creditType;

      await db.transaction(async (tx) => {
        // Lock ALL lots for this user+creditType (not just the expiring ones)
        // so concurrent debits can't steal from them mid-sweep.
        const locked = await tx
          .select({
            id: creditLots.id,
            status: creditLots.status,
            remainingAmount: creditLots.remainingAmount,
            acquiredAt: creditLots.acquiredAt,
          })
          .from(creditLots)
          .where(
            and(
              eq(creditLots.userId, userId),
              eq(creditLots.creditType, creditType),
            ),
          )
          .for('update');

        // Filter to the ones we intended to expire that are still valid.
        const expiredIds = new Set(lots.map((l) => l.id));
        const toExpire = locked.filter(
          (l) =>
            expiredIds.has(l.id) &&
            l.status === 'active' &&
            l.remainingAmount > 0,
        );

        if (toExpire.length === 0) return;

        const totalExpired = toExpire.reduce((s, l) => s + l.remainingAmount, 0);
        groupExpiredAmount = totalExpired;

        // Batch-update each expired lot.
        for (const lot of toExpire) {
          await tx
            .update(creditLots)
            .set({ status: 'expired', remainingAmount: 0 })
            .where(eq(creditLots.id, lot.id));
        }

        // Decrement aggregate balance cache.
        const [balanceRow] = await tx
          .select()
          .from(creditBalances)
          .where(
            and(
              eq(creditBalances.userId, userId),
              eq(creditBalances.creditType, creditType),
            ),
          )
          .for('update')
          .limit(1);

        const oldBalance = balanceRow?.balance ?? totalExpired;
        const newBalance = Math.max(0, oldBalance - totalExpired);

        // Find the next active lot's expiry so we shrink expires_at.
        const [nextLot] = await tx
          .select({ expiresAt: creditLots.expiresAt })
          .from(creditLots)
          .where(
            and(
              eq(creditLots.userId, userId),
              eq(creditLots.creditType, creditType),
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
            userId,
            creditType,
            balance: newBalance,
            expiresAt: balanceUpdate.expiresAt ?? null,
          });
        }

        // Batch-insert audit ledger entries — running balance decreases per lot.
        let runningBalance = oldBalance;
        const auditRows = toExpire.map((lot) => {
          runningBalance -= lot.remainingAmount;
          return {
            userId,
            type: 'expiry' as const,
            creditType,
            amount: -lot.remainingAmount,
            balanceAfter: runningBalance,
            description: `Expired ${lot.remainingAmount} ${creditType} credit${lot.remainingAmount === 1 ? '' : 's'} (lot acquired ${lot.acquiredAt.toISOString().slice(0, 10)})`,
          };
        });
        await tx.insert(creditTransactions).values(auditRows);
      });

      if (groupExpiredAmount > 0) {
        expiredLotCount += lots.length;
        expiredCreditTotal += groupExpiredAmount;
      }
    } catch (err) {
      errors += 1;
      logger.error('Failed to expire group', {
        key,
        userId: lots[0]?.userId,
        lotCount: lots.length,
        err,
      });
    }
  }

  const durationMs = Date.now() - startedAt;
  logger.info('Expiry sweep complete', {
    expiredLotCount,
    expiredCreditTotal,
    errors,
    groupCount: groups.size,
    durationMs,
  });

  return NextResponse.json({
    success: errors === 0,
    expiredLots: expiredLotCount,
    expiredCredits: expiredCreditTotal,
    errors,
    groupCount: groups.size,
    durationMs,
  });
}
