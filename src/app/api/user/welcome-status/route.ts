import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [user] = await db
      .select({ welcomeCompletedAt: users.welcomeCompletedAt })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    return NextResponse.json({
      welcomeCompletedAt: user?.welcomeCompletedAt ?? null,
      welcomed: user?.welcomeCompletedAt != null,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to load welcome status' },
      { status: 500 },
    );
  }
}
