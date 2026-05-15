import { z } from 'zod';
import { db } from '@/db';
import { creditPurchases, users, creditPackages, invoiceReminders } from '@/db/schema';
import { eq, sql, count, max, isNull, and } from 'drizzle-orm';
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

    // Subquery: reminder count + last sent date per purchase
    const reminderStats = db
      .select({
        purchaseId: invoiceReminders.purchaseId,
        reminderCount: count(invoiceReminders.id).as('reminder_count'),
        lastReminderAt: max(invoiceReminders.createdAt).as('last_reminder_at'),
      })
      .from(invoiceReminders)
      .groupBy(invoiceReminders.purchaseId)
      .as('reminder_stats');

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
        invoiceNumber: creditPurchases.invoiceNumber,
        invoiceIssuedAt: creditPurchases.invoiceIssuedAt,
        reminderCount: sql<number>`COALESCE(${reminderStats.reminderCount}, 0)`.mapWith(Number),
        lastReminderAt: reminderStats.lastReminderAt,
      })
      .from(creditPurchases)
      .leftJoin(users, and(eq(creditPurchases.userId, users.id), isNull(users.deletedAt)))
      .leftJoin(creditPackages, eq(creditPurchases.packageId, creditPackages.id))
      .leftJoin(reminderStats, eq(creditPurchases.id, reminderStats.purchaseId))
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

    // Credits are granted immediately when the purchase is created (in the API route).
    // Admin marking as paid is a pure accounting/status update only.
    const [updatedPurchase] = await db
      .update(creditPurchases)
      .set({
        paymentStatus,
        adminNotes: adminNotes || currentPurchase.adminNotes,
        ...(paymentStatus === 'paid' ? { paidAt: new Date() } : {}),
      })
      .where(eq(creditPurchases.id, purchaseId))
      .returning();

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
