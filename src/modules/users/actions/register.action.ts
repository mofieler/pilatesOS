'use server';

import { z } from 'zod';
import { db } from '@/db';
import { users, verificationTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { headers } from 'next/headers';
import { checkRateLimit, registerRateLimitConfig } from '@/lib/security/server-action-rate-limiter';
import { resolveClientIP } from '@/lib/security/client-ip';
import { verifyTurnstileToken } from '@/lib/security/turnstile';
import { sendVerificationEmail } from '@/lib/email/resend';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(255),
  confirmPassword: z.string(),
  turnstileToken: z.string().nullable().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type RegisterInput = z.infer<typeof registerSchema>;

export async function registerAction(input: unknown) {
  try {
    const rateLimitResult = await checkRateLimit(registerRateLimitConfig, 'register');
    if (!rateLimitResult.success) {
      return {
        success: false,
        error: 'Too many registration attempts. Please try again in 15 minutes.',
        code: 'RATE_LIMITED',
      };
    }

    const validated = registerSchema.parse(input);

    // Captcha verification BEFORE we hash a password (which is expensive) or
    // touch the DB. If TURNSTILE_SECRET_KEY is unset (dev) the helper
    // short-circuits to success.
    const headersList = await headers();
    const remoteIp = resolveClientIP(headersList);
    const captcha = await verifyTurnstileToken(
      validated.turnstileToken,
      remoteIp === 'untrusted' ? undefined : remoteIp,
    );
    if (!captcha.success) {
      return { success: false, error: captcha.error, code: 'CAPTCHA_FAILED' };
    }

    const existingUser = await db
      .select({ id: users.id, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.email, validated.email))
      .limit(1)
      .then((rows) => rows[0]);

    if (existingUser) {
      // Don't reveal whether the account exists — same message either way
      return { success: false, error: 'Email already registered' };
    }

    const passwordHash = await bcrypt.hash(validated.password, 12);

    // Create user with emailVerified = null (requires email verification)
    await db.insert(users).values({
      email: validated.email,
      name: validated.name,
      passwordHash,
      role: 'student',
      emailVerified: null,
    });

    // Generate secure verification token (valid 24 h)
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.insert(verificationTokens).values({
      identifier: validated.email,
      token,
      expires,
    });

    // Send verification email (fire and forget — don't fail registration on email error)
    sendVerificationEmail(validated.email, validated.name, token).catch((err) =>
      console.error('[REGISTER] Failed to send verification email:', err),
    );

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      if (firstError) return { success: false, error: firstError.message };
    }
    console.error('[REGISTER] Error:', error);
    return { success: false, error: 'An error occurred during registration' };
  }
}
