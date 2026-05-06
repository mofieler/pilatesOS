'use server';

import { db } from '@/db';
import { users, verificationTokens } from '@/db/schema';
import { eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '@/lib/email/resend';

const schema = z.object({ email: z.string().email('Invalid email') });

export async function forgotPasswordAction(formData: { email: string }) {
  const validated = schema.safeParse(formData);
  if (!validated.success) {
    return { success: true };
  }

  try {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, validated.data.email))
      .where(isNull(users.deletedAt))
      .limit(1)
      .then((r) => r[0]);

    // Only send if user exists and has password hash (not Google-only)
    if (user?.passwordHash) {
      // Delete existing reset tokens for this email to avoid accumulation
      await db
        .delete(verificationTokens)
        .where(eq(verificationTokens.identifier, user.email));

      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.insert(verificationTokens).values({
        identifier: user.email,
        token,
        expires,
      });

      // Fire-and-forget email send
      sendPasswordResetEmail(user.email, user.name, token).catch(() => {});
    }

    // Always return success to prevent email enumeration
    return { success: true };
  } catch {
    return { success: true };
  }
}
