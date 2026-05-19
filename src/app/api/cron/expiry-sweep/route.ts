import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

// POST /api/cron/expiry-sweep
// Runs daily (e.g. every day at 02:00 UTC via Coolify scheduled task).
// Auth: Authorization: Bearer <CRON_SECRET>
//
// Single SQL CTE — the database does all the work:
//   1. Identifies all active lots whose expires_at <= NOW()
//   2. Marks them expired (status='expired', remaining_amount=0)
//   3. Decrements credit_balances by the sum of expired amounts per user
//   4. Shrinks credit_balances.expires_at to the next active lot's expiry
//   5. Inserts audit ledger entries (credit_transactions) per lot
//
// Idempotent: re-running does nothing because expired lots are no longer 'active'.
// One statement = one implicit transaction. No JS loops, no N+1, no per-lot round-trips.

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

  const startedAt = Date.now();

  try {
    // Single CTE chain: identify → expire → balance update → audit insert → return stats
    const result = await db.execute(sql`
      WITH lots_to_expire AS (
        SELECT id, user_id, credit_type, remaining_amount, acquired_at
        FROM credit_lots
        WHERE status = 'active'
          AND expires_at <= NOW()
          AND remaining_amount > 0
      ),
      -- Mark all identified lots as expired in one UPDATE.
      expired_lots AS (
        UPDATE credit_lots
        SET status = 'expired', remaining_amount = 0
        WHERE id IN (SELECT id FROM lots_to_expire)
      ),
      -- Per-user totals needed for the balance update.
      expired_totals AS (
        SELECT user_id, credit_type, SUM(remaining_amount)::int AS total_expired
        FROM lots_to_expire
        GROUP BY user_id, credit_type
      ),
      -- Capture old balances before we overwrite them.
      old_balances AS (
        SELECT user_id, credit_type, balance
        FROM credit_balances
        WHERE (user_id, credit_type) IN (
          SELECT user_id, credit_type FROM expired_totals
        )
      ),
      -- Find the earliest future expiry per user+credit_type (after the UPDATE).
      next_lots AS (
        SELECT DISTINCT ON (user_id, credit_type)
          user_id, credit_type, expires_at AS next_expires_at
        FROM credit_lots
        WHERE status = 'active' AND expires_at > NOW()
        ORDER BY user_id, credit_type, expires_at ASC
      ),
      -- Decrement balances in one UPDATE.
      balance_updated AS (
        UPDATE credit_balances cb
        SET
          balance = GREATEST(0, COALESCE(ob.balance, 0) - et.total_expired),
          expires_at = CASE
            WHEN GREATEST(0, COALESCE(ob.balance, 0) - et.total_expired) = 0 THEN NULL
            ELSE nl.next_expires_at
          END,
          updated_at = NOW()
        FROM expired_totals et
        LEFT JOIN old_balances ob
          ON ob.user_id = et.user_id AND ob.credit_type = et.credit_type
        LEFT JOIN next_lots nl
          ON nl.user_id = et.user_id AND nl.credit_type = et.credit_type
        WHERE cb.user_id = et.user_id AND cb.credit_type = et.credit_type
      ),
      -- Defensive: create missing balance rows (balance = 0 after expiry).
      inserted_balances AS (
        INSERT INTO credit_balances (user_id, credit_type, balance, expires_at)
        SELECT et.user_id, et.credit_type, 0, NULL
        FROM expired_totals et
        LEFT JOIN credit_balances cb
          ON cb.user_id = et.user_id AND cb.credit_type = et.credit_type
        WHERE cb.id IS NULL
        ON CONFLICT (user_id, credit_type) DO NOTHING
      ),
      -- Audit ledger entries: one per expired lot with the final balance.
      audit_inserted AS (
        INSERT INTO credit_transactions
          (user_id, type, credit_type, amount, balance_after, description)
        SELECT
          lte.user_id,
          'expiry',
          lte.credit_type,
          -lte.remaining_amount,
          GREATEST(0, COALESCE(ob.balance, 0) - et.total_expired),
          'Expired ' || lte.remaining_amount || ' ' || lte.credit_type || ' credit'
            || CASE WHEN lte.remaining_amount = 1 THEN '' ELSE 's' END
            || ' (lot acquired ' || TO_CHAR(lte.acquired_at, 'YYYY-MM-DD') || ')'
        FROM lots_to_expire lte
        JOIN expired_totals et
          ON et.user_id = lte.user_id AND et.credit_type = lte.credit_type
        LEFT JOIN old_balances ob
          ON ob.user_id = lte.user_id AND ob.credit_type = lte.credit_type
      )
      SELECT
        (SELECT COUNT(*)::int FROM lots_to_expire) AS lot_count,
        (SELECT COALESCE(SUM(remaining_amount), 0)::int FROM lots_to_expire) AS total_expired;
    `);

    const row = (result[0] ?? {}) as {
      lot_count: number | string;
      total_expired: number | string;
    };

    const expiredLots = Number(row.lot_count ?? 0);
    const expiredCredits = Number(row.total_expired ?? 0);
    const durationMs = Date.now() - startedAt;

    logger.info('Expiry sweep complete', {
      expiredLots,
      expiredCredits,
      durationMs,
    });

    return NextResponse.json({
      success: true,
      expiredLots,
      expiredCredits,
      durationMs,
    });
  } catch (err) {
    logger.error('Expiry sweep failed', { err });
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
