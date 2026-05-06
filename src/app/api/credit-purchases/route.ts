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
  console.log('Credit purchase request received');
  
  // Rate limiting check
  const rateLimitResult = purchaseRateLimiter(request as any);
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

    // Validate payment method
    if (!['stripe', 'pay_at_studio'].includes(paymentMethod)) {
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
    console.log('Creating purchase record with payment method:', paymentMethod);
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
    
    console.log('Purchase record created:', purchase[0].id);

    // If paid immediately (Stripe), add credits using creditService for consistency
    if (paymentMethod === 'stripe') {
      console.log('Adding credits for Stripe payment');
      const creditResult = await creditService.addCredits({
        userId,
        creditType: package_.creditType,
        amount: package_.creditsAmount,
        packageId,
        description: `Credit purchase: ${package_.name}`,
      });

      if (!creditResult.success) {
        console.error('Failed to add credits:', creditResult.error);
        return NextResponse.json(
          { error: creditResult.error, code: creditResult.code },
          { status: 500 }
        );
      }
      
      console.log('Credits added successfully');
    } else {
      console.log('Payment method is pay_at_studio - credits will be added after payment confirmation');
    }

    const response = {
      success: true,
      purchase: purchase[0],
      dueDate: paymentMethod === 'pay_at_studio' 
        ? addDays(new Date(), 14).toISOString()
        : null,
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
