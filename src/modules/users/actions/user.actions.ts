'use server';

import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Check if user still has their one-time "mercy" available.
 * This allows one free late cancellation without penalty.
 */
export async function getMercyAvailable(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ firstMercyUsed: users.firstMercyUsed })
    .from(users)
    .where(eq(users.id, userId));

  return !row?.firstMercyUsed;
}

/**
 * Mark the user's one-time mercy as used.
 * Called when they cancel a class and the mercy is applied.
 */
export async function useMercy(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ firstMercyUsed: true })
    .where(eq(users.id, userId));
}

/**
 * Get user profile details.
 */
export async function getUserProfile(userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId));

  return row ?? null;
}
