import { db } from '@/db';
import { bookings, users, classSessions, classTemplates, waitlistEntries } from '@/db/schema';
import type { Booking } from '@/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { sendBookingCancellationEmail, sendClassCancelledByAdminEmail } from '@/lib/email/resend';
import { differenceInHours } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { creditService } from '@/modules/billing/services/credit.service';
import type { ServiceResult, ServiceErrorCode } from '@/modules/billing/services/credit.service';
import { CANCELLATION_WINDOW_HOURS } from '@/constants/BOOKING_RULES';

export type { ServiceResult, ServiceErrorCode };

// ─────────────────────────────────────────────────────────────────────────────


const logger = {
  info: (msg: string, meta?: object) =>
    console.info(JSON.stringify({ level: 'info', msg, ...meta })),
  error: (msg: string, meta?: object) =>
    console.error(JSON.stringify({ level: 'error', msg, ...meta })),
};

// ─── Result Types ─────────────────────────────────────────────────────────────

export type CancellationResult = {
  booking: Booking;
  refundIssued: boolean;
  mercyApplied: boolean;
  creditsRefunded: number;
  message: string;
};

export type InstructorCancellationResult = {
  sessionId: string;
  totalBookingsCancelled: number;
  totalCreditsRefunded: number;
  affectedUserIds: string[];
};

