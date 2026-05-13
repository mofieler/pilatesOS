import { db } from '@/db';
import { creditTransactions, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export interface AuditLogEntry {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logSecurityEvent(entry: AuditLogEntry) {
  try {
    // Log to database (could extend with dedicated audit table)
    console.log('SECURITY_AUDIT:', {
      timestamp: new Date().toISOString(),
      ...entry
    });

    // For critical financial operations, also log to credit transactions
    if (entry.action.includes('purchase') || entry.action.includes('refund')) {
      await db.insert(creditTransactions).values({
        userId: entry.userId,
        type: 'manual_adjustment', // Using existing type for audit
        creditType: 'mat', // Default type for audit entries
        amount: 0,
        balanceAfter: 0,
        description: `AUDIT: ${entry.action} on ${entry.resource}${entry.resourceId ? `:${entry.resourceId}` : ''}`,
        processedBy: entry.userId,
      });
    }
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

export async function logFinancialOperation(
  userId: string,
  operation: 'purchase' | 'refund' | 'adjustment',
  details: {
    amount: number;
    creditType: string;
    balanceAfter: number;
    referenceId?: string;
    description: string;
  }
) {
  try {
    await logSecurityEvent({
      userId,
      action: `financial_${operation}`,
      resource: 'credits',
      resourceId: details.referenceId,
      details: {
        amount: details.amount,
        creditType: details.creditType,
        balanceAfter: details.balanceAfter,
        description: details.description
      }
    });
  } catch (error) {
    console.error('Failed to log financial operation:', error);
  }
}
