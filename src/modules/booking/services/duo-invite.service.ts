import crypto from 'crypto';
import { db } from '@/db';
import { duoInvites, bookings, classSessions, classTemplates, users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { lotService } from '@/modules/billing/services/lot.service';
import {
  DUO_INVITE_CUTOFF_HOURS_BEFORE_CLASS,
  DUO_INVITE_MAX_LIFETIME_HOURS,
} from '@/lib/config/duo-invite';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvitePageData {
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expiresAt: Date;
  organizerFirstName: string;
  /** Server-side only — for self-invite check. Never render in UI (DSGVO). */
  organizerUserId: string;
  sessionId: string;
  sessionName: string;
  startsAt: Date;
  durationMinutes: number;
  location: string | null;
  creditType: string;
  creditCost: number;
}

export interface EligibilityResult {
  hasCredits: boolean;
  balance: number;
  isAlreadyBooked: boolean;
  isSelf: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeExpiry(sessionStartsAt: Date): Date {
  const cutoffMs = DUO_INVITE_CUTOFF_HOURS_BEFORE_CLASS * 60 * 60 * 1000;
  const maxLifetimeMs = DUO_INVITE_MAX_LIFETIME_HOURS * 60 * 60 * 1000;
  const cutoffBeforeClass = new Date(sessionStartsAt.getTime() - cutoffMs);
  const maxLifetimeFromNow = new Date(Date.now() + maxLifetimeMs);
  return new Date(Math.min(cutoffBeforeClass.getTime(), maxLifetimeFromNow.getTime()));
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const duoInviteService = {
  async create(
    organizerBookingId: string,
    organizerUserId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const [booking] = await db
      .select({ sessionId: bookings.sessionId })
      .from(bookings)
      .where(eq(bookings.id, organizerBookingId))
      .limit(1);

    if (!booking?.sessionId) throw new Error('Booking not found');

    const [session] = await db
      .select({ startsAt: classSessions.startsAt })
      .from(classSessions)
      .where(eq(classSessions.id, booking.sessionId))
      .limit(1);

    if (!session) throw new Error('Session not found');

    const expiresAt = computeExpiry(session.startsAt);
    const token = crypto.randomBytes(32).toString('hex');

    await db.insert(duoInvites).values({
      organizerBookingId,
      organizerUserId,
      sessionId: booking.sessionId,
      token,
      expiresAt,
    });

    return { token, expiresAt };
  },

  async getByToken(token: string) {
    const [invite] = await db
      .select()
      .from(duoInvites)
      .where(eq(duoInvites.token, token))
      .limit(1);
    return invite ?? null;
  },

  async getInvitePageData(token: string): Promise<InvitePageData | null> {
    const [row] = await db
      .select({
        status: duoInvites.status,
        expiresAt: duoInvites.expiresAt,
        organizerName: users.name,
        organizerUserId: duoInvites.organizerUserId,
        sessionId: classSessions.id,
        sessionName: classTemplates.name,
        startsAt: classSessions.startsAt,
        durationMinutes: classTemplates.durationMinutes,
        location: classTemplates.location,
        creditType: classTemplates.creditType,
        creditCost: classTemplates.creditCost,
      })
      .from(duoInvites)
      .innerJoin(classSessions, eq(duoInvites.sessionId, classSessions.id))
      .innerJoin(classTemplates, eq(classSessions.templateId, classTemplates.id))
      .innerJoin(
        users,
        and(eq(duoInvites.organizerUserId, users.id), isNull(users.deletedAt)),
      )
      .where(eq(duoInvites.token, token))
      .limit(1);

    if (!row) return null;

    // DSGVO: only first name, never full name, email, or photo
    const firstName = (row.organizerName ?? 'Someone').split(' ')[0];

    return {
      status: row.status,
      expiresAt: row.expiresAt,
      organizerFirstName: firstName,
      organizerUserId: row.organizerUserId,
      sessionId: row.sessionId,
      sessionName: row.sessionName,
      startsAt: row.startsAt,
      durationMinutes: row.durationMinutes,
      location: row.location,
      creditType: row.creditType,
      creditCost: row.creditCost,
    };
  },

  async checkPartnerEligibility(
    userId: string,
    sessionId: string,
    organizerUserId: string,
    creditType: string,
    creditCost: number,
  ): Promise<EligibilityResult> {
    const isSelf = userId === organizerUserId;

    // FIFO-aware availability check: sum of remaining_amount across all
    // active, unexpired lots for this user + credit type. Matches what the
    // debit path actually consumes.
    const hasCredits = await lotService.hasSufficientCredits(
      userId,
      creditType as 'pass' | 'session',
      creditCost,
    );

    // For the UI: total credits the partner currently has available.
    // Sum across active lots — same source of truth as hasCredits.
    const lotEntries = await lotService.getLotBreakdown(
      userId,
      creditType as 'pass' | 'session',
    );
    const totalAvailable = lotEntries.reduce((sum, lot) => sum + lot.remainingAmount, 0);

    const [existing] = await db
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

    return {
      hasCredits,
      balance: totalAvailable,
      isAlreadyBooked: !!existing,
      isSelf,
    };
  },
};
