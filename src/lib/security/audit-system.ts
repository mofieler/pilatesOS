import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Dedicated audit log entry types
export interface AuditLogEntry {
  id?: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'auth' | 'financial' | 'admin' | 'user_action' | 'system';
  success: boolean;
  errorMessage?: string;
}

// Database schema for audit logs (would need to be created in actual schema)
interface AuditLogTable {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'auth' | 'financial' | 'admin' | 'user_action' | 'system';
  success: boolean;
  errorMessage: string | null;
  createdAt: Date;
}

// Audit logging service
export class AuditLogger {
  private static instance: AuditLogger;
  
  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  // Log a security event
  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date(),
    };

    try {
      // Log to console for immediate visibility
      console.log('AUDIT_LOG:', JSON.stringify(auditEntry));

      // In production, this would insert into a dedicated audit_logs table
      // For now, we'll use a simplified approach with the existing creditTransactions
      if (entry.category === 'financial') {
        await this.logFinancialEvent(auditEntry);
      }

      // Could also send to external logging service
      await this.sendToExternalService(auditEntry);
      
    } catch (error) {
      console.error('Failed to log audit entry:', error);
      // Audit logging failures should not crash the application
    }
  }

  // Log authentication events
  async logAuthEvent(
    userId: string,
    action: 'login' | 'logout' | 'login_failed' | 'password_change' | 'account_locked',
    success: boolean,
    details?: Record<string, any>,
    errorMessage?: string
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource: 'authentication',
      details,
      success,
      errorMessage,
      severity: this.getSeverityForAuth(action, success),
      category: 'auth',
    });
  }

  // Log financial events
  async logFinancialEvent(
    entry: Omit<AuditLogEntry, 'category'>
  ): Promise<void> {
    // For now, use creditTransactions table as mentioned in existing code
    // In production, this should go to a dedicated audit_logs table
    try {
      if (db) {
        // This would be replaced with proper audit table insertion
        console.log('FINANCIAL_AUDIT:', entry);
      }
    } catch (error) {
      console.error('Failed to log financial event:', error);
    }
  }

  // Log admin actions
  async logAdminAction(
    userId: string,
    action: string,
    resource: string,
    resourceId?: string,
    details?: Record<string, any>,
    success: boolean = true
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource,
      resourceId,
      details,
      success,
      severity: 'high',
      category: 'admin',
    });
  }

  // Log user actions
  async logUserAction(
    userId: string,
    action: string,
    resource: string,
    resourceId?: string,
    details?: Record<string, any>,
    success: boolean = true
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource,
      resourceId,
      details,
      success,
      severity: 'low',
      category: 'user_action',
    });
  }

  // Log system events
  async logSystemEvent(
    action: string,
    details?: Record<string, any>,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<void> {
    await this.log({
      userId: 'system',
      action,
      resource: 'system',
      details,
      success: true,
      severity,
      category: 'system',
    });
  }

  // Get severity level for authentication events
  private getSeverityForAuth(
    action: string,
    success: boolean
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (!success) {
      if (action === 'login_failed') return 'medium';
      if (action === 'account_locked') return 'high';
    }
    return 'low';
  }

  // Send to external logging service (placeholder)
  private async sendToExternalService(entry: AuditLogEntry): Promise<void> {
    // In production, this could send to:
    // - Elasticsearch
    // - Splunk
    // - Datadog
    // - Custom logging API
    // - SIEM system
    
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to external service
      // await fetch('https://logging-service.example.com/api/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(entry)
      // });
    }
  }

  // Query audit logs (for admin dashboards)
  async queryLogs(filters: {
    userId?: string;
    category?: string;
    severity?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    // This would query the dedicated audit_logs table
    // For now, return empty array as placeholder
    console.log('AUDIT_QUERY:', filters);
    return [];
  }

  // Get security metrics
  async getSecurityMetrics(timeframe: 'hour' | 'day' | 'week' | 'month') {
    // This would aggregate audit log data for security dashboards
    return {
      totalEvents: 0,
      failedLogins: 0,
      suspiciousActivity: 0,
      adminActions: 0,
      financialTransactions: 0,
    };
  }
}

// Export singleton instance
export const auditLogger = AuditLogger.getInstance();

// Helper functions for common audit scenarios
export const auditHelpers = {
  // User login
  logUserLogin: async (userId: string, ip?: string, userAgent?: string) => {
    await auditLogger.logAuthEvent(userId, 'login', true, {
      loginTime: new Date().toISOString(),
      ip,
      userAgent,
    });
  },

  // Failed login attempt
  logFailedLogin: async (email: string, ip?: string, userAgent?: string, reason?: string) => {
    await auditLogger.log({
      userId: 'anonymous',
      action: 'login_failed',
      resource: 'authentication',
      details: { email, ip, userAgent, reason },
      success: false,
      severity: 'medium',
      category: 'auth',
      errorMessage: reason,
    });
  },

  // Credit purchase
  logCreditPurchase: async (userId: string, amount: number, creditType: string, success: boolean, error?: string) => {
    await auditLogger.log({
      userId,
      action: 'credit_purchase',
      resource: 'credits',
      details: { amount, creditType },
      success,
      errorMessage: error,
      severity: success ? 'low' : 'high',
      category: 'financial',
    });
  },

  // Booking cancellation
  logBookingCancellation: async (userId: string, bookingId: string, success: boolean, reason?: string) => {
    await auditLogger.log({
      userId,
      action: 'booking_cancel',
      resource: 'booking',
      resourceId: bookingId,
      details: { reason },
      success,
      errorMessage: reason,
      severity: 'low',
      category: 'user_action',
    });
  },

  // Admin action
  logAdminAction: async (userId: string, action: string, resource: string, resourceId?: string, details?: Record<string, any>, success: boolean = true) => {
    await auditLogger.logAdminAction(userId, action, resource, resourceId, details, success);
  },

  // Security violation
  logSecurityViolation: async (userId: string, violation: string, details?: Record<string, any>) => {
    await auditLogger.log({
      userId,
      action: 'security_violation',
      resource: 'security',
      details: { violation, ...details },
      success: false,
      severity: 'critical',
      category: 'system',
      errorMessage: violation,
    });
  },
};
