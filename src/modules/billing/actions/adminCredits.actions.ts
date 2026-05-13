'use server';

import { z } from 'zod';
import { db } from '@/db';
import { creditBalances, creditTransactions, creditAdjustments, users } from '@/db/schema';
import type { CreditType } from '@/db/schema';
import { eq, and, isNull, desc, lt } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { handleApiError } from '@/lib/security/error-sanitizer';
import { auditHelpers } from '@/lib/security/audit-system';

const adjustSchema = z.object({
  userId:     z.string().uuid(),
  creditType: z.enum(['mat', 'reformer']),
  amountDelta: z.number().int().refine((n) => n !== 0, 'Amount must not be zero'),
  reason:      z.string().min(3).max(500),
  notes:       z.string().max(1000).optional(),
});

// All active users with their credit balances — used for the admin credit management overview
export async function getAdminUserCreditOverviewAction() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false as const, error: 'Unauthorized' };
  }

  try {
    const activeUsers = await db
      .select({
        id:    users.id,
        name:  users.name,
        email: users.email,
        role:  users.role,
      })
      .from(users)
      .where(and(isNull(users.deletedAt), eq(users.role, 'student')))
      .orderBy(users.name);

    const balances = await db.select().from(creditBalances);

    const balancesByUser: Record<string, typeof balances> = {};
    for (const b of balances) {
      if (!balancesByUser[b.userId]) balancesByUser[b.userId] = [];
      balancesByUser[b.userId].push(b);
    }

    const result = activeUsers.map((u) => ({
      ...u,
      balances: balancesByUser[u.id] ?? [],
    }));

    return { success: true as const, data: result };
  } catch (error) {
    const e = handleApiError(error, 'admin-credit-overview');
    return { success: false as const, error: e.error };
  }
}

// Adjustment history for a specific user (cursor-based)
export async function getUserCreditAdjustmentsAction(userId: string, cursor?: Date) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false as const, error: 'Unauthorized' };
  }

  try {
    const limit = 20;
    const rows = await db
      .select()
      .from(creditAdjustments)
      .where(
        cursor
          ? and(
              eq(creditAdjustments.userId, userId),
              lt(creditAdjustments.createdAt, cursor),
            )
          : eq(creditAdjustments.userId, userId),
      )
      .orderBy(desc(creditAdjustments.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data    = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1].createdAt : null;

    return { success: true as const, data, nextCursor };
  } catch (error) {
    const e = handleApiError(error, 'user-adjustments');
    return { success: false as const, error: e.error };
  }
}

// Manual credit adjustment — adds or removes credits for a user with full audit trail
export async function adjustUserCreditsAction(input: z.infer<typeof adjustSchema>) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false as const, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: 'Invalid input', code: 'VALIDATION_ERROR' };
  }

  const { userId, creditType, amountDelta, reason, notes } = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      // Lock the balance row to prevent concurrent adjustments
      const [existing] = await tx
        .select()
        .from(creditBalances)
        .where(
          and(
            eq(creditBalances.userId, userId),
            eq(creditBalances.creditType, creditType as CreditType),
          ),
        )
        .for('update')
        .limit(1);

      const currentBalance = existing?.balance ?? 0;
      const newBalance     = currentBalance + amountDelta;

      if (newBalance < 0) {
        throw new Error(`Cannot reduce balance below zero. Current: ${currentBalance}, delta: ${amountDelta}`);
      }

      // Update or create the balance row
      if (existing) {
        await tx
          .update(creditBalances)
          .set({ balance: newBalance, updatedAt: new Date() })
          .where(eq(creditBalances.id, existing.id));
      } else {
        await tx.insert(creditBalances).values({
          userId,
          creditType: creditType as CreditType,
          balance: newBalance,
        });
      }

      // Immutable credit transaction ledger entry
      const [txRow] = await tx
        .insert(creditTransactions)
        .values({
          userId,
          type:        'manual_adjustment',
          creditType:  creditType as CreditType,
          amount:      amountDelta,
          balanceAfter: newBalance,
          description: `Admin adjustment: ${reason}`,
          processedBy: session.user.id,
        })
        .returning();

      // §147 AO audit record — never modify after insertion
      await tx.insert(creditAdjustments).values({
        userId,
        adminId:     session.user.id,
        creditType:  creditType as CreditType,
        amountDelta,
        reason,
        newBalance,
        notes: notes ?? null,
      });

      return { newBalance, transactionId: txRow.id };
    });

    await auditHelpers.logAdminAction(
      session.user.id,
      'manual_credit_adjustment',
      'credit_balance',
      userId,
      { creditType, amountDelta, reason, newBalance: result.newBalance },
    );

    return { success: true as const, data: result };
  } catch (error) {
    const e = handleApiError(error, 'adjust-credits');
    return { success: false as const, error: e.error, code: 'ERROR' };
  }
}
