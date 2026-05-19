'use server';

import { z } from 'zod';
import { db } from '@/db';
import { bookings, users, classSessions } from '@/db/schema';
import { eq, and, isNull, asc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import type { ServiceResult } from '@/modules/billing/services/credit.service';
import { creditService, InsufficientCreditsError } from '@/modules/billing/services/credit.service';
import type { CreditType } from '@/lib/config/class-types';
import { isWelcomeJourneyBooking } from '@/lib/welcome';

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

      // Refund via canonical path — creates a fresh credit_lots row.
      await creditService.refundInternal(tx, {
        userId: bookingData.userId,
        creditType: bookingData.creditType,
        amount: bookingData.creditsSpent,
        bookingId: bookingData.id,
        description: 'Refund: removed from class by admin',
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

// ─── Mark booking as attended ─────────────────────────────────────────────────

const markAttendedSchema = z.object({
  bookingId: z.string().uuid(),
});

export async function markBookingAttendedAction(
  input: z.infer<typeof markAttendedSchema>,
): Promise<ServiceResult<{ success: boolean }>> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  const parsed = markAttendedSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'INVALID_STATE' };

  const { bookingId } = parsed.data;

  const [bookingData] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!bookingData) return { success: false, error: 'Booking not found', code: 'NOT_FOUND' };
  if (bookingData.status !== 'confirmed') {
    return { success: false, error: 'Can only mark confirmed bookings as attended', code: 'INVALID_STATE' };
  }

  try {
    await db.transaction(async (tx) => {
      // Update booking status
      await tx
        .update(bookings)
        .set({ status: 'attended', updatedAt: new Date() })
        .where(eq(bookings.id, bookingId));

      // If this was the Welcome Journey, mark the user as welcomed
      const isWelcome = await isWelcomeJourneyBooking(bookingId, tx);
      if (isWelcome) {
        await tx
          .update(users)
          .set({ welcomeCompletedAt: new Date(), updatedAt: new Date() })
          .where(eq(users.id, bookingData.userId));
      }
    });

    revalidatePath('/admin/classes');
    revalidatePath('/bookings');
    revalidatePath('/');

    return { success: true, data: { success: true } };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'markBookingAttendedAction failed', err }));
    return { success: false, error: 'Failed to mark as attended.', code: 'DB_ERROR' };
  }
}
