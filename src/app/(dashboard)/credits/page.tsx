'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays } from 'date-fns';
import { CreditCard, Store, CheckCircle, Clock, TicketIcon, WalletCardsIcon, BanknoteIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Types
interface CreditPackage {
  id: string;
  name: string;
  description: string | null;
  creditsAmount: number;
  creditType: 'mat_group' | 'reformer_group' | 'private_session';
  priceCents: number;
  currency: string;
  validityDays: number;
}

type PaymentMethod = 'stripe' | 'pay_at_studio';

const CREDIT_TYPE_COLORS = {
  mat_group: 'bg-[#6b8e6b]/10 border-[#6b8e6b]/30 text-[#4a7c4a]',
  reformer_group: 'bg-[#8b5a3c]/10 border-[#c4a88a]/40 text-[#4e2b22]',
  private_session: 'bg-[#4e2b22]/10 border-[#4e2b22]/20 text-[#4e2b22]',
};

const CREDIT_TYPE_LABELS = {
  mat_group: 'Mat Class',
  reformer_group: 'Reformer Class',
  private_session: 'Private Session',
};

// Fetch credit packages from database
async function fetchCreditPackages(): Promise<CreditPackage[]> {
  try {
    const response = await fetch('/api/credit-packages');
    if (!response.ok) throw new Error('Failed to fetch packages');
    return await response.json();
  } catch (error) {
    console.error('Error fetching credit packages:', error);
    // Fallback to mock data for development
    return [
      {
        id: '1',
        name: 'Mat Starter Pack',
        description: '5 group mat classes - perfect for beginners',
        creditsAmount: 5,
        creditType: 'mat_group',
        priceCents: 7500,
        currency: 'eur',
        validityDays: 90,
      },
      {
        id: '2',
        name: 'Mat Regular Pack',
        description: '10 group mat classes - most popular',
        creditsAmount: 10,
        creditType: 'mat_group',
        priceCents: 14000,
        currency: 'eur',
        validityDays: 180,
      },
      {
        id: '3',
        name: 'Reformer Starter Pack',
        description: '5 reformer group classes',
        creditsAmount: 5,
        creditType: 'reformer_group',
        priceCents: 10000,
        currency: 'eur',
        validityDays: 90,
      },
      {
        id: '4',
        name: 'Reformer Regular Pack',
        description: '10 reformer group classes',
        creditsAmount: 10,
        creditType: 'reformer_group',
        priceCents: 18000,
        currency: 'eur',
        validityDays: 180,
      },
      {
        id: '5',
        name: 'Private Session Pack',
        description: '3 private sessions (1:1 or 1:2)',
        creditsAmount: 3,
        creditType: 'private_session',
        priceCents: 24000,
        currency: 'eur',
        validityDays: 365,
      },
    ];
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
            CREDIT_TYPE_COLORS[pkg.creditType]
          )}
        >
          {CREDIT_TYPE_LABELS[pkg.creditType]}
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

  // Fetch credit packages on mount
  useEffect(() => {
    fetchCreditPackages().then((data) => {
      setPackages(data);
      setLoading(false);
    });
  }, []);

  const selectedPkg = packages.find((p) => p.id === selectedPackage);

  async function handlePurchase() {
    if (!selectedPkg) return;

    setIsProcessing(true);

    try {
      // Get current user ID (this would come from auth context)
      // For now, using a mock user ID
      const userId = 'mock-user-id';

      const response = await fetch('/api/credit-purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: selectedPkg.id,
          userId,
          paymentMethod,
        }),
      });

      if (!response.ok) {
        throw new Error('Purchase failed');
      }

      const data = await response.json();

      setPurchaseDetails({
        packageName: selectedPkg.name,
        dueDate: data.dueDate ? format(new Date(data.dueDate), 'MMMM d, yyyy') : 'Paid',
      });
      setPurchaseComplete(true);
    } catch (error) {
      console.error('Purchase failed:', error);
      // Show error message to user
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
          <h1 className="text-2xl font-bold text-primary mb-2">Purchase Requested!</h1>
          <p className="text-muted">
            Your {purchaseDetails.packageName} is reserved
          </p>
        </div>

        <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/90 to-[#ede8e5]/40 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-[#d4a574]/10">
              <Clock className="size-5 text-[#d4a574]" />
            </div>
            <div>
              <p className="font-semibold text-primary">Payment Due Date</p>
              <p className="text-sm text-secondary">{purchaseDetails.dueDate}</p>
            </div>
          </div>
          <p className="text-sm text-muted">
            Please visit the studio and pay within 14 days to activate your credits.
            Your credits will be added to your account once payment is confirmed.
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
      {/* Header */}
      <div>
        <p className="text-sm font-medium text-[#6b3d32]">Purchase Credits</p>
        <h1 className="mt-1 text-2xl font-bold text-[#4e2b22]">Buy Class Credits</h1>
        <p className="mt-2 text-sm text-[#6b3d32]">
          Select a credit package and payment method to get started
        </p>
      </div>

      {/* Credit Packages */}
      <section>
        <div className="flex items-center gap-2.5 mb-4">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/80 text-[#6b3d32]">
            <WalletCardsIcon className="size-4" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold text-[#4e2b22]">Available Packages</h2>
        </div>
        {loading ? (
          <div className="text-center py-8">
            <p className="text-sm text-[#6b3d32]">Loading packages...</p>
          </div>
        ) : (
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
        )}
      </section>

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
                  {selectedPkg?.creditsAmount} {CREDIT_TYPE_LABELS[selectedPkg?.creditType || 'mat_group']}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Payment Method</span>
                <span className="font-medium text-primary">
                  {paymentMethod === 'pay_at_studio' ? 'Pay at Studio' : 'Stripe'}
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
                  <span className="font-medium">Pay at Studio:</span> You will have{' '}
                  <span className="font-semibold">14 days</span> to complete your payment at the
                  studio. Your credits will be activated once payment is received.
                </p>
              </div>
            )}

            <Button
              variant="boutique"
              className="w-full"
              onClick={handlePurchase}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Complete Purchase'}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
