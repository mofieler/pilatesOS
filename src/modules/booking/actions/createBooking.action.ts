'use server';

import { z } from 'zod';
import { db } from '@/db';
import { bookings, classSessions, classTemplates, users } from '@/db/schema';
import type { Booking } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import { creditService, InsufficientCreditsError } from '@/modules/billing/services/credit.service';
import type { ServiceResult, ServiceErrorCode } from '@/modules/billing/services/credit.service';
import { checkRateLimit, bookingRateLimitConfig } from '@/lib/security/server-action-rate-limiter';
import { sendBookingConfirmationEmail } from '@/lib/email/resend';

// ─── Input Validation ─────────────────────────────────────────────────────────

const schema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
});

// ─────────────────────────────────────────────────────────────────────────────

export async function createBookingAction(
  input: z.infer<typeof schema>,
): Promise<ServiceResult<Booking>> {
  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  const authSession = await auth();
  if (!authSession?.user?.id) {
    return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };
  }
  const userId = authSession.user.id;

  // ── 1a. Rate Limiting ────────────────────────────────────────────────────────
  const rateLimitResult = await checkRateLimit(bookingRateLimitConfig, `create:${userId}`);
  if (!rateLimitResult.success) {
    return {
      success: false,
      error: 'Too many booking attempts. Please try again in a minute.',
      code: 'RATE_LIMITED',
    };
  }

  // ── 1b. Waiver Check ─────────────────────────────────────────────────────────
  // Students must sign waiver before their first booking (liability protection)
  const [user] = await db
    .select({ hasSignedWaiver: users.hasSignedWaiver })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.hasSignedWaiver) {
    return {
      success: false,
      error: 'Please sign the liability waiver before booking. Visit /waiver to sign.',
      code: 'WAIVER_REQUIRED',
    };
  }

  // ── 2. Zod validation ────────────────────────────────────────────────────────
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
      code: 'INVALID_STATE',
    };
  }
  const { sessionId } = parsed.data;

  // ── 3. Atomic transaction ─────────────────────────────────────────────────────
  try {
    const booking = await db.transaction(async (tx) => {
      // Lock session row — prevents concurrent overbooking
      const [classSession] = await tx
        .select()
        .from(classSessions)
        .where(eq(classSessions.id, sessionId))
        .for('update')
        .limit(1);

      if (!classSession) throw new BookingError('Session not found.', 'NOT_FOUND');

      if (classSession.status !== 'scheduled') {
        throw new BookingError('This class is no longer available for booking.', 'INVALID_STATE');
      }

      if (classSession.bookedCount >= classSession.maxCapacity) {
        throw new BookingError('This class is full.', 'CLASS_FULL');
      }

      // Prevent duplicate bookings for the same user + session
      const [existing] = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.userId, userId),
            eq(bookings.sessionId, sessionId),
            eq(bookings.status, 'confirmed'),
          ),
        )
        .limit(1);

      if (existing) {
        throw new BookingError(
          'You already have a booking for this class.',
          'BOOKING_ALREADY_EXISTS',
        );
      }

      // Fetch credit cost and type from the class template
      if (!classSession.templateId) {
        throw new BookingError('Class template not configured for this session.', 'NOT_FOUND');
      }

      const [template] = await tx
        .select({ creditCost: classTemplates.creditCost, creditType: classTemplates.creditType })
        .from(classTemplates)
        .where(eq(classTemplates.id, classSession.templateId))
        .limit(1);

      if (!template) throw new BookingError('Class template not found.', 'NOT_FOUND');

      // Insert booking first so the FK from creditTransactions → bookings resolves
      const [newBooking] = await tx
        .insert(bookings)
        .values({
          userId,
          sessionId,
          status: 'confirmed',
          creditsSpent: template.creditCost,
          creditType: template.creditType,
        })
        .returning();

      // Debit credits inside the same transaction — throws InsufficientCreditsError on failure
      await creditService.debitInternal(tx, {
        userId,
        creditType: template.creditType,
        amount: template.creditCost,
        bookingId: newBooking.id,
        description: `Booking: session ${sessionId}`,
      });

      // Increment session counter
      await tx
        .update(classSessions)
        .set({ bookedCount: classSession.bookedCount + 1, updatedAt: new Date() })
        .where(eq(classSessions.id, sessionId));

      return newBooking;
    });

    revalidatePath('/book');
    revalidatePath('/dashboard');

    // Fire-and-forget — email failure must never roll back a successful booking
    Promise.resolve().then(async () => {
      try {
        const [[userRow], [sessionRow]] = await Promise.all([
          db.select({ email: users.email, name: users.name })
            .from(users).where(eq(users.id, userId)).limit(1),
          db.select({ startsAt: classSessions.startsAt, title: classTemplates.name })
            .from(classSessions)
            .innerJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
            .where(eq(classSessions.id, sessionId)).limit(1),
        ]);
        if (userRow?.email && sessionRow) {
          const classDate = sessionRow.startsAt.toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          });
          const classTime = sessionRow.startsAt.toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit',
          });
          await sendBookingConfirmationEmail(
            userRow.email,
            userRow.name ?? 'there',
            sessionRow.title,
            classDate,
            classTime,
          );
        }
      } catch (err) {
        console.warn('[email] Booking confirmation email failed:', err);
      }
    }).catch(() => {});

    return { success: true, data: booking as Booking };
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return { success: false, error: err.message, code: 'INSUFFICIENT_CREDITS' };
    }
    if (err instanceof BookingError) {
      return { success: false, error: err.message, code: err.code };
    }
    console.error(JSON.stringify({ level: 'error', msg: 'createBookingAction failed', err }));
    return { success: false, error: 'Failed to create booking.', code: 'DB_ERROR' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class BookingError extends Error {
  constructor(
    message: string,
    public readonly code: ServiceErrorCode,
  ) {
    super(message);
    this.name = 'BookingError';
  }
}
