'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
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
  Download,
  ChevronDown,
  ChevronUp,
  X,
  CheckCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LEGACY_CREDIT_TYPE_LABELS, LEGACY_CREDIT_TYPE_STYLES } from '@/lib/config/class-types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreditPurchase {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  packageName: string | null;
  creditsAmount: number;
  creditType: 'reformer' | 'mat' | 'group' | 'session' | 'sound_healing';
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
}

type StatusFilter = 'all' | 'pending' | 'paid' | 'overdue' | 'pay_at_studio';

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-start gap-3 rounded-2xl border p-4 shadow-lg shadow-[#4e2b22]/10',
            'animate-in slide-in-from-bottom-4 fade-in duration-300',
            t.type === 'success' && 'bg-white border-[#6b8e6b]/30',
            t.type === 'error'   && 'bg-white border-[#c45c4a]/30',
            t.type === 'info'    && 'bg-white border-[#ede8e5]',
          )}
        >
          <span className="shrink-0 mt-0.5">
            {t.type === 'success' && <CheckCheck className="size-4 text-[#4a7c4a]" />}
            {t.type === 'error'   && <XCircle    className="size-4 text-[#c45c4a]" />}
            {t.type === 'info'    && <Clock      className="size-4 text-[#8b6b5c]" />}
          </span>
          <p className="flex-1 text-sm text-[#4e2b22]">{t.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="shrink-0 text-[#8b6b5c] hover:text-[#4e2b22] transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, show, dismiss };
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchPurchases(): Promise<CreditPurchase[]> {
  const response = await fetch('/api/admin/purchases');
  if (!response.ok) throw new Error('Failed to fetch purchases');
  return response.json();
}

async function updatePurchaseStatus(
  purchaseId: string,
  paymentStatus: string,
  adminNotes?: string,
): Promise<void> {
  const response = await fetch('/api/admin/purchases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purchaseId, paymentStatus, adminNotes }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to update purchase');
  }
}

// ─── Status config ────────────────────────────────────────────────────────────

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
} satisfies Record<string, { label: string; color: string; icon: React.ElementType }>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

// ─── Stat card ────────────────────────────────────────────────────────────────

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
    primary: 'from-[#4e2b22]/10 to-[#6b3d32]/5 border-[#4e2b22]/10',
    success: 'from-[#6b8e6b]/10 to-[#6b8e6b]/5 border-[#6b8e6b]/15',
    warning: 'from-[#d4a574]/10 to-[#d4a574]/5 border-[#d4a574]/15',
    danger:  'from-[#c45c4a]/10 to-[#c45c4a]/5 border-[#c45c4a]/15',
  };

  return (
    <div className={cn(
      'rounded-2xl border p-5 bg-linear-to-br',
      colorClasses[color],
    )}>
      <p className="text-sm text-[#8b6b5c]">{title}</p>
      <p className="text-2xl font-bold text-[#4e2b22] mt-1">{value}</p>
      <p className="text-xs text-[#8b6b5c] mt-1">{subtitle}</p>
    </div>
  );
}

// ─── Purchase row ─────────────────────────────────────────────────────────────