class SessionCancellationError extends Error {
  constructor(message: string, public readonly code: ServiceErrorCode) {
    super(message);
    this.name = 'SessionCancellationError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CANCELLATION SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export const cancellationService = {
  /**
   * Cancel a single booking initiated by a student or admin.
   *
   * Rules applied in order:
   *  1. >24h before class  → full refund, no penalty.
   *  2. <24h, first time   → First-Time Mercy grace; full refund, flag used.
   *  3. <24h, mercy used   → no refund; credits forfeited.
   *
   * creditService.refundInternal is called INSIDE the transaction so the
   * balance update and booking status change are a single atomic operation.
   */
  async cancel(
    bookingId: string,
    requestingUserId: string,
    reason?: string,
  ): Promise<ServiceResult<CancellationResult>> {
    // ── 1. Fetch booking ────────────────────────────────────────────────────
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) {
      return { success: false, error: 'Booking not found.', code: 'NOT_FOUND' };
    }

    // ── 2. Authorization ────────────────────────────────────────────────────
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, requestingUserId))
      .limit(1);

    const isOwner = booking.userId === requestingUserId;
    const isAdmin = requestingUser?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return { success: false, error: 'Not authorized.', code: 'UNAUTHORIZED' };
    }

    // ── 3. State validation ─────────────────────────────────────────────────
    if (booking.status === 'cancelled') {
      return { success: false, error: 'Booking is already cancelled.', code: 'ALREADY_CANCELLED' };
    }

    // ── 4. Fetch class session ──────────────────────────────────────────────
    const [session] = await db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, booking.sessionId!))
      .limit(1);

    if (!session) {
      return { success: false, error: 'Session not found.', code: 'NOT_FOUND' };
    }

    // ── 5. Fetch student for mercy check ────────────────────────────────────
    const [student] = await db
      .select()
      .from(users)
      .where(eq(users.id, booking.userId))
      .limit(1);

    if (!student) {
      return { success: false, error: 'Student not found.', code: 'NOT_FOUND' };
    }

    // ── 6. Apply cancellation rule engine ───────────────────────────────────
    const now = new Date();
    const hoursUntilClass = differenceInHours(session.startsAt, now);
    const isWithinWindow = hoursUntilClass < CANCELLATION_WINDOW_HOURS;

    let refundIssued = false;
    let mercyApplied = false;
    let creditsRefunded = 0;

    if (!isWithinWindow) {
      refundIssued = true;
    } else if (!student.firstMercyUsed) {
      mercyApplied = true;
      refundIssued = true;
      logger.info('First-time mercy applied', { userId: student.id, bookingId, hoursUntilClass });
    }

    // ── 7. Atomic DB transaction ────────────────────────────────────────────
    try {
      const updatedBooking = await db.transaction(async (tx) => {
        // Re-read booking under lock — prevents double-refund if two cancel
        // requests race (e.g. user + admin simultaneously). Without this, both
        // could read 'confirmed' outside the tx and both issue a refund.
        const [locked] = await tx
          .select({ status: bookings.status })
          .from(bookings)
          .where(eq(bookings.id, bookingId))
          .for('update')
          .limit(1);

        if (locked?.status === 'cancelled') {
          throw new SessionCancellationError('Booking already cancelled.', 'ALREADY_CANCELLED');
        }

        const [result] = await tx
          .update(bookings)
          .set({
            status: 'cancelled',
            cancellationType: isAdmin ? 'admin_cancelled' : 'user_cancelled',
            mercyApplied,
            cancelledAt: now,
            cancellationReason: reason ?? null,
            updatedAt: now,
          })
          .where(eq(bookings.id, bookingId))
          .returning();

        await tx
          .update(classSessions)
          .set({ bookedCount: sql`${classSessions.bookedCount} - 1`, updatedAt: now })
          .where(eq(classSessions.id, session.id));

        if (mercyApplied) {
          await tx
            .update(users)
            .set({ firstMercyUsed: true, updatedAt: now })
            .where(eq(users.id, student.id));
        }

        if (refundIssued) {
          creditsRefunded = booking.creditsSpent;
          await creditService.refundInternal(tx, {
            userId: booking.userId,
            creditType: booking.creditType,
            amount: booking.creditsSpent,
            bookingId: booking.id,
            description: mercyApplied
              ? 'Refund: Late cancellation grace (first-time mercy)'
              : 'Refund: Cancellation within policy window',
          });
        }

        return result;
      });

      logger.info('Booking cancelled', { bookingId, refundIssued, mercyApplied, creditsRefunded });

      // ── 8. Fire-and-forget side effects (outside transaction) ─────────────
      Promise.resolve().then(async () => {
        try {
          const [tmpl] = await db
            .select({ name: classTemplates.name })
            .from(classTemplates)
            .where(eq(classTemplates.id, session.templateId!))
            .limit(1);
          const classDate = session.startsAt.toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          });
          const classTime = session.startsAt.toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit',
          });
          await sendBookingCancellationEmail(
            student.email!,
            student.name ?? 'there',
            tmpl?.name ?? 'your class',
            classDate,
            classTime,
            refundIssued,
          );
        } catch (err) {
          console.warn('[email] Cancellation email failed:', err);
        }
      }).catch(() => {});

      revalidatePath('/book');
      revalidatePath('/dashboard');

      // Fire-and-forget Google Calendar sync (refresh attendee list).
      (async () => {
        try {
          const { updateAttendeesInDescription } = await import(
            '@/modules/calendar/services/calendar-sync.service'
          );
          if (booking.sessionId) await updateAttendeesInDescription(booking.sessionId);
        } catch (err) {
          console.warn('[calendar] Cancel GCal sync failed:', err);
        }
      })();

      return {
        success: true,
        data: {
          booking: updatedBooking as Booking,
          refundIssued,
          mercyApplied,
          creditsRefunded,
          message: mercyApplied
            ? 'Booking cancelled. Your one-time grace has been applied and credits refunded.'
            : refundIssued
              ? 'Booking cancelled. Credits have been refunded.'
              : 'Booking cancelled. Credits could not be refunded due to late cancellation policy.',
        },
      };
    } catch (err) {
      if (err instanceof SessionCancellationError) {
        return { success: false, error: err.message, code: err.code };
      }
      logger.error('Cancellation transaction failed', { err, bookingId });
      return {
        success: false,
        error: 'An error occurred while cancelling your booking.',
        code: 'DB_ERROR',
      };
    }
  },

  /**
   * Instructor or admin cancels an entire class session.
   * ALL confirmed bookings are cancelled and fully refunded atomically.
   * All waitlist entries for the session are also cancelled.
   */
  async cancelSessionByInstructor(
    sessionId: string,
    cancelledByUserId: string,
    reason: string,
  ): Promise<ServiceResult<InstructorCancellationResult>> {
    try {
      const result = await db.transaction(async (tx) => {
        // Lock the session row first so no new bookings can be inserted or
        // status-flipped while we cancel. The createBooking action also takes
        // FOR UPDATE on this row, so the two paths serialize cleanly.
        const [session] = await tx
          .select()
          .from(classSessions)
          .where(eq(classSessions.id, sessionId))
          .for('update')
          .limit(1);

        if (!session) {
          throw new SessionCancellationError('Session not found.', 'NOT_FOUND');
        }
        if (session.status === 'cancelled') {
          throw new SessionCancellationError('Session already cancelled.', 'ALREADY_CANCELLED');
        }

        // Fetch confirmed bookings INSIDE the locked tx — anything that raced
        // ahead of us is now visible and gets refunded along with the rest.
        const confirmedBookings = await tx
          .select()
          .from(bookings)
          .where(and(eq(bookings.sessionId, sessionId), eq(bookings.status, 'confirmed')));

        await tx
          .update(classSessions)
          .set({
            status: 'cancelled',
            cancellationReason: reason,
            cancelledAt: new Date(),
            cancelledBy: cancelledByUserId,
            updatedAt: new Date(),
          })
          .where(eq(classSessions.id, sessionId));

        const affectedUserIds: string[] = [];
        let totalCreditsRefunded = 0;

        for (const booking of confirmedBookings) {
          await tx
            .update(bookings)
            .set({
              status: 'cancelled',
              cancellationType: 'instructor_cancelled',
              cancelledAt: new Date(),
              cancellationReason: `Class cancelled by instructor: ${reason}`,
              updatedAt: new Date(),
            })
            .where(eq(bookings.id, booking.id));

          await creditService.refundInternal(tx, {
            userId: booking.userId,
            creditType: booking.creditType,
            amount: booking.creditsSpent,
            bookingId: booking.id,
            description: `Refund: Class cancelled by instructor — "${reason}"`,
          });

          affectedUserIds.push(booking.userId);
          totalCreditsRefunded += booking.creditsSpent;
        }

        // Always cancel all waitlist entries for the session
        await tx
          .update(waitlistEntries)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(eq(waitlistEntries.sessionId, sessionId));

        return {
          totalBookingsCancelled: confirmedBookings.length,
          totalCreditsRefunded,
          affectedUserIds,
        };
      });

      logger.info('Session cancelled by instructor', {
        sessionId,
        cancelledByUserId,
        totalBookingsCancelled: result.totalBookingsCancelled,
        totalCreditsRefunded: result.totalCreditsRefunded,
      });

      // Fire-and-forget emails to all affected students
      Promise.resolve().then(async () => {
        try {
          if (result.affectedUserIds.length === 0) return;
          const [sessionRow, affectedUsers] = await Promise.all([
            db.select({ startsAt: classSessions.startsAt, title: classTemplates.name })
              .from(classSessions)
              .innerJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
              .where(eq(classSessions.id, sessionId))
              .limit(1)
              .then((rows) => rows[0]),
            db.select({ id: users.id, email: users.email, name: users.name })
              .from(users)
              .where(inArray(users.id, result.affectedUserIds)),
          ]);
          if (!sessionRow) return;
          const classDate = sessionRow.startsAt.toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          });
          const classTime = sessionRow.startsAt.toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit',
          });
          await Promise.allSettled(
            affectedUsers
              .filter((u) => u.email)
              .map((u) =>
                sendClassCancelledByAdminEmail(
                  u.email!,
                  u.name ?? 'there',
                  sessionRow.title,
                  classDate,
                  classTime,
                  reason,
                ),
              ),
          );
        } catch (err) {
          console.warn('[email] Class cancellation emails failed:', err);
        }
      }).catch(() => {});

      revalidatePath('/book');
      revalidatePath('/admin/classes');

      // Fire-and-forget Google Calendar — delete the event since the class is cancelled.
      (async () => {
        try {
          const { deleteEvent } = await import(
            '@/modules/calendar/services/calendar-sync.service'
          );
          await deleteEvent(sessionId);
        } catch (err) {
          console.warn('[calendar] Session cancellation GCal delete failed:', err);
        }
      })();

      return {
        success: true,
        data: {
          sessionId,
          totalBookingsCancelled: result.totalBookingsCancelled,
          totalCreditsRefunded: result.totalCreditsRefunded,
          affectedUserIds: result.affectedUserIds,
        },
      };
    } catch (err) {
      if (err instanceof SessionCancellationError) {
        return { success: false, error: err.message, code: err.code };
      }
      logger.error('Session cancellation transaction failed', { err, sessionId });
      return { success: false, error: 'Failed to cancel session.', code: 'DB_ERROR' };
    }
  },

  /**
   * Read-only check: would a cancellation be penalty-free right now?
   * Use this to drive UI state (e.g. show "free cancellation" badge).
   */
  async checkCancellationPolicy(bookingId: string): Promise<{
    isWithinWindow: boolean;
    hoursRemaining: number;
    mercyAvailable: boolean;
    wouldReceiveRefund: boolean;
  }> {
    const [row] = await db
      .select({ booking: bookings, user: users, session: classSessions })
      .from(bookings)
      .innerJoin(users, eq(bookings.userId, users.id))
      .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!row) throw new Error('Booking not found');

    const hoursRemaining = differenceInHours(row.session.startsAt, new Date());
    const isWithinWindow = hoursRemaining < CANCELLATION_WINDOW_HOURS;
    const mercyAvailable = !row.user.firstMercyUsed;

    return {
      isWithinWindow,
      hoursRemaining,
      mercyAvailable,
      wouldReceiveRefund: !isWithinWindow || mercyAvailable,
    };
  },
};
