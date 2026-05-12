import { NextResponse } from 'next/server';
import { db } from '@/db';
import { creditPurchases, creditPackages, creditBalances, creditTransactions, users } from '@/db/schema';
import { eq, and, like, desc, isNull } from 'drizzle-orm';
import { addDays } from 'date-fns';
import { requireUserOwnership } from '@/lib/auth/api-auth';
import { purchaseRateLimiter } from '@/lib/security/rate-limiter';
import { logSecurityEvent } from '@/lib/security/audit-logger';
import { handleApiError } from '@/lib/security/error-sanitizer';
import { generateInvoicePDF } from '@/lib/invoice/invoice.generator';
import { sendPurchaseConfirmationWithInvoice } from '@/lib/email/resend';
import { getUserBillingStatus } from '@/modules/billing/services/billingStatus.service';

export async function POST(request: Request) {
  const rateLimitResult = await purchaseRateLimiter(request as any);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'X-RateLimit-Reset': rateLimitResult.resetTime?.toString() || '' },
      }
    );
  }

  try {
    const body = await request.json();
    const { packageId, userId, paymentMethod, acceptedTerms } = body;

    if (!packageId || !userId || !paymentMethod) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Trust-but-verify: client checkboxes are re-validated server-side so the order
    // cannot be placed by curl-ing the API. Required for German Button-Lösung
    // (§ 312j Abs. 3 BGB) and for immediately delivered digital services (§ 356 Abs. 5 BGB).
    if (acceptedTerms !== true) {
      return NextResponse.json(
        { error: 'You must accept the AGB before ordering.' },
        { status: 400 },
      );
    }

    const authResult = await requireUserOwnership(request as any, userId);
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    await logSecurityEvent({
      userId: session.user.id,
      action: 'credit_purchase_attempt',
      resource: 'credit_purchase',
      details: { packageId, paymentMethod, acceptedTerms },
    });

    // Only pay-at-studio is allowed here — Stripe must go through the webhook
    if (paymentMethod !== 'pay_at_studio') {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    // Block new purchases while the user has overdue invoices.
    // Same guard runs in createBookingAction — both must use billingStatus.service
    // so the policy stays in one place.
    const billing = await getUserBillingStatus(userId);
    if (billing.blockActions) {
      return NextResponse.json(
        {
          error:
            'You have overdue invoices. Please settle them at the studio before purchasing more credits.',
          code: 'OVERDUE_BILLS',
          overdueCount: billing.overdueBills.length,
        },
        { status: 402 }, // 402 Payment Required
      );
    }

    const [package_] = await db
      .select()
      .from(creditPackages)
      .where(eq(creditPackages.id, packageId));

    if (!package_) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    const dueDate = addDays(new Date(), 14);

    // Atomic: generate invoice number + create purchase + grant credits
    const { purchase, newBalance, invoiceNumber } = await db.transaction(async (tx) => {
      // Sequential invoice number per calendar year (RE-YYYY-NNNN)
      const year   = new Date().getFullYear();
      const prefix = `RE-${year}-`;
      const [lastRow] = await tx
        .select({ num: creditPurchases.invoiceNumber })
        .from(creditPurchases)
        .where(like(creditPurchases.invoiceNumber, `${prefix}%`))
        .orderBy(desc(creditPurchases.invoiceNumber))
        .limit(1);

      const lastSeq    = lastRow?.num ? parseInt(lastRow.num.slice(prefix.length), 10) : 0;
      const invNumber  = `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
      const now        = new Date();

      const [newPurchase] = await tx
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
          paymentDueDate: dueDate,
          paidAt: null,
          invoiceNumber: invNumber,
          invoiceIssuedAt: now,
        })
        .returning();

      // Upsert credit balance (FOR UPDATE prevents concurrent races)
      const [existing] = await tx
        .select()
        .from(creditBalances)
        .where(
          and(
            eq(creditBalances.userId, userId),
            eq(creditBalances.creditType, package_.creditType),
          ),
        )
        .for('update')
        .limit(1);

      let balance: number;
      if (existing) {
        balance = existing.balance + package_.creditsAmount;
        await tx
          .update(creditBalances)
          .set({ balance, updatedAt: new Date() })
          .where(eq(creditBalances.id, existing.id));
      } else {
        balance = package_.creditsAmount;
        await tx.insert(creditBalances).values({
          userId,
          creditType: package_.creditType,
          balance,
        });
      }

      await tx.insert(creditTransactions).values({
        userId,
        packageId: package_.id,
        type: 'purchase',
        creditType: package_.creditType,
        amount: package_.creditsAmount,
        balanceAfter: balance,
        description: `Pay-at-studio purchase: ${package_.creditsAmount} ${package_.creditType} credits (${invNumber})`,
      });

      return { purchase: newPurchase, newBalance: balance, invoiceNumber: invNumber };
    });

    // Fire-and-forget: generate PDF invoice and send confirmation email
    Promise.resolve().then(async () => {
      try {
        const [userRow] = await db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(and(eq(users.id, userId), isNull(users.deletedAt)))
          .limit(1);

        if (!userRow?.email) return;

        const pdfBuffer = await generateInvoicePDF({
          invoiceNumber,
          invoiceDate: new Date(),
          dueDate,
          customerName:    userRow.name ?? 'Customer',
          customerEmail:   userRow.email,
          customerAddress: null,
          packageName:     package_.name,
          creditsAmount:   package_.creditsAmount,
          creditType:      package_.creditType,
          priceCents:      package_.priceCents,
          currency:        package_.currency,
          paymentMethod:   'pay_at_studio',
        });

        await sendPurchaseConfirmationWithInvoice(
          userRow.email,
          userRow.name ?? 'there',
          package_.name,
          package_.creditsAmount,
          package_.priceCents,
          package_.currency,
          invoiceNumber,
          dueDate,
          pdfBuffer,
        );
      } catch (err) {
        console.warn('[invoice] Failed to generate/send invoice:', err);
      }
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      purchase,
      newBalance,
      invoiceNumber,
      dueDate: dueDate.toISOString(),
    });
  } catch (error) {
    const errorResponse = handleApiError(error, 'credit-purchase');
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
