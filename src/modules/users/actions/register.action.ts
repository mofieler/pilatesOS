'use server';

import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { checkRateLimit, registerRateLimitConfig } from '@/lib/security/server-action-rate-limiter';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(255),
  confirmPassword: z.string(),
}).refine((data: { password: string; confirmPassword: string }) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type RegisterInput = z.infer<typeof registerSchema>;

export async function registerAction(input: unknown) {
  try {
    // Check rate limit before processing
    const rateLimitResult = await checkRateLimit(registerRateLimitConfig, 'register');
    if (!rateLimitResult.success) {
      return {
        success: false,
        error: 'Too many registration attempts. Please try again in 15 minutes.',
        code: 'RATE_LIMITED',
      };
    }

    const validated = registerSchema.parse(input);

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, validated.email))
      .limit(1)
      .then((rows) => rows[0]);

    if (existingUser) {
      return {
        success: false,
        error: 'Email already registered',
      };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validated.password, 12);

    // Create user
    const newUser = await db
      .insert(users)
      .values({
        email: validated.email,
        name: validated.name,
        passwordHash,
        role: 'student',
      })
      .returning({ id: users.id, email: users.email, name: users.name });

    return {
      success: true,
      user: newUser[0],
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

    return {
      success: false,
      error: 'An error occurred during registration',
    };
  }
}
