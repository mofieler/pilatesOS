export interface CreditPurchase {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  packageName: string | null;
  creditsAmount: number;
  creditType: 'pass' | 'session';
  priceCents: number;
  currency: string;
  paymentMethod: 'stripe' | 'pay_at_studio';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'cancelled' | 'overdue';
  paymentDueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  adminNotes: string | null;
  invoiceNumber: string | null;
  invoiceIssuedAt: string | null;
  reminderCount: number;
  lastReminderAt: string | null;
}

export type StatusFilter = 'all' | 'pending' | 'paid' | 'overdue' | 'pay_at_studio';
