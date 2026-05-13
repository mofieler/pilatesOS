'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, addDays } from 'date-fns';
import { CreditCard, Store, CheckCircle, Clock, TicketIcon, WalletCardsIcon, BanknoteIcon, AlertCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import { LEGACY_CREDIT_TYPE_LABELS, LEGACY_CREDIT_TYPE_STYLES } from '@/lib/config/class-types';
import { BillsSection } from '@/modules/billing/components/BillsSection';
import { useSearchParams } from 'next/navigation';

// Types - match database schema exactly
interface CreditPackage {
  id: string;
  name: string;
  description: string | null;
  creditsAmount: number;
  creditType: 'reformer' | 'mat';
  priceCents: number;
  currency: string;
  validityDays: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

type PaymentMethod = 'stripe' | 'pay_at_studio';

// Fetch credit packages from API
async function fetchCreditPackages(): Promise<CreditPackage[]> {
  try {
    const response = await fetch('/api/credit-packages', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Ensure fresh data
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch packages (${response.status})`);
    }
    
    const data = await response.json();
    
    // Validate response is an array
    if (!Array.isArray(data)) {
      console.error('Invalid API response:', data);
      return [];
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching credit packages:', error);
    // Return empty array if fetch fails
    return [];
  }
}

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function PackageCard({
  pkg,
  isSelected,
  onSelect,
}: {
  pkg: CreditPackage;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'relative w-full text-left rounded-2xl border p-5 transition-all duration-300',
        'bg-gradient-to-br from-[#faf9f7]/90 to-[#f5f3f1]/80',
        'backdrop-blur-xl',
        isSelected
          ? 'border-[#4e2b22] shadow-[0_8px_30px_rgba(78,43,34,0.12)]'
          : 'border-[#ede8e5]/80 shadow-[0_4px_20px_rgba(78,43,34,0.04)] hover:border-[#c4a88a]/40 hover:shadow-[0_8px_30px_rgba(78,43,34,0.08)]'
      )}
    >
      {isSelected && (
        <div className="absolute top-3 right-3">
          <CheckCircle className="size-6 text-[#4e2b22]" />
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-primary">{pkg.name}</h3>
          {pkg.description && (
            <p className="text-sm text-muted mt-1">{pkg.description}</p>
          )}
        </div>
        <Badge
          variant="outline"
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium capitalize',
            LEGACY_CREDIT_TYPE_STYLES[pkg.creditType]
          )}
        >
          {LEGACY_CREDIT_TYPE_LABELS[pkg.creditType] || pkg.creditType.replace('_', ' ')}
        </Badge>
      </div>

      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-3xl font-bold text-primary">
          {formatPrice(pkg.priceCents, pkg.currency)}
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span className="inline-flex items-center gap-1.5 text-secondary">
          <TicketIcon className="size-4 text-[#6b3d32]" aria-hidden />
          <span className="font-medium">{pkg.creditsAmount} credits</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted">
          <Clock className="size-4" />
          <span>Valid for {pkg.validityDays} days</span>
        </span>
      </div>
    </button>
  );
}

function PaymentMethodCard({
  method,
  isSelected,
  onSelect,
  disabled,
}: {
  method: PaymentMethod;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const isStripe = method === 'stripe';

  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'relative w-full text-left rounded-xl border p-4 transition-all duration-200',
        'bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40',
        disabled && 'opacity-50 cursor-not-allowed',
        isSelected && !disabled
          ? 'border-[#4e2b22] shadow-[0_4px_14px_rgba(78,43,34,0.08)]'
          : 'border-[#ede8e5]/60 hover:border-[#c4a88a]/40'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex size-10 items-center justify-center rounded-full',
            isStripe ? 'bg-[#ede8e5]' : 'bg-[#6b8e6b]/10'
          )}
        >
          {isStripe ? (
            <CreditCard className="size-5 text-[#4e2b22]" />
          ) : (
            <Store className="size-5 text-[#6b8e6b]" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-primary">
              {isStripe ? 'Pay with Card (Stripe)' : 'Pay at Studio'}
            </span>
            {isStripe && (
              <Badge variant="outline" className="text-xs bg-[#ede8e5]/50 text-muted">
                Coming Soon
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted">
            {isStripe
              ? 'Secure online payment (temporarily disabled)'
              : 'Pay in person within 14 days'}
          </p>
        </div>
        {isSelected && !disabled && (
          <CheckCircle className="size-5 text-[#4e2b22]" />
        )}
      </div>
    </button>
  );
}

export default function CreditsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pay_at_studio');
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [purchaseDetails, setPurchaseDetails] = useState<{
    packageName: string;
    dueDate: string;
  } | null>(null);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  // Legal consent — required by German Button-Lösung (§ 312j BGB)
  // and § 356 Abs. 5 BGB (for immediately delivered digital services)
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedWithdrawal, setAcceptedWithdrawal] = useState(false);

  // Tab functionality
  const currentTab = searchParams.get('tab') || 'purchase';
  const isBillsTab = currentTab === 'bills';
  const isPurchaseTab = currentTab === 'purchase';

  // Fetch credit packages on mount
  useEffect(() => {
    fetchCreditPackages().then((data) => {
      setPackages(data);
      setLoading(false);
      setError(null);
    }).catch((err) => {
      setError('Failed to load credit packages. Please try again later.');
      setLoading(false);
    });
  }, []);

  const selectedPkg = packages.find((p) => p.id === selectedPackage);
  const hasPackages = packages.length > 0;

  async function handlePurchase() {
    if (!selectedPkg || !session?.user?.id) {
      setPurchaseError('Authentication required. Please sign in.');
      return;
    }
    if (!acceptedTerms) {
      setPurchaseError('Please accept the Terms & Conditions and Privacy Policy before ordering.');
      return;
    }
    if (!acceptedWithdrawal) {
      setPurchaseError('Please confirm the withdrawal waiver before ordering.');
      return;
    }

    setIsProcessing(true);
    setPurchaseError(null);

    try {
      const response = await fetch('/api/credit-purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: selectedPkg.id,
          userId: session.user.id,
          paymentMethod,
          acceptedTerms,
          acceptedWithdrawal,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Purchase failed (${response.status})`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Purchase failed');
      }

      setPurchaseDetails({
        packageName: selectedPkg.name,
        dueDate: data.dueDate ? format(new Date(data.dueDate), 'MMMM d, yyyy') : 'Paid',
      });
      setPurchaseComplete(true);
    } catch (error) {
      console.error('Purchase failed:', error);
      setPurchaseError(error instanceof Error ? error.message : 'Purchase failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }

  if (purchaseComplete && purchaseDetails) {
    return (
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-16 rounded-full bg-[#6b8e6b]/10 mb-4">
            <CheckCircle className="size-8 text-[#6b8e6b]" />
          </div>
          <h1 className="text-2xl font-bold text-primary mb-2">Credits added — book away!</h1>
          <p className="text-muted">
            Your {purchaseDetails.packageName} is already in your account.
          </p>
        </div>

        <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/90 to-[#ede8e5]/40 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-[#d4a574]/10">
              <Clock className="size-5 text-[#d4a574]" />
            </div>
            <div>
              <p className="font-semibold text-primary">Payment due at the studio by</p>
              <p className="text-sm text-secondary">{purchaseDetails.dueDate}</p>
            </div>
          </div>
          <p className="text-sm text-muted">
            Your credits are <strong>already available</strong> — you can book classes right away.
            Please bring the invoice amount in cash or by card to the studio within the next 14 days.
            Your invoice (PDF) has been sent to your email.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-[#ede8e5] text-secondary"
            onClick={() => router.push('/')}
          >
            Go to Dashboard
          </Button>
          <Button
            variant="boutique"
            className="flex-1"
            onClick={() => {
              setPurchaseComplete(false);
              setSelectedPackage(null);
            }}
          >
            Buy More Credits
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with Tabs */}
      <div>
        <p className="text-sm font-medium text-[#6b3d32]">Credit Management</p>
        <h1 className="mt-1 text-3xl font-bold text-[#4e2b22]">
          {isBillsTab ? 'Bills & History' : 'Buy Class Credits'}
        </h1>
        <p className="mt-2 text-sm text-[#6b3d32]">
          {isBillsTab 
            ? 'View your billing history and manage open invoices'
            : 'Select a credit package and payment method to get started'
          }
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-[#ede8e5] bg-[#faf9f7]/80 p-0.5">
        <button
          onClick={() => router.push('/credits?tab=purchase')}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all',
            isPurchaseTab
              ? 'bg-[#faf9f7] text-[#4e2b22] shadow-sm ring-1 ring-[#ede8e5]'
              : 'text-[#8b6b5c] hover:text-[#6b3d32]'
          )}
        >
          <WalletCardsIcon className="size-3.5" />
          Buy Credits
        </button>
        <button
          onClick={() => router.push('/credits?tab=bills')}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all',
            isBillsTab
              ? 'bg-[#faf9f7] text-[#4e2b22] shadow-sm ring-1 ring-[#ede8e5]'
              : 'text-[#8b6b5c] hover:text-[#6b3d32]'
          )}
        >
          <FileText className="size-3.5" />
          Bills
        </button>
      </div>

      {/* Error State - only show if there's an actual error and packages exist */}
      {error && packages.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Credit Packages */}
      {!loading && (
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/80 text-[#6b3d32]">
              <WalletCardsIcon className="size-4" aria-hidden />
            </span>
            <h2 className="text-lg font-semibold text-[#4e2b22]">
              {hasPackages ? 'Available Packages' : 'No Credit Packages'}
            </h2>
          </div>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-sm text-[#6b3d32]">Loading packages...</p>
            </div>
          ) : hasPackages ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {packages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  isSelected={selectedPackage === pkg.id}
                  onSelect={() => setSelectedPackage(pkg.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-[#ede8e5]/50 bg-gradient-to-br from-[#faf9f7] to-[#f5f3f1] p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#c4a88a]/20 mb-4">
                <WalletCardsIcon className="w-8 h-8 text-[#c4a88a]" />
              </div>
              <h2 className="text-xl font-semibold text-[#4e2b22] mb-3">No Credit Packages Available</h2>
              <p className="text-[#6b3d32] mb-6 max-w-md mx-auto">
                Credit packages haven't been configured yet. Please contact your studio directly to purchase credits.
              </p>
              
              <div className="bg-white/80 rounded-lg p-6 text-left max-w-2xl mx-auto">
                <h3 className="text-lg font-semibold text-[#4e2b22] mb-4">What to do next?</h3>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#4a7c4a]/20 flex items-center justify-center text-sm font-semibold text-[#4a7c4a]">1</div>
                    <div>
                      <h4 className="font-medium text-[#4e2b22]">Contact Your Studio</h4>
                      <p className="text-sm text-[#8b6b5c] mt-1">Reach out to your Pilateq studio to inquire about available credit packages and pricing.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#c4a88a]/20 flex items-center justify-center text-sm font-semibold text-[#c4a88a]">2</div>
                    <div>
                      <h4 className="font-medium text-[#4e2b22]">Check Back Later</h4>
                      <p className="text-sm text-[#8b6b5c] mt-1">Credit packages may be configured soon. Check back periodically for updates.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#4e2b22]/20 flex items-center justify-center text-sm font-semibold text-[#4e2b22]">3</div>
                    <div>
                      <h4 className="font-medium text-[#4e2b22]">Visit Studio Website</h4>
                      <p className="text-sm text-[#8b6b5c] mt-1">Some studios offer online credit purchase through their website.</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 pt-4 border-t border-[#ede8e5]/50">
                  <p className="text-xs text-[#8b6b5c]">
                    <strong>Need help?</strong> Contact your studio administrator for assistance with credit packages and account management.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Purchase Error */}
      {purchaseError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="size-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Purchase Error</p>
            <p>{purchaseError}</p>
          </div>
        </div>
      )}

      {/* Payment Method */}
      {selectedPackage && (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/80 text-[#6b3d32]">
              <BanknoteIcon className="size-4" aria-hidden />
            </span>
            <h2 className="text-lg font-semibold text-[#4e2b22]">Payment Method</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <PaymentMethodCard
              method="stripe"
              isSelected={paymentMethod === 'stripe'}
              onSelect={() => setPaymentMethod('stripe')}
              disabled={true} // Disabled for now
            />
            <PaymentMethodCard
              method="pay_at_studio"
              isSelected={paymentMethod === 'pay_at_studio'}
              onSelect={() => setPaymentMethod('pay_at_studio')}
            />
          </div>

          {/* Order Summary */}
          <div className="mt-6 rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6">
            <h3 className="font-semibold text-[#4e2b22] mb-4">Order Summary</h3>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-[#6b3d32]">Package</span>
                <span className="font-medium text-[#4e2b22]">{selectedPkg?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6b3d32]">Credits</span>
                <span className="font-medium text-[#4e2b22]">
                  {selectedPkg?.creditsAmount} {LEGACY_CREDIT_TYPE_LABELS[selectedPkg?.creditType || 'mat_group'] || selectedPkg?.creditType?.replace('_', ' ') || 'credits'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Payment Method</span>
                <span className="font-medium text-primary">
                  {paymentMethod === 'pay_at_studio' ? 'Pay at Studio' : 'Stripe'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6b3d32]">Valid until</span>
                <span className="font-medium text-[#4e2b22]">
                  {selectedPkg && format(addDays(new Date(), selectedPkg.validityDays), 'd MMM yyyy')}
                </span>
              </div>
              <div className="border-t border-[#ede8e5] pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-[#4e2b22]">Total</span>
                  <span className="font-bold text-lg text-[#4e2b22]">
                    {selectedPkg && formatPrice(selectedPkg.priceCents, selectedPkg.currency)}
                  </span>
                </div>
              </div>
            </div>

            {paymentMethod === 'pay_at_studio' && (
              <div className="rounded-xl bg-[#d4a574]/10 p-4 mb-4">
                <p className="text-sm text-secondary">
                  <span className="font-medium">Pay at Studio:</span> Your credits are added to your
                  account <span className="font-semibold">immediately</span> so you can book classes
                  right away. Please bring the invoice amount to the studio within{' '}
                  <span className="font-semibold">14 days</span>. An invoice (PDF) will be emailed
                  to you. If overdue, further purchases and bookings are paused until the invoice is
                  settled.
                </p>
              </div>
            )}

            {/* Legal consent — Button-Lösung (§ 312j BGB) + withdrawal waiver (§ 356 V BGB) */}
            <div className="space-y-3 mb-4">
              {/* Checkbox 1: T&Cs + Privacy — required, no pre-selection */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-[#c4a88a] text-[#4e2b22] focus:ring-[#4e2b22]"
                />
                <span className="text-xs text-[#6b3d32] leading-relaxed">
                  I have read and accept the{' '}
                  <Link href="/agb" target="_blank" className="text-[#4e2b22] underline underline-offset-2">
                    General Terms and Conditions (T&amp;Cs)
                  </Link>
                  {' '}– including the Liability Waiver and Cancellation Policy – and the{' '}
                  <Link href="/datenschutz" target="_blank" className="text-[#4e2b22] underline underline-offset-2">
                    Privacy Policy
                  </Link>.
                </span>
              </label>

              {/* Checkbox 2: Withdrawal waiver — required, no pre-selection */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedWithdrawal}
                  onChange={(e) => setAcceptedWithdrawal(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-[#c4a88a] text-[#4e2b22] focus:ring-[#4e2b22]"
                />
                <span className="text-xs text-[#6b3d32] leading-relaxed">
                  I expressly consent to the immediate performance of the contract and acknowledge
                  that I lose my statutory 14-day right of withdrawal once the credits are credited
                  to my account.
                </span>
              </label>

              {/* Right of Withdrawal information */}
              <div className="text-xs text-[#6b3d32] leading-relaxed p-3 bg-[#ede8e5]/30 rounded-lg">
                <strong>Right of Withdrawal Information:</strong> By purchasing these credits, you
                request that the service begins immediately. Please note that you waive your
                statutory 14-day right of withdrawal as soon as the credits are fully provisioned
                in your account. For more details, please read our{' '}
                <Link href="/widerrufsrecht" target="_blank" className="text-[#4e2b22] underline underline-offset-2">
                  Terms of Cancellation
                </Link>.
              </div>
            </div>

            <Button
              variant="boutique"
              className="w-full"
              onClick={handlePurchase}
              disabled={
                isProcessing ||
                status !== 'authenticated' ||
                !acceptedTerms ||
                !acceptedWithdrawal
              }
            >
              {isProcessing
                ? 'Processing...'
                : status !== 'authenticated'
                  ? 'Please sign in'
                  : 'Buy now – binding order'}
            </Button>
            <p className="text-[10px] text-center text-[#a6856f] mt-2 leading-snug">
              By clicking this button you place a binding order. Payment is due in person at the studio within 14 days.
            </p>
          </div>
        </section>
      )}

      {/* Bills Section */}
      <BillsSection isOpen={isBillsTab} />
    </div>
  );
}
