import { NextResponse } from 'next/server';
import { db } from '@/db';
import { creditPackages } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const packages = await db
      .select()
      .from(creditPackages)
      .where(eq(creditPackages.isActive, true))
      .orderBy(creditPackages.sortOrder);

    return NextResponse.json(packages);
  } catch (error) {
    console.error('Error fetching credit packages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit packages' },
      { status: 500 }
    );
  }
}
