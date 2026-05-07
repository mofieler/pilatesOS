import { z } from 'zod';
import { db } from '@/db';
import { creditPurchases, creditBalances, creditTransactions, users, creditPackages } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { auditHelpers } from '@/lib/security/audit-system';
import { handleApiError } from '@/lib/security/error-sanitizer';
import { creditService } from '@/modules/billing/services/credit.service';

// Types
interface CreditPurchaseUpdate {
  paymentStatus: 'pending' | 'paid' | 'failed' | 'cancelled' | 'overdue';
  adminNotes?: string | null;
  paidAt?: Date;
}

// Validation schemas
const updatePurchaseSchema = z.object({
  purchaseId: z.string().uuid(),
  paymentStatus: z.enum(['pending', 'paid', 'failed', 'cancelled', 'overdue']),
  adminNotes: z.string().optional(),
});

// Get all credit purchases with user details
export async function getAllCreditPurchasesAction() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'admin') {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const purchases = await db
      .select({
        id: creditPurchases.id,
        userId: creditPurchases.userId,
        userName: users.name,
        userEmail: users.email,
        packageName: creditPackages.name,
        creditsAmount: creditPurchases.creditsAmount,
        creditType: creditPurchases.creditType,
        priceCents: creditPurchases.priceCents,
        currency: creditPurchases.currency,
        paymentMethod: creditPurchases.paymentMethod,
        paymentStatus: creditPurchases.paymentStatus,
        paymentDueDate: creditPurchases.paymentDueDate,
        paidAt: creditPurchases.paidAt,
        createdAt: creditPurchases.createdAt,
        adminNotes: creditPurchases.adminNotes,
      })
      .from(creditPurchases)
      .leftJoin(users, eq(creditPurchases.userId, users.id))
      .leftJoin(creditPackages, eq(creditPurchases.packageId, creditPackages.id))
      .orderBy(sql`${creditPurchases.createdAt} DESC`);

    return { success: true, data: purchases };
  } catch (error) {
    const errorResponse = handleApiError(error, 'get-purchases');
    return { success: false, error: errorResponse.error, code: errorResponse.code as any };
  }
}

