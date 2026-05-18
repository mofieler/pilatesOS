import { db } from '@/db';
import { bookings, users, classSessions, classTemplates, waitlistEntries, instructors, cancellationMercyUses, duoInvites } from '@/db/schema';
import type { Booking } from '@/db/schema';
import { eq, and, inArray, isNull, or, sql } from 'drizzle-orm';
import { sendBookingCancellationEmail, sendClassCancelledByAdminEmail, sendInstructorCancellationNotificationEmail } from '@/lib/email/resend';
import { differenceInHours, addHours } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { creditService } from '@/modules/billing/services/credit.service';
import type { ServiceResult, ServiceErrorCode } from '@/modules/billing/services/credit.service';
import { CANCELLATION_WINDOW_HOURS, MERCY_USES_PER_MONTH } from '@/constants/BOOKING_RULES';

// Transaction client type for composing mercy checks inside other transactions
type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Per-calendar-month mercy-use count. Resets on the 1st of each month (server tz).
// The query is small and uses (user_id, used_at) index for sub-ms execution.
async function countMercyUsesThisMonth(
  client: TxClient | typeof db,
  userId: string,
): Promise<number> {
  const [row] = await client
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(cancellationMercyUses)
    .where(
      and(
        eq(cancellationMercyUses.userId, userId),
        sql`date_trunc('month', ${cancellationMercyUses.usedAt}) = date_trunc('month', NOW())`,
      ),
    );
  return row?.count ?? 0;
}

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
  // Remaining mercy uses for the canceller this calendar month AFTER this cancel.
  // Equals MERCY_USES_PER_MONTH when no mercy was used (≥24h cancel).
  mercyUsesLeftAfter: number;
  mercyUsesLimit: number;
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
      .where(and(eq(users.id, requestingUserId), isNull(users.deletedAt)))
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

    // Block cancellation of classes that have already started or passed.
    if (session.startsAt <= now) {
      return { success: false, error: 'This class has already started or passed and cannot be cancelled.', code: 'INVALID_STATE' };
    }
    const hoursUntilClass = differenceInHours(session.startsAt, now);
    const isWithinWindow = hoursUntilClass < CANCELLATION_WINDOW_HOURS;

    // Grace window: if the class was rescheduled AFTER this student booked,
    // they get CANCELLATION_WINDOW_HOURS from the reschedule announcement to cancel
    // for free — even if the class is less than 24 hours away. The grace is
    // ALWAYS bounded by class start: once the class begins, no cancellation is
    // possible (also enforced by the early return above on session.startsAt).
    const rescheduledGraceFree =
      session.rescheduledAt !== null &&
      session.rescheduledAt > booking.bookedAt &&
      now < addHours(session.rescheduledAt, CANCELLATION_WINDOW_HOURS) &&
      now < session.startsAt;

    let refundIssued = false;
    let mercyApplied = false;
    let creditsRefunded = 0;
    let mercyUsesLeftAfter = MERCY_USES_PER_MONTH;

    if (rescheduledGraceFree) {
      refundIssued = true;
      logger.info('Reschedule grace cancellation applied', { userId: student.id, bookingId, rescheduledAt: session.rescheduledAt });
    } else if (!isWithinWindow) {
      refundIssued = true;
    }
    // Inside-24h decisions (mercy or loss) happen INSIDE the transaction so the
    // count + insert are race-safe under concurrent cancels by the same user.

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

        // If late cancellation (not refundIssued yet), evaluate mercy now.
        // Lock the user row so two parallel late-cancels by the same user
        // serialize and only the right number of mercy slots get consumed.
        if (isWithinWindow && !rescheduledGraceFree) {
          await tx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, booking.userId))
            .for('update')
            .limit(1);

          const usedThisMonth = await countMercyUsesThisMonth(tx, booking.userId);

          if (usedThisMonth < MERCY_USES_PER_MONTH) {
            mercyApplied = true;
            refundIssued = true;
            mercyUsesLeftAfter = MERCY_USES_PER_MONTH - usedThisMonth - 1;
            await tx.insert(cancellationMercyUses).values({
              userId: booking.userId,
              bookingId: booking.id,
            });
            logger.info('Monthly mercy applied', {
              userId: student.id, bookingId, hoursUntilClass,
              usedThisMonth, mercyUsesLeftAfter,
            });
          } else {
            mercyUsesLeftAfter = 0;
            logger.info('Mercy quota exhausted — credits forfeited', {
              userId: student.id, bookingId, hoursUntilClass,
              limit: MERCY_USES_PER_MONTH,
            });
          }
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

        if (refundIssued) {
          creditsRefunded = booking.creditsSpent;
          await creditService.refundInternal(tx, {
            userId: booking.userId,
            creditType: booking.creditType,
            amount: booking.creditsSpent,
            bookingId: booking.id,
            description: mercyApplied
              ? `Refund: Late cancellation mercy (${mercyUsesLeftAfter}/${MERCY_USES_PER_MONTH} left this month)`
              : 'Refund: Cancellation within policy window',
          });
        }

        // ── Duo symmetric cancellation ──────────────────────────────────────
        // If this booking is part of an accepted duo, the partner's booking
        // must be cancelled with the SAME refund outcome (fairness). The
        // canceller's mercy is consumed once; the partner is not charged
        // a separate mercy slot.
        const [duo] = await tx
          .select()
          .from(duoInvites)
          .where(
            and(
              eq(duoInvites.status, 'accepted'),
              or(
                eq(duoInvites.organizerBookingId, booking.id),
                eq(duoInvites.partnerBookingId, booking.id),
              ),
            ),
          )
          .for('update')
          .limit(1);

        if (duo) {
          const partnerBookingId =
            duo.organizerBookingId === booking.id
              ? duo.partnerBookingId
              : duo.organizerBookingId;

          if (partnerBookingId) {
            const [partnerBooking] = await tx
              .select()
              .from(bookings)
              .where(eq(bookings.id, partnerBookingId))
              .for('update')
              .limit(1);

            // Skip if partner booking was already cancelled (idempotent)
            if (partnerBooking && partnerBooking.status !== 'cancelled') {
              await tx
                .update(bookings)
                .set({
                  status: 'cancelled',
                  cancellationType: isAdmin ? 'admin_cancelled' : 'user_cancelled',
                  mercyApplied: false, // partner does not consume their own mercy
                  cancelledAt: now,
                  cancellationReason: `Duo partner cancelled: ${reason ?? 'no reason given'}`,
                  updatedAt: now,
                })
                .where(eq(bookings.id, partnerBookingId));

              await tx
                .update(classSessions)
                .set({ bookedCount: sql`${classSessions.bookedCount} - 1`, updatedAt: now })
                .where(eq(classSessions.id, partnerBooking.sessionId!));

              // Same outcome for the partner: refund if the canceller got a
              // refund, otherwise let the credits forfeit too. Mercy is not
              // re-evaluated for the partner.
              if (refundIssued) {
                await creditService.refundInternal(tx, {
                  userId: partnerBooking.userId,
                  creditType: partnerBooking.creditType,
                  amount: partnerBooking.creditsSpent,
                  bookingId: partnerBooking.id,
                  description: 'Refund: Duo partner cancelled the shared session',
                });
              }

              // Mark the invite as cancelled so it can't be re-confirmed
              await tx
                .update(duoInvites)
                .set({ status: 'cancelled', updatedAt: now })
                .where(eq(duoInvites.id, duo.id));

              logger.info('Duo partner booking cancelled symmetrically', {
                cancellerBookingId: booking.id,
                partnerBookingId,
                refundIssued,
              });
            }
          }
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
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Berlin',
          });
          const classTime = session.startsAt.toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin',
          });

          // Student cancellation confirmation
          await sendBookingCancellationEmail(
            student.email!,
            student.name ?? 'there',
            tmpl?.name ?? 'your class',
            classDate,
            classTime,
            refundIssued,
          );

          // Instructor notification — always sent regardless of refund outcome
          if (session.instructorId) {
            const [instructorRow] = await db
              .select({ email: users.email, name: users.name })
              .from(instructors)
              .innerJoin(users, and(eq(instructors.userId, users.id), isNull(users.deletedAt)))
              .where(eq(instructors.id, session.instructorId))
              .limit(1);

            if (instructorRow?.email) {
              await sendInstructorCancellationNotificationEmail(
                instructorRow.email,
                instructorRow.name ?? 'Instructor',
                student.name ?? 'A student',
                tmpl?.name ?? 'the class',
                classDate,
                classTime,
                refundIssued,
              );
            }
          }
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
          mercyUsesLeftAfter,
          mercyUsesLimit: MERCY_USES_PER_MONTH,
          message: rescheduledGraceFree
            ? 'Booking cancelled. Full refund issued — the class was rescheduled after you booked.'
            : mercyApplied
              ? `Booking cancelled. Late-cancellation mercy applied — credits refunded. ${mercyUsesLeftAfter} of ${MERCY_USES_PER_MONTH} mercy uses left this month.`
              : refundIssued
                ? 'Booking cancelled. Credits have been refunded.'
                : `Booking cancelled. Credits forfeited — no mercy uses left this month (limit ${MERCY_USES_PER_MONTH}).`,
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
              .where(and(inArray(users.id, result.affectedUserIds), isNull(users.deletedAt))),
          ]);
          if (!sessionRow) return;
          const classDate = sessionRow.startsAt.toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Berlin',
          });
          const classTime = sessionRow.startsAt.toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin',
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
   * Use this to drive UI state (e.g. show "free cancellation" badge,
   * mercy-uses-left counter, "last mercy" warning).
   */
  async checkCancellationPolicy(bookingId: string): Promise<{
    isWithinWindow: boolean;
    hoursRemaining: number;
    mercyUsesLeft: number;
    mercyUsesLimit: number;
    isLastMercy: boolean;
    wouldReceiveRefund: boolean;
  }> {
    const [row] = await db
      .select({ booking: bookings, session: classSessions })
      .from(bookings)
      .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!row) throw new Error('Booking not found');

    const hoursRemaining = differenceInHours(row.session.startsAt, new Date());
    const isWithinWindow = hoursRemaining < CANCELLATION_WINDOW_HOURS;
    const usedThisMonth = await countMercyUsesThisMonth(db, row.booking.userId);
    const mercyUsesLeft = Math.max(0, MERCY_USES_PER_MONTH - usedThisMonth);
    const isLastMercy = isWithinWindow && mercyUsesLeft === 1;

    return {
      isWithinWindow,
      hoursRemaining,
      mercyUsesLeft,
      mercyUsesLimit: MERCY_USES_PER_MONTH,
      isLastMercy,
      wouldReceiveRefund: !isWithinWindow || mercyUsesLeft > 0,
    };
  },

  /**
   * Read-only: current mercy quota status for a user (regardless of any
   * specific booking). Used by the dashboard and policy banner pre-fetch.
   */
  async getMercyContext(userId: string): Promise<{
    mercyUsesLeft: number;
    mercyUsesLimit: number;
    usedThisMonth: number;
  }> {
    const usedThisMonth = await countMercyUsesThisMonth(db, userId);
    return {
      mercyUsesLeft: Math.max(0, MERCY_USES_PER_MONTH - usedThisMonth),
      mercyUsesLimit: MERCY_USES_PER_MONTH,
      usedThisMonth,
    };
  },
};