function PurchaseRow({
  purchase,
  onMarkPaid,
  onDownload,
}: {
  purchase: CreditPurchase;
  onMarkPaid: (id: string, notes: string) => void;
  onDownload: (id: string, invoiceNumber: string | null) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [notes, setNotes] = useState(purchase.adminNotes ?? '');
  const [downloading, setDownloading] = useState(false);

  const statusConfig = STATUS_CONFIG[purchase.paymentStatus];
  const StatusIcon = statusConfig.icon;
  const isPayAtStudio = purchase.paymentMethod === 'pay_at_studio';
  const canMarkPaid = purchase.paymentStatus === 'pending' || purchase.paymentStatus === 'overdue';

  async function handleDownload() {
    setDownloading(true);
    await onDownload(purchase.id, purchase.invoiceNumber);
    setDownloading(false);
  }

  return (
    <div className={cn(
      'rounded-2xl border transition-all duration-200',
      'bg-linear-to-br from-[#faf9f7]/90 to-[#f5f3f1]/60',
      isExpanded
        ? 'border-[#c4a88a]/40 shadow-[0_4px_20px_rgba(78,43,34,0.08)]'
        : 'border-[#ede8e5]/80',
    )}>
      {/* ── Summary row ── */}
      <div className="flex items-start gap-3 p-4">
        {/* Status dot — mobile-visible at a glance */}
        <span className={cn(
          'mt-1.5 flex size-2.5 shrink-0 rounded-full',
          purchase.paymentStatus === 'paid'    && 'bg-[#6b8e6b]',
          purchase.paymentStatus === 'pending' && 'bg-[#d4a574]',
          purchase.paymentStatus === 'overdue' && 'bg-[#c45c4a]',
          purchase.paymentStatus === 'failed'  && 'bg-[#8b6b5c]',
          purchase.paymentStatus === 'cancelled' && 'bg-[#c4a88a]',
        )} />

        <div className="flex-1 min-w-0">
          {/* Name + email */}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-semibold text-[#4e2b22] truncate">
              {purchase.userName ?? 'Unknown'}
            </span>
            <span className="text-[#8b6b5c] text-xs truncate max-w-[180px] sm:max-w-none">
              {purchase.userEmail}
            </span>
          </div>

          {/* Package info row */}
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <Badge
              variant="outline"
              className={cn('text-xs rounded-full', LEGACY_CREDIT_TYPE_STYLES[purchase.creditType])}
            >
              {LEGACY_CREDIT_TYPE_LABELS[purchase.creditType]}
            </Badge>
            <span className="text-sm text-[#6b3d32] truncate">{purchase.packageName}</span>
            <span className="text-sm font-semibold text-[#4e2b22]">
              {formatPrice(purchase.priceCents, purchase.currency)}
            </span>
          </div>

          {/* Invoice number (visible when present) */}
          {purchase.invoiceNumber && (
            <p className="text-xs text-[#a6856f] mt-1 font-mono">{purchase.invoiceNumber}</p>
          )}
        </div>

        {/* Right side: status + actions */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Badge variant="outline" className={cn('rounded-full text-xs', statusConfig.color)}>
            <StatusIcon className="size-3 mr-1" />
            {statusConfig.label}
          </Badge>

          <div className="flex items-center gap-1">
            {/* Download invoice */}
            {purchase.invoiceNumber && (
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                aria-label={`Download invoice ${purchase.invoiceNumber}`}
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg border transition-all active:scale-95',
                  downloading
                    ? 'border-[#ede8e5] text-[#c4a88a] cursor-wait'
                    : 'border-[#ede8e5] text-[#8b6b5c] hover:border-[#c4a88a] hover:text-[#4e2b22] hover:bg-[#fdf8f5]',
                )}
              >
                {downloading ? (
                  <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Download className="size-3.5" />
                )}
              </button>
            )}

            {/* Expand/collapse */}
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Collapse details' : 'Show details'}
              className="flex size-8 items-center justify-center rounded-lg border border-[#ede8e5] text-[#8b6b5c] transition-all hover:border-[#c4a88a] hover:text-[#4e2b22] hover:bg-[#fdf8f5] active:scale-95"
            >
              {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Expanded details ── */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-[#ede8e5]/60 animate-in slide-in-from-top-2 duration-200">
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/60 text-[#8b6b5c]">
                <Store className="size-3.5" />
              </span>
              <span className="text-[#8b6b5c]">Method</span>
              <span className="text-[#4e2b22] font-medium">
                {isPayAtStudio ? 'Pay at Studio' : 'Stripe'}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/60 text-[#8b6b5c]">
                <Calendar className="size-3.5" />
              </span>
              <span className="text-[#8b6b5c]">Purchased</span>
              <span className="text-[#4e2b22]">
                {format(new Date(purchase.createdAt), 'MMM d, yyyy')}
              </span>
            </div>

            {purchase.paymentDueDate && (
              <div className="flex items-center gap-2 text-sm">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/60 text-[#8b6b5c]">
                  <Clock className="size-3.5" />
                </span>
                <span className="text-[#8b6b5c]">Due Date</span>
                <span className={cn(
                  'font-medium',
                  purchase.paymentStatus === 'overdue' ? 'text-[#c45c4a]' : 'text-[#4e2b22]',
                )}>
                  {format(new Date(purchase.paymentDueDate), 'MMM d, yyyy')}
                </span>
              </div>
            )}

            {purchase.paidAt && (
              <div className="flex items-center gap-2 text-sm">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#6b8e6b]/15 text-[#4a7c4a]">
                  <CheckCircle className="size-3.5" />
                </span>
                <span className="text-[#8b6b5c]">Paid</span>
                <span className="text-[#4a7c4a] font-medium">
                  {format(new Date(purchase.paidAt), 'MMM d, yyyy')}
                </span>
              </div>
            )}
          </div>

          {/* Admin notes (read-only when already paid) */}
          {purchase.adminNotes && !canMarkPaid && (
            <div className="mb-4 rounded-xl bg-[#ede8e5]/40 px-4 py-3">
              <p className="text-xs text-[#8b6b5c] mb-1">Admin Notes</p>
              <p className="text-sm text-[#6b3d32]">{purchase.adminNotes}</p>
            </div>
          )}

          {/* Mark as paid form */}
          {canMarkPaid && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-sm text-[#8b6b5c] mb-1.5 block font-medium">
                  Admin Notes <span className="font-normal text-[#a6856f]">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Paid in cash, receipt no. 1234…"
                  className="w-full rounded-xl border border-[#ede8e5] bg-[#faf9f7]/80 px-3 py-2 text-sm text-[#4e2b22] placeholder:text-[#a6856f] focus:border-[#c4a88a] focus:outline-none resize-none transition-colors"
                  rows={2}
                />
              </div>
              <Button
                variant="boutique"
                size="sm"
                className="w-full gap-2"
                onClick={() => onMarkPaid(purchase.id, notes)}
              >
                <Banknote className="size-4" />
                Mark as Paid
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-24 rounded-2xl bg-gradient-to-br from-[#ede8e5]/40 to-[#e5dfdb]/30 animate-pulse" />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPaymentsPage() {
  const { toasts, show: showToast, dismiss } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [purchases, setPurchases] = useState<CreditPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPurchases = useCallback(async () => {
    try {
      const data = await fetchPurchases();
      setPurchases(data);
    } catch {
      showToast('Failed to load purchases. Please refresh.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadPurchases(); }, [loadPurchases]);

  const stats = useMemo(() => {
    const paid     = purchases.filter((p) => p.paymentStatus === 'paid').length;
    const pending  = purchases.filter((p) => p.paymentStatus === 'pending').length;
    const overdue  = purchases.filter((p) => p.paymentStatus === 'overdue').length;
    const totalRevenue = purchases
      .filter((p) => p.paymentStatus === 'paid')
      .reduce((sum, p) => sum + p.priceCents, 0);
    const outstanding = purchases
      .filter((p) => p.paymentStatus === 'pending' || p.paymentStatus === 'overdue')
      .reduce((sum, p) => sum + p.priceCents, 0);
    return { total: purchases.length, paid, pending, overdue, totalRevenue, outstanding };
  }, [purchases]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const matchesStatus =
        statusFilter === 'all'         ? true :
        statusFilter === 'pay_at_studio' ? p.paymentMethod === 'pay_at_studio' :
        p.paymentStatus === statusFilter;

      const q = searchQuery.toLowerCase();
      const matchesSearch = searchQuery === '' ? true : (
        (p.userName  ?? '').toLowerCase().includes(q) ||
        (p.userEmail ?? '').toLowerCase().includes(q) ||
        (p.packageName ?? '').toLowerCase().includes(q) ||
        (p.invoiceNumber ?? '').toLowerCase().includes(q)
      );

      return matchesStatus && matchesSearch;
    });
  }, [purchases, statusFilter, searchQuery]);

  async function handleMarkPaid(id: string, notes: string) {
    try {
      await updatePurchaseStatus(id, 'paid', notes);
      await loadPurchases();
      showToast('Payment marked as paid successfully.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update payment';
      showToast(msg, 'error');
    }
  }

  async function handleDownloadInvoice(purchaseId: string, invoiceNumber: string | null) {
    try {
      showToast('Generating PDF…', 'info');
      const res = await fetch(`/api/admin/purchases/${purchaseId}/invoice`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to generate invoice');
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `Invoice-${invoiceNumber ?? purchaseId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Invoice ${invoiceNumber} downloaded.`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to download invoice';
      showToast(msg, 'error');
    }
  }

  const filterButtons: { label: string; value: StatusFilter; count?: number }[] = [
    { label: 'All',           value: 'all',           count: stats.total },
    { label: 'Pending',       value: 'pending',        count: stats.pending },
    { label: 'Paid',          value: 'paid',           count: stats.paid },
    { label: 'Overdue',       value: 'overdue',        count: stats.overdue },
    { label: 'Pay at Studio', value: 'pay_at_studio' },
  ];

  return (
    <div className="space-y-6">
      {/* Toast notification layer */}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* Header */}
      <div>
        <p className="text-[#6b3d32] text-sm font-medium">Financial Overview</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#4e2b22]">Payment Management</h1>
        <p className="mt-1.5 text-[#6b3d32] text-sm">
          Manage credit purchases, track payments, and download invoices
        </p>
      </div>

      {/* Stats — 2-col on mobile, 4-col on lg */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total"
          value={stats.total}
          subtitle="All time"
          color="primary"
        />
        <StatCard
          title="Paid"
          value={stats.paid}
          subtitle={formatPrice(stats.totalRevenue, 'eur')}
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
          subtitle={`${formatPrice(stats.outstanding, 'eur')} outstanding`}
          color="danger"
        />
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#8b6b5c]" />
          <input
            type="search"
            placeholder="Search name, email, package, or invoice number…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#ede8e5] bg-[#faf9f7]/80 text-[#4e2b22] placeholder:text-[#a6856f] focus:border-[#c4a88a] focus:outline-none transition-colors text-sm"
          />
        </div>

        {/* Filter chips — horizontal scroll on mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          <Filter className="size-4 text-[#8b6b5c] shrink-0" />
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              type="button"
              onClick={() => setStatusFilter(btn.value)}
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-all active:scale-95',
                statusFilter === btn.value
                  ? 'bg-[#4e2b22] text-[#faf9f7] shadow-sm'
                  : 'border border-[#ede8e5] text-[#6b3d32] hover:border-[#c4a88a] hover:text-[#4e2b22]',
              )}
            >
              {btn.label}
              {btn.count !== undefined && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  statusFilter === btn.value
                    ? 'bg-white/20 text-white'
                    : 'bg-[#ede8e5] text-[#6b3d32]',
                )}>
                  {btn.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      {!loading && (
        <p className="text-xs text-[#8b6b5c]">
          {filteredPurchases.length === 0
            ? 'No results'
            : `Showing ${filteredPurchases.length} of ${purchases.length} purchases`}
        </p>
      )}

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <LoadingSkeleton />
        ) : filteredPurchases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-[#ede8e5]/60">
              <Search className="size-7 text-[#c4a88a]" />
            </div>
            <p className="text-sm font-semibold text-[#4e2b22]">No purchases found</p>
            <p className="mt-1 text-xs text-[#8b6b5c]">Try adjusting your search or filter</p>
          </div>
        ) : (
          filteredPurchases.map((purchase) => (
            <PurchaseRow
              key={purchase.id}
              purchase={purchase}
              onMarkPaid={handleMarkPaid}
              onDownload={handleDownloadInvoice}
            />
          ))
        )}
      </div>
    </div>
  );
}
