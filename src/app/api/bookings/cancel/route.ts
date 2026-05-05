import { NextResponse } from 'next/server';
import { db } from '@/db';
import { bookings, classSessions, creditBalances, creditTransactions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireUserOwnership } from '@/lib/auth/api-auth';
import { bookingRateLimiter } from '@/lib/security/rate-limiter';
import { logSecurityEvent } from '@/lib/security/audit-logger';
import { handleApiError } from '@/lib/security/error-sanitizer';

export async function POST(request: Request) {
  // Rate limiting check
  const rateLimitResult = bookingRateLimiter(request as any);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Reset': rateLimitResult.resetTime?.toString() || ''
        }
      }
    );
  }

  try {
    const { bookingId, userId } = await request.json();

    if (!bookingId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Authenticate and verify user ownership
    const authResult = await requireUserOwnership(request as any, userId);
    if (authResult instanceof NextResponse) {
      return authResult; // This is an error response
    }

    const session = authResult; // This is the valid session

    // Log security event
    await logSecurityEvent({
      userId: session.user.id,
      action: 'booking_cancel',
      resource: 'booking',
      resourceId: bookingId,
      details: { requestedUserId: userId }
    });

    // Get the booking details with session startsAt
    const [row] = await db
      .select({
        id: bookings.id,
        userId: bookings.userId,
        status: bookings.status,
        creditsSpent: bookings.creditsSpent,
        creditType: bookings.creditType,
        startsAt: classSessions.startsAt,
      })
      .from(bookings)
      .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
      .where(and(eq(bookings.id, bookingId), eq(bookings.userId, userId)));

    const booking = row;

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Check cancellation policy (24 hours before class)
    const hoursUntilClass = booking.startsAt.getTime() - Date.now();
    const hoursUntilClassHours = hoursUntilClass / (1000 * 60 * 60);
    
    const isLateCancellation = hoursUntilClassHours < 24;

    // For user cancellations within 24 hours, credits are forfeited
    // This will be handled by the frontend showing a warning modal
    // We still process the cancellation but don't refund credits

    // Update booking status
    await db
      .update(bookings)
      .set({ 
        status: 'cancelled',
        cancelledAt: new Date(),
      })
      .where(eq(bookings.id, bookingId));

    // Refund credits (only if cancelled more than 24 hours before class)
    let creditsRefunded = 0;
    if (hoursUntilClassHours >= 24) { // More than 24 hours before class
      creditsRefunded = booking.creditsSpent;
      
      // Get current balance before update
      const [currentBalance] = await db
        .select({ balance: creditBalances.balance })
        .from(creditBalances)
        .where(and(
          eq(creditBalances.userId, userId),
          eq(creditBalances.creditType, booking.creditType)
        ));

      const newBalance = (currentBalance?.balance || 0) + booking.creditsSpent;

      // Add credits back to balance
      await db
        .update(creditBalances)
        .set({
          balance: newBalance,
        })
        .where(and(
          eq(creditBalances.userId, userId),
          eq(creditBalances.creditType, booking.creditType)
        ));

      // Create credit transaction record
      await db
        .insert(creditTransactions)
        .values({
          userId,
          bookingId,
          creditType: booking.creditType,
          amount: booking.creditsSpent,
          balanceAfter: newBalance,
          type: 'refund',
          description: `Refund for cancelled booking: ${bookingId}`,
        });
    }

    return NextResponse.json({
      success: true,
      creditsRefunded,
      message: creditsRefunded > 0 
        ? `${creditsRefunded} credits refunded to your account`
        : 'Booking cancelled (no refund due to late cancellation)',
    });
  } catch (error) {
    const errorResponse = handleApiError(error, 'booking-cancel');
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
