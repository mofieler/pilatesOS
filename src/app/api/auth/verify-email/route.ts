import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, verificationTokens } from '@/db/schema';
import { and, eq, gt } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get('token');
  const identifier = searchParams.get('identifier');

  const invalid = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));

  if (!token || !identifier) return invalid('invalid_token');

  const tokenRecord = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, identifier),
        eq(verificationTokens.token, token),
        gt(verificationTokens.expires, new Date()),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!tokenRecord) return invalid('expired_token');

  // Mark email verified and delete the used token atomically
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ emailVerified: new Date(), updatedAt: new Date() })
      .where(eq(users.email, identifier));

    await tx
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, identifier),
          eq(verificationTokens.token, token),
        ),
      );
  });

  return NextResponse.redirect(new URL('/login?verified=true', request.url));
}
