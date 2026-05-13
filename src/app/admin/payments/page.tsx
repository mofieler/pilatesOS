'use client';

import { useState, useMemo, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Store,
  Search,
  Filter,
  Banknote,
  Calendar,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LEGACY_CREDIT_TYPE_LABELS, LEGACY_CREDIT_TYPE_STYLES } from '@/lib/config/class-types';

// Types
interface CreditPurchase {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  packageName: string;
  creditsAmount: number;
  creditType: 'reformer' | 'mat' | 'group' | 'sound_healing';
  priceCents: number;
  currency: string;
  paymentMethod: 'stripe' | 'pay_at_studio';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'cancelled' | 'overdue';
  paymentDueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  adminNotes: string | null;
}

type StatusFilter = 'all' | 'pending' | 'paid' | 'overdue' | 'pay_at_studio';

// API functions
async function fetchPurchases(): Promise<CreditPurchase[]> {
  try {
    const response = await fetch('/api/admin/purchases');
    if (!response.ok) throw new Error('Failed to fetch purchases');
    return await response.json();
  } catch (error) {
    console.error('Error fetching purchases:', error);
    return [];
  }
}

async function updatePurchaseStatus(purchaseId: string, paymentStatus: string, adminNotes?: string): Promise<void> {
  try {
    const response = await fetch('/api/admin/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purchaseId, paymentStatus, adminNotes }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('API Error Response:', error);
      throw new Error(error.error || error.message || 'Failed to update purchase');
    }
  } catch (error) {
    console.error('Error updating purchase:', error);
    throw error;
  }
}

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: 'bg-[#d4a574]/15 text-[#b58a5c] border-[#d4a574]/30',
    icon: Clock,
  },
  paid: {
    label: 'Paid',
    color: 'bg-[#6b8e6b]/15 text-[#4a7c4a] border-[#6b8e6b]/30',
    icon: CheckCircle,
  },
  overdue: {
    label: 'Overdue',
    color: 'bg-[#c45c4a]/15 text-[#c45c4a] border-[#c45c4a]/30',
    icon: AlertTriangle,
  },
  failed: {
    label: 'Failed',
    color: 'bg-[#8b6b5c]/15 text-[#8b6b5c] border-[#8b6b5c]/30',
    icon: XCircle,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-[#ede8e5] text-[#8b6b5c] border-[#ede8e5]',
    icon: XCircle,
  },
};


function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function StatCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  color: 'primary' | 'success' | 'warning' | 'danger';
}) {
  const colorClasses = {
    primary: 'from-[#4e2b22]/10 to-[#6b3d32]/5',
    success: 'from-[#6b8e6b]/10 to-[#6b8e6b]/5',
    warning: 'from-[#d4a574]/10 to-[#d4a574]/5',
    danger: 'from-[#c45c4a]/10 to-[#c45c4a]/5',
  };

  return (
    <div
      className={cn(
        'rounded-2xl border border-[#ede8e5]/80 p-5',
        'bg-gradient-to-br',
        colorClasses[color]
      )}
    >
      <p className="text-sm text-[#8b6b5c] mb-1">{title}</p>
      <p className="text-2xl font-bold text-[#4e2b22]">{value}</p>
      <p className="text-xs text-[#8b6b5c] mt-1">{subtitle}</p>
    </div>
  );
}

