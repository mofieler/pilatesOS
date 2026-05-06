'use server';

import { db } from '@/db';
import { users } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';

/**
 * Check if the current session user still has their one-time "mercy" available.
 * userId is derived from the session — never accepted from the caller.
 */
export async function getMercyAvailable(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;

  const [row] = await db
    .select({ firstMercyUsed: users.firstMercyUsed })
    .from(users)
    .where(and(eq(users.id, session.user.id), isNull(users.deletedAt)));

  return !row?.firstMercyUsed;
}
