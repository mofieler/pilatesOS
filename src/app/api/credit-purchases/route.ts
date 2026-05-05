import { NextResponse } from 'next/server';
import { db } from '@/db';
import { creditPurchases, creditPackages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { addDays } from 'date-fns';
import { requireUserOwnership } from '@/lib/auth/api-auth';
import { purchaseRateLimiter } from '@/lib/security/rate-limiter';
import { logSecurityEvent } from '@/lib/security/audit-logger';
import { handleApiError } from '@/lib/security/error-sanitizer';
import { creditService } from '@/modules/billing/services/credit.service';

export async function POST(request: Request) {
  // Rate limiting check
  const rateLimitResult = purchaseRateLimiter(request as any);
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
    const { packageId, userId, paymentMethod } = await request.json();

    if (!packageId || !userId || !paymentMethod) {
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
      action: 'credit_purchase_attempt',
      resource: 'credit_purchase',
      details: { packageId, paymentMethod }
    });

    // Validate payment method
    if (!['stripe', 'pay_at_studio'].includes(paymentMethod)) {
      return NextResponse.json(
        { error: 'Invalid payment method' },
        { status: 400 }
      );
    }

    // Get the package details
    const [package_] = await db
      .select()
      .from(creditPackages)
      .where(eq(creditPackages.id, packageId));

    if (!package_) {
      return NextResponse.json(
        { error: 'Package not found' },
        { status: 404 }
      );
    }

    // For Stripe payments, verify payment status (in real implementation)
    // For now, we'll assume payment is verified if paymentMethod is 'stripe'
    if (paymentMethod === 'stripe') {
      // TODO: Add actual Stripe payment verification here
      // const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
      // if (paymentIntent.status !== 'succeeded') {
      //   return NextResponse.json({ error: 'Payment not verified' }, { status: 400 });
      // }
    }

    // Create the purchase record
    const purchase = await db
      .insert(creditPurchases)
      .values({
        userId,
        packageId,
        creditsAmount: package_.creditsAmount,
        creditType: package_.creditType,
        priceCents: package_.priceCents,
        currency: package_.currency,
        paymentMethod,
        paymentStatus: paymentMethod === 'pay_at_studio' ? 'pending' : 'paid',
        paymentDueDate: paymentMethod === 'pay_at_studio' ? addDays(new Date(), 14) : null,
        paidAt: paymentMethod === 'stripe' ? new Date() : null,
      })
      .returning();

    // If paid immediately (Stripe), add credits using creditService for consistency
    if (paymentMethod === 'stripe') {
      const creditResult = await creditService.addCredits({
        userId,
        creditType: package_.creditType,
        amount: package_.creditsAmount,
        packageId,
        description: `Credit purchase: ${package_.name}`,
      });

      if (!creditResult.success) {
        return NextResponse.json(
          { error: creditResult.error, code: creditResult.code },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      purchase: purchase[0],
      dueDate: paymentMethod === 'pay_at_studio' 
        ? addDays(new Date(), 14).toISOString()
        : null,
    });
  } catch (error) {
    const errorResponse = handleApiError(error, 'credit-purchase');
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
