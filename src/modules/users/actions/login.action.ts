'use server';

import { z } from 'zod';
import { signIn } from '@/lib/auth/auth';
import { AuthError } from 'next-auth';
import { headers } from 'next/headers';
import { checkRateLimit, authRateLimitConfig } from '@/lib/security/server-action-rate-limiter';
import { resolveClientIP } from '@/lib/security/client-ip';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export async function loginAction(input: unknown) {
  try {
    // Check rate limit before processing (per-IP, not global)
    const headersList = await headers();
    const ip = resolveClientIP(headersList);
    const rateLimitResult = await checkRateLimit(authRateLimitConfig, `login:${ip}`);
    if (!rateLimitResult.success) {
      return {
        success: false,
        error: 'Too many login attempts. Please try again in 15 minutes.',
        code: 'RATE_LIMITED',
      };
    }

    const validated = loginSchema.parse(input);

    const result = await signIn('credentials', {
      email: validated.email,
      password: validated.password,
      redirect: false,
    });

    if (!result?.ok) {
      return {
        success: false,
        error: 'Invalid email or password',
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      if (firstError) {
        return {
          success: false,
          error: firstError.message,
        };
      }
    }

    if (error instanceof AuthError) {
      return {
        success: false,
        error: 'Authentication failed',
      };
    }

    return {
      success: false,
      error: 'An error occurred during login',
    };
  }
}
