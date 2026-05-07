import { NextResponse } from 'next/server';
import { db } from '@/db';
import { creditPurchases, creditPackages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { addDays } from 'date-fns';
import { requireUserOwnership } from '@/lib/auth/api-auth';
import { purchaseRateLimiter } from '@/lib/security/rate-limiter';
import { logSecurityEvent } from '@/lib/security/audit-logger';
import { handleApiError } from '@/lib/security/error-sanitizer';

export async function POST(request: Request) {
  console.log('Credit purchase request received');
  
  // Rate limiting check
  const rateLimitResult = await purchaseRateLimiter(request as any);
  if (!rateLimitResult.success) {
    console.log('Rate limit exceeded');
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
    const body = await request.json();
    console.log('Request body:', { ...body, userId: body.userId ? '[REDACTED]' : 'MISSING' });
    
    const { packageId, userId, paymentMethod } = body;

    if (!packageId || !userId || !paymentMethod) {
      console.error('Missing required fields:', { packageId: !!packageId, userId: !!userId, paymentMethod: !!paymentMethod });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Authenticate and verify user ownership
    console.log('Authenticating user:', userId);
    const authResult = await requireUserOwnership(request as any, userId);
    if (authResult instanceof NextResponse) {
      console.error('Authentication failed for user:', userId);
      return authResult; // This is an error response
    }

    const session = authResult; // This is the valid session
    console.log('User authenticated successfully:', session.user.email);

    // Log security event
    await logSecurityEvent({
      userId: session.user.id,
      action: 'credit_purchase_attempt',
      resource: 'credit_purchase',
      details: { packageId, paymentMethod }
    });

    // Validate payment method.
    // 'stripe' is intentionally rejected here: this route is the client-initiated
    // path. Stripe purchases must originate from a Checkout Session and be
    // confirmed by the Stripe webhook (which is the only place credits may be
    // granted for a Stripe payment). Without that webhook, allowing 'stripe' here
    // is a free-credits exploit — the client could just claim it paid.
    if (paymentMethod !== 'pay_at_studio') {
      return NextResponse.json(
        { error: 'Invalid payment method' },
        { status: 400 }
      );
    }

    // Get the package details
    console.log('Looking up package:', packageId);
    const [package_] = await db
      .select()
      .from(creditPackages)
      .where(eq(creditPackages.id, packageId));

    if (!package_) {
      console.error('Package not found:', packageId);
      return NextResponse.json(
        { error: 'Package not found' },
        { status: 404 }
      );
    }
    
    console.log('Package found:', package_.name, '-', package_.creditsAmount, package_.creditType, 'credits');

    // Create the pay-at-studio purchase record. Credits are NOT granted yet —
    // they are added by the admin marking the purchase paid (see
    // updateCreditPurchaseAction).
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
        paymentStatus: 'pending',
        paymentDueDate: addDays(new Date(), 14),
        paidAt: null,
      })
      .returning();

    console.log('Purchase record created:', purchase[0].id);

    const response = {
      success: true,
      purchase: purchase[0],
      dueDate: addDays(new Date(), 14).toISOString(),
    };
    
    console.log('Purchase completed successfully:', { 
      purchaseId: purchase[0].id, 
      paymentMethod, 
      creditsAmount: package_.creditsAmount 
    });
    
    return NextResponse.json(response);
  } catch (error) {
    const errorResponse = handleApiError(error, 'credit-purchase');
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
