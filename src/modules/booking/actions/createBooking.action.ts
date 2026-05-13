'use server';

import { z } from 'zod';
import { db } from '@/db';
import { bookings, classSessions, classTemplates, creditBalances, users } from '@/db/schema';
import type { Booking } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import { creditService, InsufficientCreditsError } from '@/modules/billing/services/credit.service';
import type { ServiceResult, ServiceErrorCode } from '@/modules/billing/services/credit.service';
import { checkRateLimit, bookingRateLimitConfig } from '@/lib/security/server-action-rate-limiter';
import { sendBookingConfirmationEmail } from '@/lib/email/resend';
import { getUserBillingStatus } from '@/modules/billing/services/billingStatus.service';

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

  // ── 1b. Overdue bills check ──────────────────────────────────────────────────
  // Users with overdue pay-at-studio invoices cannot create new bookings until
  // they settle the outstanding amount. Uses the same source of truth as the
  // /api/credit-purchases guard so the policy is enforced consistently.
  const billing = await getUserBillingStatus(userId);
  if (billing.blockActions) {
    return {
      success: false,
      error:
        'You have overdue invoices. Please settle them at the studio before booking more classes.',
      code: 'OVERDUE_BILLS',
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

      if (classSession.startsAt <= new Date()) {
        throw new BookingError('This class has already started or passed.', 'INVALID_STATE');
      }

      if (classSession.bookedCount >= classSession.maxCapacity) {
        throw new BookingError('This class is full.', 'CLASS_FULL');
      }

      // Instructor unavailable? Reject server-side too — UI might be stale
      // or the user might call the action directly.
      if (classSession.instructorId) {
        const { getBlocksInRange } = await import(
          '@/modules/calendar/services/calendar-sync.service'
        );
        const blocks = await getBlocksInRange(classSession.startsAt, classSession.endsAt);
        const overlap = blocks.find(
          (b) =>
            b.instructorId === classSession.instructorId &&
            b.startsAt < classSession.endsAt &&
            b.endsAt > classSession.startsAt,
        );
        if (overlap) {
          throw new BookingError(
            'The instructor is unavailable for this class. Please choose another session.',
            'INVALID_STATE',
          );
        }
      }

      // Clean up any cancelled bookings for this user+session (allows rebooking)
      await tx
        .delete(bookings)
        .where(
          and(
            eq(bookings.userId, userId),
            eq(bookings.sessionId, sessionId),
            eq(bookings.status, 'cancelled'),
          ),
        );

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
        .select({
          creditCost: classTemplates.creditCost,
          creditType: classTemplates.creditType,
          classType: classTemplates.classType,
        })
        .from(classTemplates)
        .where(eq(classTemplates.id, classSession.templateId))
        .limit(1);

      if (!template) throw new BookingError('Class template not found.', 'NOT_FOUND');

      // Group-eligible classes also accept 'group' credits as fallback.
      // chair and online always use group; reformer_group/mat_group try primary first.
      // sound_healing uses its own credit type — no fallback.
      const GROUP_FALLBACK_TYPES = new Set(['reformer_group', 'mat_group', 'chair', 'online']);
      const primaryCreditType = template.creditType;
      const useFallback =
        GROUP_FALLBACK_TYPES.has(template.classType) && primaryCreditType !== 'group';

      // Determine which credit type to actually debit.
      // Check primary balance first; if insufficient and fallback applies, use 'group'.
      let resolvedCreditType = primaryCreditType;
      if (useFallback) {
        const [primaryBalance] = await tx
          .select({ balance: creditBalances.balance, expiresAt: creditBalances.expiresAt })
          .from(creditBalances)
          .where(
            and(
              eq(creditBalances.userId, userId),
              eq(creditBalances.creditType, primaryCreditType),
            ),
          )
          .limit(1);

        const primaryAvailable =
          primaryBalance &&
          primaryBalance.balance >= template.creditCost &&
          (!primaryBalance.expiresAt || primaryBalance.expiresAt > new Date());

        if (!primaryAvailable) {
          resolvedCreditType = 'group';
        }
      }

      // Insert booking first so the FK from creditTransactions → bookings resolves
      const [newBooking] = await tx
        .insert(bookings)
        .values({
          userId,
          sessionId,
          status: 'confirmed',
          creditsSpent: template.creditCost,
          creditType: resolvedCreditType,
        })
        .returning();

      // Debit credits inside the same transaction — throws InsufficientCreditsError on failure
      await creditService.debitInternal(tx, {
        userId,
        creditType: resolvedCreditType,
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

    // Fire-and-forget Google Calendar sync (updates attendee list in description).
    // Lazy import keeps googleapis out of the booking hot path's bundle graph.
    (async () => {
      try {
        const { updateAttendeesInDescription } = await import(
          '@/modules/calendar/services/calendar-sync.service'
        );
        await updateAttendeesInDescription(sessionId);
      } catch (err) {
        console.warn('[calendar] Booking GCal sync failed:', err);
      }
    })();

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
