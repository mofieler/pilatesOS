'use server';

import { z } from 'zod';
import { db } from '@/db';
import { users, waivers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { resolveClientIP } from '@/lib/security/client-ip';
import { WAIVER_VERSION } from '@/constants/BOOKING_RULES';

const signWaiverSchema = z.object({
  acknowledged: z.boolean().refine((val) => val === true, {
    message: 'You must acknowledge the waiver to continue',
  }),
  signedName: z
    .string()
    .min(2, 'Please type your full legal name')
    .max(255),
});

export type SignWaiverInput = z.infer<typeof signWaiverSchema>;

/**
 * Sign the liability waiver.
 *
 * Persists an immutable row in the `waivers` table with the typed name, the
 * version of the waiver text being signed, the timestamp, and the request's
 * IP and user agent. Also flips users.hasSignedWaiver for fast lookups by
 * the booking action's gate.
 *
 * Both writes happen in a single transaction so the flag and the audit row
 * cannot diverge.
 */
export async function signWaiverAction(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'You must be signed in to sign the waiver',
        code: 'UNAUTHORIZED',
      };
    }

    const validated = signWaiverSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message ?? 'Invalid input',
        code: 'INVALID_STATE',
      };
    }

    const headersList = await headers();
    const resolvedIp = resolveClientIP(headersList);
    const userAgent = headersList.get('user-agent');

    await db.transaction(async (tx) => {
      await tx.insert(waivers).values({
        userId: session.user.id,
        waiverVersion: WAIVER_VERSION,
        signedName: validated.data.signedName,
        ipAddress: resolvedIp === 'untrusted' ? null : resolvedIp,
        userAgent: userAgent ?? null,
      });

      await tx
        .update(users)
        .set({ hasSignedWaiver: true, updatedAt: new Date() })
        .where(eq(users.id, session.user.id));
    });

    revalidatePath('/dashboard');
    revalidatePath('/book');
    revalidatePath('/waiver');

    return {
      success: true,
      message: 'Waiver signed successfully',
    };
  } catch (error) {
    console.error('Sign waiver error:', error);
    return {
      success: false,
      error: 'Failed to sign waiver. Please try again.',
      code: 'DB_ERROR',
    };
  }
}

/**
 * Check if current user has signed the waiver.
 */
export async function checkWaiverStatusAction() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      };
    }

    const [user] = await db
      .select({ hasSignedWaiver: users.hasSignedWaiver })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    return {
      success: true,
      hasSignedWaiver: user?.hasSignedWaiver ?? false,
    };
  } catch (error) {
    console.error('Check waiver status error:', error);
    return {
      success: false,
      error: 'Failed to check waiver status',
      code: 'DB_ERROR',
    };
  }
}