function PurchaseRow({
  purchase,
  onMarkPaid,
}: {
  purchase: CreditPurchase;
  onMarkPaid: (id: string, notes: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [notes, setNotes] = useState(purchase.adminNotes || '');
  const statusConfig = STATUS_CONFIG[purchase.paymentStatus];
  const StatusIcon = statusConfig.icon;

  const isPayAtStudio = purchase.paymentMethod === 'pay_at_studio';
  const canMarkPaid = purchase.paymentStatus === 'pending' || purchase.paymentStatus === 'overdue';

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all',
        'bg-gradient-to-br from-[#faf9f7]/90 to-[#f5f3f1]/60',
        'border-[#ede8e5]/80',
        isExpanded && 'shadow-[0_4px_14px_rgba(78,43,34,0.06)]'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[#4e2b22]">{purchase.userName}</span>
            <span className="text-[#8b6b5c] text-sm">{purchase.userEmail}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              variant="outline"
              className={cn(
                'text-xs rounded-full',
                LEGACY_CREDIT_TYPE_STYLES[purchase.creditType]
              )}
            >
              {LEGACY_CREDIT_TYPE_LABELS[purchase.creditType]}
            </Badge>
            <span className="text-sm text-[#6b3d32]">{purchase.packageName}</span>
            <span className="text-sm font-medium text-[#4e2b22]">
              {formatPrice(purchase.priceCents, purchase.currency)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn('rounded-full', statusConfig.color)}
          >
            <StatusIcon className="size-3 mr-1" />
            {statusConfig.label}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="text-[#8b6b5c] hover:text-[#4e2b22]"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Less' : 'Details'}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-[#ede8e5]/60 animate-in slide-in-from-top-2">
          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <Store className="size-4 text-[#8b6b5c]" />
              <span className="text-[#8b6b5c]">Method:</span>
              <span className="text-[#4e2b22] font-medium">
                {isPayAtStudio ? 'Pay at Studio' : 'Stripe'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="size-4 text-[#8b6b5c]" />
              <span className="text-[#8b6b5c]">Purchased:</span>
              <span className="text-[#4e2b22]">
                {format(new Date(purchase.createdAt), 'MMM d, yyyy')}
              </span>
            </div>
            {purchase.paymentDueDate && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="size-4 text-[#8b6b5c]" />
                <span className="text-[#8b6b5c]">Due Date:</span>
                <span
                  className={cn(
                    'font-medium',
                    purchase.paymentStatus === 'overdue'
                      ? 'text-[#c45c4a]'
                      : 'text-[#4e2b22]'
                  )}
                >
                  {format(new Date(purchase.paymentDueDate), 'MMM d, yyyy')}
                </span>
              </div>
            )}
            {purchase.paidAt && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="size-4 text-[#6b8e6b]" />
                <span className="text-[#8b6b5c]">Paid:</span>
                <span className="text-[#6b8e6b] font-medium">
                  {format(new Date(purchase.paidAt), 'MMM d, yyyy')}
                </span>
              </div>
            )}
          </div>

          {canMarkPaid && (
            <div className="space-y-3">
              <div>
                <label className="text-sm text-[#8b6b5c] mb-1 block">Admin Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Paid in cash, Transaction ID, etc."
                  className="w-full rounded-lg border border-[#ede8e5] bg-[#faf9f7]/80 p-2 text-sm text-[#4e2b22] placeholder:text-[#a6856f] focus:border-[#c4a88a] focus:outline-none"
                  rows={2}
                />
              </div>
              <Button
                variant="boutique"
                size="sm"
                className="w-full"
                onClick={() => onMarkPaid(purchase.id, notes)}
              >
                <Banknote className="size-4 mr-2" />
                Mark as Paid
              </Button>
            </div>
          )}

          {purchase.adminNotes && !canMarkPaid && (
            <div className="mt-3 p-3 rounded-lg bg-[#ede8e5]/40">
              <p className="text-xs text-[#8b6b5c] mb-1">Admin Notes:</p>
              <p className="text-sm text-[#6b3d32]">{purchase.adminNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPaymentsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [purchases, setPurchases] = useState<CreditPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch purchases on component mount
  useEffect(() => {
    const loadPurchases = async () => {
      try {
        const data = await fetchPurchases();
        setPurchases(data);
      } catch (error) {
        console.error('Failed to load purchases:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPurchases();
  }, []);

  const stats = useMemo(() => {
    const total = purchases.length;
    const paid = purchases.filter((p) => p.paymentStatus === 'paid').length;
    const pending = purchases.filter((p) => p.paymentStatus === 'pending').length;
    const overdue = purchases.filter((p) => p.paymentStatus === 'overdue').length;
    const totalRevenue = purchases
      .filter((p) => p.paymentStatus === 'paid')
      .reduce((sum, p) => sum + p.priceCents, 0);
    const outstanding = purchases
      .filter((p) => p.paymentStatus === 'pending' || p.paymentStatus === 'overdue')
      .reduce((sum, p) => sum + p.priceCents, 0);

    return { total, paid, pending, overdue, totalRevenue, outstanding };
  }, [purchases]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((purchase) => {
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'pay_at_studio'
          ? purchase.paymentMethod === 'pay_at_studio'
          : purchase.paymentStatus === statusFilter;

      const matchesSearch =
        searchQuery === ''
          ? true
          : purchase.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            purchase.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
            purchase.packageName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [purchases, statusFilter, searchQuery]);

  async function handleMarkPaid(id: string, notes: string) {
    try {
      await updatePurchaseStatus(id, 'paid', notes);
      
      // Refresh purchases list
      const updatedPurchases = await fetchPurchases();
      setPurchases(updatedPurchases);
      
      // Show success message
      alert('Purchase marked as paid successfully!');
    } catch (error) {
      console.error('Failed to mark purchase as paid:', error);
      // Show error message to user
      const errorMessage = error instanceof Error ? error.message : 'Failed to mark purchase as paid';
      alert(`Error: ${errorMessage}`);
    }
  }

  const filterButtons: { label: string; value: StatusFilter; count?: number }[] = [
    { label: 'All', value: 'all', count: stats.total },
    { label: 'Pending', value: 'pending', count: stats.pending },
    { label: 'Paid', value: 'paid', count: stats.paid },
    { label: 'Overdue', value: 'overdue', count: stats.overdue },
    { label: 'Pay at Studio', value: 'pay_at_studio' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-[#6b3d32] text-sm">Financial Overview</p>
        <h1 className="mt-1 text-3xl font-bold text-[#4e2b22]">Payment Management</h1>
        <p className="mt-2 text-[#6b3d32] text-sm">
          Manage credit purchases, track payments, and activate user credits
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Purchases"
          value={stats.total}
          subtitle="All time purchases"
          color="primary"
        />
        <StatCard
          title="Paid"
          value={stats.paid}
          subtitle={`Revenue: ${formatPrice(stats.totalRevenue, 'eur')}`}
          color="success"
        />
        <StatCard
          title="Pending"
          value={stats.pending}
          subtitle="Awaiting payment"
          color="warning"
        />
        <StatCard
          title="Overdue"
          value={stats.overdue}
          subtitle={`Outstanding: ${formatPrice(stats.outstanding, 'eur')}`}
          color="danger"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#8b6b5c]" />
          <input
            type="text"
            placeholder="Search by name, email, or package..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#ede8e5] bg-[#faf9f7]/80 text-[#4e2b22] placeholder:text-[#a6856f] focus:border-[#c4a88a] focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="size-4 text-[#8b6b5c]" />
          {filterButtons.map((btn) => (
            <Button
              key={btn.value}
              variant={statusFilter === btn.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(btn.value)}
              className={cn(
                'rounded-full text-xs',
                statusFilter === btn.value
                  ? 'bg-[#4e2b22] text-[#faf9f7]'
                  : 'border-[#ede8e5] text-[#6b3d32]'
              )}
            >
              {btn.label}
              {btn.count !== undefined && (
                <span className="ml-1 text-xs opacity-70">({btn.count})</span>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Purchases List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center size-12 rounded-full bg-[#ede8e5]/60 mb-4">
              <div className="size-6 text-[#8b6b5c] animate-spin">⟳</div>
            </div>
            <p className="text-[#8b6b5c]">Loading purchases...</p>
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center size-12 rounded-full bg-[#ede8e5]/60 mb-4">
              <Search className="size-6 text-[#8b6b5c]" />
            </div>
            <p className="text-[#8b6b5c]">No purchases found</p>
          </div>
        ) : (
          filteredPurchases.map((purchase) => (
            <PurchaseRow
              key={purchase.id}
              purchase={purchase}
              onMarkPaid={handleMarkPaid}
            />
          ))
        )}
      </div>
    </div>
  );
}
