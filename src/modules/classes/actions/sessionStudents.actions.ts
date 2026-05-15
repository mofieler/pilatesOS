'use server';

import { z } from 'zod';
import { db } from '@/db';
import { bookings, users, classSessions, creditBalances, creditTransactions } from '@/db/schema';
import { eq, and, isNull, asc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import type { ServiceResult } from '@/modules/billing/services/credit.service';
import type { CreditType } from '@/lib/config/class-types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SessionStudent = {
  userId: string;
  name: string | null;
  email: string | null;
  bookingId: string;
  bookingStatus: string;
  creditsSpent: number;
  creditType: CreditType;
  bookedAt: Date;
};

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getSessionStudentsAction(sessionId: string): Promise<ServiceResult<SessionStudent[]>> {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== 'admin' && session.user.role !== 'instructor')) {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  try {
    const data = await db
      .select({
        userId: users.id, name: users.name, email: users.email,
        bookingId: bookings.id, bookingStatus: bookings.status,
        creditsSpent: bookings.creditsSpent, creditType: bookings.creditType,
        bookedAt: bookings.bookedAt,
      })
      .from(bookings)
      .innerJoin(users, eq(bookings.userId, users.id))
      .where(and(eq(bookings.sessionId, sessionId), eq(bookings.status, 'confirmed'), isNull(users.deletedAt)))
      .orderBy(asc(bookings.bookedAt));

    return { success: true, data: data as SessionStudent[] };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'getSessionStudentsAction failed', err }));
    return { success: false, error: 'Failed to load students.', code: 'DB_ERROR' };
  }
}

const removeStudentSchema = z.object({
  bookingId: z.string().uuid(),
  reason:    z.string().min(3).max(500),
});

export async function removeStudentFromSessionAction(
  input: z.infer<typeof removeStudentSchema>,
): Promise<ServiceResult<{ success: boolean }>> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  const parsed = removeStudentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'INVALID_STATE' };

  const { bookingId, reason } = parsed.data;

  const [bookingData] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);

  if (!bookingData) return { success: false, error: 'Booking not found', code: 'NOT_FOUND' };
  if (bookingData.status !== 'confirmed') return { success: false, error: 'Can only remove confirmed bookings', code: 'INVALID_STATE' };
  if (!bookingData.sessionId) return { success: false, error: 'Booking has no associated session', code: 'NOT_FOUND' };

  const [userData] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, bookingData.userId))
    .limit(1);

  try {
    await db.transaction(async (tx) => {
      await tx.update(bookings).set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: `Admin removed: ${reason}`,
        updatedAt: new Date(),
      }).where(eq(bookings.id, bookingId));

      const [balance] = await tx
        .select()
        .from(creditBalances)
        .where(and(eq(creditBalances.userId, bookingData.userId), eq(creditBalances.creditType, bookingData.creditType)))
        .for('update')
        .limit(1);

      const newBalance = (balance?.balance ?? 0) + bookingData.creditsSpent;
      if (balance) {
        await tx.update(creditBalances).set({ balance: newBalance, updatedAt: new Date() }).where(eq(creditBalances.id, balance.id));
      } else {
        await tx.insert(creditBalances).values({ userId: bookingData.userId, creditType: bookingData.creditType, balance: newBalance });
      }

      await tx.insert(creditTransactions).values({
        userId: bookingData.userId,
        type: 'refund',
        creditType: bookingData.creditType,
        amount: bookingData.creditsSpent,
        balanceAfter: newBalance,
        description: 'Refund: removed from class by admin',
        processedBy: session.user.id,
      });

      // Atomic decrement — avoids stale-read race condition
      await tx.update(classSessions).set({
        bookedCount: sql`GREATEST(0, ${classSessions.bookedCount} - 1)`,
        updatedAt: new Date(),
      }).where(eq(classSessions.id, bookingData.sessionId!));
    });

    revalidatePath('/admin/classes');
    revalidatePath('/book');

    // Fire-and-forget notification
    (async () => {
      try {
        const { sendNotificationEmail } = await import('@/lib/email/resend');
        if (userData?.email) {
          await sendNotificationEmail(
            userData.email, 'Removed from class', 'You have been removed from a class',
            `Reason: ${reason}\n\nYour credits have been fully refunded to your account.`,
          );
        }
      } catch (err) {
        console.warn('[email] Student removed notification failed:', err);
      }
    })();

    return { success: true, data: { success: true } };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'removeStudentFromSessionAction failed', err }));
    return { success: false, error: 'Failed to remove student.', code: 'DB_ERROR' };
  }
}
