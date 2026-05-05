'use server';

import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { revalidatePath } from 'next/cache';

const signWaiverSchema = z.object({
  acknowledged: z.boolean().refine((val) => val === true, {
    message: 'You must acknowledge the waiver to continue',
  }),
});

export type SignWaiverInput = z.infer<typeof signWaiverSchema>;

/**
 * Sign the liability waiver
 * MVP: Simple flag update. Phase 2: Store IP, timestamp, version in waivers table.
 */
export async function signWaiverAction(input: unknown) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'You must be signed in to sign the waiver',
        code: 'UNAUTHORIZED',
      };
    }

    // Validate input
    const validated = signWaiverSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Please acknowledge the waiver to continue',
        code: 'INVALID_STATE',
      };
    }

    // Update user record
    await db
      .update(users)
      .set({
        hasSignedWaiver: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    // Revalidate paths to update UI
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
 * Check if current user has signed the waiver
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
