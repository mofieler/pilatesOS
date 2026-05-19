'use server';

import { z } from 'zod';
import { db } from '@/db';
import { duoInvites, bookings, classSessions, classTemplates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { creditService, InsufficientCreditsError } from '@/modules/billing/services/credit.service';
import { revalidatePath } from 'next/cache';
import { hasCompletedWelcome } from '@/lib/welcome';

const schema = z.object({
  token: z.string().min(1).max(64),
});

export async function acceptDuoInviteAction(
  input: z.infer<typeof schema>,
): Promise<{ success: boolean; error?: string; code?: string }> {
  const authSession = await auth();
  if (!authSession?.user?.id) return { success: false, error: 'Please sign in to accept this invite', code: 'UNAUTHORIZED' };
  const userId = authSession.user.id;

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid token', code: 'INVALID_INPUT' };
  const { token } = parsed.data;

  try {
    await db.transaction(async (tx) => {
      // Fetch and lock the invite
      const [invite] = await tx
        .select()
        .from(duoInvites)
        .where(eq(duoInvites.token, token))
        .for('update')
        .limit(1);

      if (!invite) throw new DuoError('Invite not found', 'NOT_FOUND');
      if (invite.status !== 'pending') throw new DuoError('This invite is no longer available', 'INVALID_STATE');
      if (invite.expiresAt <= new Date()) throw new DuoError('This invite has expired', 'EXPIRED');
      if (invite.organizerUserId === userId) throw new DuoError('You cannot accept your own invite', 'SELF_INVITE');

      // Fetch and lock session
      const [session] = await tx
        .select()
        .from(classSessions)
        .where(eq(classSessions.id, invite.sessionId))
        .for('update')
        .limit(1);

      if (!session) throw new DuoError('Session not found', 'NOT_FOUND');
      if (session.status !== 'scheduled') throw new DuoError('This class is no longer available', 'INVALID_STATE');
      if (session.startsAt <= new Date()) throw new DuoError('This class has already started', 'INVALID_STATE');
      if (session.bookedCount >= session.maxCapacity) throw new DuoError('This class is full', 'CLASS_FULL');

      // Get template for credit type/cost
      if (!session.templateId) throw new DuoError('Class configuration not found', 'NOT_FOUND');

      // Welcome Journey gate
      const welcomed = await hasCompletedWelcome(userId, tx);
      if (!welcomed) {
        const [templateCheck] = await tx
          .select({ isWelcomeJourney: classTemplates.isWelcomeJourney })
          .from(classTemplates)
          .where(eq(classTemplates.id, session.templateId))
          .limit(1);
        if (!templateCheck?.isWelcomeJourney) {
          throw new DuoError('Please complete your Welcome Journey first.', 'WELCOME_REQUIRED');
        }
      }

      // Check not already booked
      const [existing] = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(eq(bookings.userId, userId), eq(bookings.sessionId, invite.sessionId), eq(bookings.status, 'confirmed')))
        .limit(1);

      if (existing) throw new DuoError('You are already booked for this class', 'BOOKING_ALREADY_EXISTS');

      const [template] = await tx
        .select({ creditType: classTemplates.creditType, creditCost: classTemplates.creditCost })
        .from(classTemplates)
        .where(eq(classTemplates.id, session.templateId))
        .limit(1);

      if (!template) throw new DuoError('Class configuration not found', 'NOT_FOUND');

      // Insert partner booking
      const [partnerBooking] = await tx
        .insert(bookings)
        .values({
          userId,
          sessionId: invite.sessionId,
          status: 'confirmed',
          creditsSpent: template.creditCost,
          creditType: template.creditType,
        })
        .returning();

      // Debit credits — throws InsufficientCreditsError if balance too low
      await creditService.debitInternal(tx, {
        userId,
        creditType: template.creditType,
        amount: template.creditCost,
        bookingId: partnerBooking.id,
        description: `Duo booking: session ${invite.sessionId}`,
      });

      // Increment booked count
      await tx
        .update(classSessions)
        .set({ bookedCount: session.bookedCount + 1, updatedAt: new Date() })
        .where(eq(classSessions.id, invite.sessionId));

      // Mark invite as accepted (immutable audit — only status/partner fields change)
      await tx
        .update(duoInvites)
        .set({ status: 'accepted', partnerBookingId: partnerBooking.id, partnerUserId: userId, updatedAt: new Date() })
        .where(eq(duoInvites.id, invite.id));
    });

    revalidatePath('/book');
    revalidatePath('/dashboard');
    revalidatePath(`/invite/${token}`);

    return { success: true };
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return { success: false, error: 'You don\'t have enough credits to join this class', code: 'INSUFFICIENT_CREDITS' };
    }
    if (err instanceof DuoError) {
      return { success: false, error: err.message, code: err.code };
    }
    return { success: false, error: 'Something went wrong. Please try again.', code: 'DB_ERROR' };
  }
}

class DuoError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'DuoError';
  }
}