// Update credit purchase status and add credits if marked as paid
export async function updateCreditPurchaseAction(input: z.infer<typeof updatePurchaseSchema>) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  const parsed = updatePurchaseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input', code: 'INVALID_STATE' };
  }

  const { purchaseId, paymentStatus, adminNotes } = parsed.data;

  try {
    // Get current purchase details first for audit logging
    const [currentPurchase] = await db
      .select()
      .from(creditPurchases)
      .where(eq(creditPurchases.id, purchaseId));

    if (!currentPurchase) {
      return { success: false, error: 'Purchase not found', code: 'NOT_FOUND' };
    }

    // Only allow status changes from pending/overdue to paid
    if (paymentStatus === 'paid' && !['pending', 'overdue'].includes(currentPurchase.paymentStatus)) {
      return { success: false, error: 'Can only mark pending or overdue purchases as paid', code: 'INVALID_STATE' };
    }

    // Start transaction for atomic updates
    const updatedPurchase = await db.transaction(async (tx) => {
      // Update purchase status
      const updateData: any = {
        paymentStatus,
        adminNotes: adminNotes || currentPurchase.adminNotes,
      };

      if (paymentStatus === 'paid') {
        updateData.paidAt = new Date();
      }

      const [updated] = await tx
        .update(creditPurchases)
        .set(updateData)
        .where(eq(creditPurchases.id, purchaseId))
        .returning();

      // Auto-add credits when marking as paid (pay-at-studio flow)
      // This is idempotent - purchase ID serves as idempotency key
      if (paymentStatus === 'paid' && ['pending', 'overdue'].includes(currentPurchase.paymentStatus)) {
        // Check if credits were already added by looking for existing credit transaction with this purchase ID
        // For pay-at-studio, we use a specific description pattern to track idempotency
        const [existingCreditTx] = await tx
          .select({ id: creditTransactions.id })
          .from(creditTransactions)
          .where(
            and(
              eq(creditTransactions.userId, currentPurchase.userId),
              eq(creditTransactions.packageId, purchaseId),
              eq(creditTransactions.type, 'purchase')
            )
          )
          .limit(1);

        if (!existingCreditTx) {
          // Get or create credit balance row (with FOR UPDATE lock)
          const [existingBalance] = await tx
            .select()
            .from(creditBalances)
            .where(
              and(
                eq(creditBalances.userId, currentPurchase.userId),
                eq(creditBalances.creditType, currentPurchase.creditType)
              )
            )
            .for('update')
            .limit(1);

          let newBalance: number;
          let balanceId: string;

          if (existingBalance) {
            newBalance = existingBalance.balance + currentPurchase.creditsAmount;
            await tx
              .update(creditBalances)
              .set({
                balance: newBalance,
                expiresAt: existingBalance.expiresAt, // Keep existing expiry
                updatedAt: new Date(),
              })
              .where(eq(creditBalances.id, existingBalance.id));
            balanceId = existingBalance.id;
          } else {
            newBalance = currentPurchase.creditsAmount;
            const [newBalanceRow] = await tx
              .insert(creditBalances)
              .values({
                userId: currentPurchase.userId,
                creditType: currentPurchase.creditType,
                balance: newBalance,
                expiresAt: null,
              })
              .returning({ id: creditBalances.id });
            balanceId = newBalanceRow.id;
          }

          // Record the credit transaction
          await tx.insert(creditTransactions).values({
            userId: currentPurchase.userId,
            packageId: purchaseId, // Use purchase ID as idempotency reference
            type: 'purchase',
            creditType: currentPurchase.creditType,
            amount: currentPurchase.creditsAmount,
            balanceAfter: newBalance,
            description: `Pay-at-studio: ${currentPurchase.creditsAmount} ${currentPurchase.creditType} credits (Purchase: ${purchaseId})`,
          });
        }
      }

      return updated;
    });

    // Log admin action
    await auditHelpers.logAdminAction(
      session.user.id,
      `update_purchase_status_${paymentStatus}`,
      'credit_purchase',
      purchaseId,
      {
        previousStatus: currentPurchase.paymentStatus,
        newStatus: paymentStatus,
        adminNotes
      }
    );

    return { success: true, data: updatedPurchase };
  } catch (error) {
    await auditHelpers.logAdminAction(
      session.user.id,
      'update_purchase_status_failed',
      'credit_purchase',
      purchaseId,
      {
        paymentStatus,
        adminNotes,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      false
    );

    const errorResponse = handleApiError(error, 'update-purchase');
    return { success: false, error: errorResponse.error, code: errorResponse.code as any };
  }
}

// Get purchase statistics
export async function getPurchaseStatsAction() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  try {
    // Reference Drizzle columns so the generated SQL uses real snake_case
    // names (payment_status, price_cents). The previous version embedded
    // camelCase identifiers literally and threw "column ... does not exist"
    // at runtime.
    const stats = await db
      .select({
        total: sql<number>`COUNT(*)`.mapWith(Number),
        paid: sql<number>`SUM(CASE WHEN ${creditPurchases.paymentStatus} = 'paid' THEN 1 ELSE 0 END)`.mapWith(Number),
        pending: sql<number>`SUM(CASE WHEN ${creditPurchases.paymentStatus} = 'pending' THEN 1 ELSE 0 END)`.mapWith(Number),
        overdue: sql<number>`SUM(CASE WHEN ${creditPurchases.paymentStatus} = 'overdue' THEN 1 ELSE 0 END)`.mapWith(Number),
        totalRevenue: sql<number>`SUM(CASE WHEN ${creditPurchases.paymentStatus} = 'paid' THEN ${creditPurchases.priceCents} ELSE 0 END)`.mapWith(Number),
        outstanding: sql<number>`SUM(CASE WHEN ${creditPurchases.paymentStatus} IN ('pending', 'overdue') THEN ${creditPurchases.priceCents} ELSE 0 END)`.mapWith(Number),
      })
      .from(creditPurchases);

    return { success: true, data: stats[0] };
  } catch (error) {
    const errorResponse = handleApiError(error, 'get-stats');
    return { success: false, error: errorResponse.error, code: errorResponse.code as any };
  }
}
