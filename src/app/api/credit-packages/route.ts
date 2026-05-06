import { NextResponse } from 'next/server';
import { db } from '@/db';
import { creditPackages } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    // Check database connection
    if (!db) {
      console.error('Database connection not available');
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    console.log('Fetching credit packages from database...');
    
    const packages = await db
      .select()
      .from(creditPackages)
      .where(eq(creditPackages.isActive, true))
      .orderBy(creditPackages.sortOrder);

    console.log(`Found ${packages.length} active credit packages`);
    
    // Validate packages data
    if (!Array.isArray(packages)) {
      console.error('Invalid packages data from database:', packages);
      return NextResponse.json(
        { error: 'Invalid data format from database' },
        { status: 500 }
      );
    }

    // Log package details for debugging
    packages.forEach((pkg, index) => {
      console.log(`Package ${index + 1}: ${pkg.name} (${pkg.creditsAmount} ${pkg.creditType} credits)`);
    });

    return NextResponse.json(packages);
  } catch (error) {
    console.error('Error fetching credit packages:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch credit packages',
        details: process.env.NODE_ENV === 'development' ? 
          (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    );
  }
}
