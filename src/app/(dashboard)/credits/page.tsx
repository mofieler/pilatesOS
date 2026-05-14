'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, addDays } from 'date-fns';
import {
  CreditCard, Store, CheckCircle, Clock, WalletCardsIcon, BanknoteIcon,
  AlertCircle, FileText, BadgeCheckIcon, Dumbbell, Users, User, Users2, Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import { BillsSection } from '@/modules/billing/components/BillsSection';
import { MembershipShopSection } from '@/modules/billing/components/MembershipShopSection';
import { useSearchParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreditPackage {
  id: string;
  name: string;
  description: string | null;
  creditsAmount: number;
  creditType: 'reformer' | 'mat' | 'group' | 'session';
  category: 'credit' | 'session';
  classType: string | null;
  priceCents: number;
  currency: string;
  validityDays: number;
  validityWeeks: number;
  isActive: boolean;
  sortOrder: number;
}

type PaymentMethod = 'stripe' | 'pay_at_studio';

// ─── Package section config (add new category = add one entry here) ───────────

type CardStyle = 'group' | 'tier';

interface PackageSectionConfig {
  key: string;
  icon: LucideIcon;
  label: string;
  description: string;
  accentClass: string;
  cardStyle: CardStyle;
  filter: (p: CreditPackage) => boolean;
  footnote?: string;
}

const PACKAGE_SECTIONS: PackageSectionConfig[] = [
  {
    key: 'reformer-group',
    icon: Dumbbell,
    label: 'Reformer Group Classes',
    description: 'Reformer group classes only — Return to Life or Bloom',
    accentClass: 'bg-[#8b5a3c]/10 text-[#6b3d32]',
    cardStyle: 'group',
    filter: (p) => p.category === 'credit' && p.creditType === 'reformer',
  },
  {
    key: 'all-group',
    icon: Users,
    label: 'All Group Classes',
    description: 'Yoga · Chair Pilates · Sound Healing · Reformer & Mat group classes',
    accentClass: 'bg-[#c4a88a]/20 text-[#6b3d32]',
    cardStyle: 'group',
    filter: (p) => p.category === 'credit' && p.creditType === 'group',
  },
  {
    key: 'private-sessions',
    icon: User,
    label: 'Private Sessions',
    description: '1-on-1 reformer sessions with your instructor',
    accentClass: 'bg-[#4e2b22]/10 text-[#4e2b22]',
    cardStyle: 'tier',
    filter: (p) => p.category === 'session' && p.name.toLowerCase().includes('private'),
  },
  {
    key: 'duo-sessions',
    icon: Users2,
    label: 'Duo Sessions',
    description: 'Train together on the reformer',
    accentClass: 'bg-[#6b8e6b]/10 text-[#4a7c4a]',
    cardStyle: 'tier',
    filter: (p) => p.category === 'session' && p.name.toLowerCase().includes('duo'),
    footnote: 'Price per person · Duo packs must be used with the same partner',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatValidity(days: number): string {
  const weeks = Math.round(days / 7);
  return `${weeks} week${weeks !== 1 ? 's' : ''}`;
}

function findBestValueId(pkgs: CreditPackage[]): string | null {
  if (pkgs.length < 2) return null;
  return [...pkgs].sort(
    (a, b) => a.priceCents / a.creditsAmount - b.priceCents / b.creditsAmount,
  )[0].id;
}

// ─── GroupPackageCard (2-up grid, for credit packages) ────────────────────────

function GroupPackageCard({
  pkg, isSelected, onSelect, isBestValue,
}: {
  pkg: CreditPackage;
  isSelected: boolean;
  onSelect: () => void;
  isBestValue: boolean;
}) {
  const pricePerUnit = pkg.priceCents / pkg.creditsAmount;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex w-full flex-col gap-3 rounded-2xl border p-5 text-left transition-all duration-200',
        isSelected
          ? 'border-[#4e2b22] bg-[#4e2b22]/5 shadow-[0_8px_28px_rgba(78,43,34,0.12)] ring-1 ring-[#4e2b22]/20'
          : 'border-[#ede8e5]/80 bg-white/70 hover:border-[#c4a88a]/60 hover:shadow-[0_4px_20px_rgba(78,43,34,0.07)]',
      )}
    >
      {/* Badges */}
      {isSelected ? (
        <CheckCircle className="absolute right-3.5 top-3.5 size-5 text-[#4e2b22]" aria-hidden />
      ) : isBestValue ? (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#4a7c4a]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#4a7c4a]">
          <Star className="size-2.5 fill-[#4a7c4a]" aria-hidden />
          Best value
        </span>
      ) : null}

      {/* Name + description */}
      <div className="pr-16">
        <h4 className="text-base font-bold text-[#4e2b22]">{pkg.name}</h4>
        {pkg.description && (
          <p className="mt-0.5 text-[11px] text-[#8b6b5c]">{pkg.description}</p>
        )}
      </div>

      {/* Price */}
      <div>
        <p className="text-2xl font-bold tracking-tight text-[#4e2b22]">
          {formatPrice(pkg.priceCents, pkg.currency)}
        </p>
        <p className="mt-0.5 text-[11px] text-[#8b6b5c]">
          {pkg.creditsAmount} credits &nbsp;·&nbsp; {formatPrice(pricePerUnit, pkg.currency)} each
        </p>
      </div>

      {/* Validity */}
      <div className="mt-auto flex items-center gap-1.5 text-[11px] text-[#a6856f]">
        <Clock className="size-3 shrink-0" aria-hidden />
        Valid for {formatValidity(pkg.validityDays)}
      </div>
    </button>
  );
}

// ─── SessionTierCard (4-up grid, compact, for session packages) ───────────────

function SessionTierCard({
  pkg, isSelected, onSelect, isBestValue,
}: {
  pkg: CreditPackage;
  isSelected: boolean;
  onSelect: () => void;
  isBestValue: boolean;
}) {
  const pricePerSession = pkg.priceCents / pkg.creditsAmount;
  const weeks = Math.round(pkg.validityDays / 7);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex w-full flex-col gap-1.5 rounded-xl border p-3.5 text-left transition-all duration-200',
        isSelected
          ? 'border-[#4e2b22] bg-[#4e2b22]/5 shadow-[0_4px_18px_rgba(78,43,34,0.10)] ring-1 ring-[#4e2b22]/20'
          : 'border-[#ede8e5]/80 bg-white/70 hover:border-[#c4a88a]/60 hover:shadow-[0_4px_14px_rgba(78,43,34,0.06)]',
      )}
    >
      {/* Best value pill sits above the card */}
      {isBestValue && !isSelected && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#4a7c4a] px-2.5 py-0.5 text-[9px] font-semibold text-white">
          Best value
        </span>
      )}
      {isSelected && (
        <CheckCircle className="absolute right-2 top-2 size-4 text-[#4e2b22]" aria-hidden />
      )}

      {/* Sessions count */}
      <p className="text-2xl font-bold tabular-nums leading-none text-[#4e2b22]">
        {pkg.creditsAmount}<span className="text-sm font-semibold">×</span>
      </p>

      {/* Total price */}
      <p className="text-sm font-semibold text-[#4e2b22]">
        {formatPrice(pkg.priceCents, pkg.currency)}
      </p>

      {/* Per-session price */}
      <p className="text-[10px] text-[#8b6b5c]">
        {formatPrice(pricePerSession, pkg.currency)}/session
      </p>

      {/* Validity */}
      <p className="flex items-center gap-1 text-[10px] text-[#a6856f]">
        <Clock className="size-2.5 shrink-0" aria-hidden />
        {weeks}w
      </p>
    </button>
  );
}

// ─── PackageSection (renders one category row) ────────────────────────────────

function PackageSection({
  config, packages, selected, onSelect,
}: {
  config: PackageSectionConfig;
  packages: CreditPackage[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const sectionPkgs = packages.filter(config.filter);
  if (sectionPkgs.length === 0) return null;

  const bestValueId = findBestValueId(sectionPkgs);
  const Icon = config.icon;

  return (
    <div className="rounded-2xl border border-[#ede8e5]/80 bg-linear-to-br from-[#faf9f7]/90 to-[#f5f3f1]/80 p-5 shadow-[0_2px_12px_rgba(78,43,34,0.04)]">
      {/* Section header */}
      <div className="mb-4 flex items-start gap-3">
        <span className={cn('mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl', config.accentClass)}>
          <Icon className="size-4" aria-hidden />
        </span>
        <div>
          <h3 className="text-sm font-bold text-[#4e2b22]">{config.label}</h3>
          <p className="mt-0.5 text-[11px] text-[#8b6b5c]">{config.description}</p>
        </div>
      </div>

      {/* Cards */}
      {config.cardStyle === 'group' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sectionPkgs.map((pkg) => (
            <GroupPackageCard
              key={pkg.id}
              pkg={pkg}
              isSelected={selected === pkg.id}
              onSelect={() => onSelect(pkg.id)}
              isBestValue={pkg.id === bestValueId}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {sectionPkgs.map((pkg) => (
            <SessionTierCard
              key={pkg.id}
              pkg={pkg}
              isSelected={selected === pkg.id}
              onSelect={() => onSelect(pkg.id)}
              isBestValue={pkg.id === bestValueId}
            />
          ))}
        </div>
      )}

      {config.footnote && (
        <p className="mt-3 text-[10px] text-[#a6856f]">{config.footnote}</p>
      )}
    </div>
  );
}

// ─── PaymentMethodCard ────────────────────────────────────────────────────────

function PaymentMethodCard({
  method, isSelected, onSelect, disabled,
}: {
  method: PaymentMethod;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const isStripe = method === 'stripe';

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'relative w-full text-left rounded-xl border p-4 transition-all duration-200',
        'bg-linear-to-br from-[#faf9f7]/80 to-[#ede8e5]/40',
        disabled && 'cursor-not-allowed opacity-50',
        isSelected && !disabled
          ? 'border-[#4e2b22] shadow-[0_4px_14px_rgba(78,43,34,0.08)]'
          : 'border-[#ede8e5]/60 hover:border-[#c4a88a]/40',
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          'flex size-10 items-center justify-center rounded-full',
          isStripe ? 'bg-[#ede8e5]' : 'bg-[#6b8e6b]/10',
        )}>
          {isStripe
            ? <CreditCard className="size-5 text-[#4e2b22]" />
            : <Store className="size-5 text-[#6b8e6b]" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-primary">
              {isStripe ? 'Pay with Card (Stripe)' : 'Pay at Studio'}
            </span>
            {isStripe && (
              <span className="rounded-full border border-[#ede8e5] bg-[#ede8e5]/50 px-2 py-0.5 text-[10px] text-[#8b6b5c]">
                Coming soon
              </span>
            )}
          </div>
          <p className="text-sm text-[#8b6b5c]">
            {isStripe ? 'Secure online payment (temporarily disabled)' : 'Pay in person within 14 days'}
          </p>
        </div>
        {isSelected && !disabled && <CheckCircle className="size-5 text-[#4e2b22]" />}
      </div>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

async function fetchCreditPackages(): Promise<CreditPackage[]> {
  try {
    const res = await fetch('/api/credit-packages', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default function CreditsPage() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const [packages,         setPackages]         = useState<CreditPackage[]>([]);
  const [loading,          setLoading]           = useState(true);
  const [selectedPackage,  setSelectedPackage]   = useState<string | null>(null);
  const [paymentMethod,    setPaymentMethod]     = useState<PaymentMethod>('pay_at_studio');
  const [isProcessing,     setIsProcessing]      = useState(false);
  const [purchaseComplete, setPurchaseComplete]  = useState(false);
  const [purchaseDetails,  setPurchaseDetails]   = useState<{ packageName: string; dueDate: string } | null>(null);
  const [purchaseError,    setPurchaseError]     = useState<string | null>(null);
  const [acceptedTerms,    setAcceptedTerms]     = useState(false);
  const [acceptedWithdrawal, setAcceptedWithdrawal] = useState(false);

  const currentTab      = searchParams.get('tab') || 'purchase';
  const isBillsTab      = currentTab === 'bills';
  const isPurchaseTab   = currentTab === 'purchase';
  const isMembershipTab = currentTab === 'membership';

  useEffect(() => {
    fetchCreditPackages().then((data) => {
      setPackages(data);
      setLoading(false);
    });
  }, []);

  const selectedPkg = packages.find((p) => p.id === selectedPackage);

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
      const res = await fetch('/api/credit-purchases', {
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

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Purchase failed (${res.status})`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Purchase failed');

      setPurchaseDetails({
        packageName: selectedPkg.name,
        dueDate: data.dueDate ? format(new Date(data.dueDate), 'MMMM d, yyyy') : 'Paid',
      });
      setPurchaseComplete(true);
    } catch (error) {
      setPurchaseError(error instanceof Error ? error.message : 'Purchase failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }

  // ── Purchase success screen ──────────────────────────────────────────────────
  if (purchaseComplete && purchaseDetails) {
    return (
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-16 rounded-full bg-[#6b8e6b]/10 mb-4">
            <CheckCircle className="size-8 text-[#6b8e6b]" />
          </div>
          <h1 className="text-2xl font-bold text-primary mb-2">Credits added — book away!</h1>
          <p className="text-[#8b6b5c]">Your {purchaseDetails.packageName} is already in your account.</p>
        </div>

        <div className="rounded-2xl border border-[#ede8e5]/80 bg-linear-to-br from-[#faf9f7]/90 to-[#ede8e5]/40 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-[#d4a574]/10">
              <Clock className="size-5 text-[#d4a574]" />
            </div>
            <div>
              <p className="font-semibold text-primary">Payment due at the studio by</p>
              <p className="text-sm text-[#8b6b5c]">{purchaseDetails.dueDate}</p>
            </div>
          </div>
          <p className="text-sm text-[#6b3d32]">
            Your credits are <strong>already available</strong> — you can book classes right away.
            Please bring the invoice amount in cash or by card to the studio within the next 14 days.
            Your invoice (PDF) has been sent to your email.
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 border-[#ede8e5] text-[#8b6b5c]" onClick={() => router.push('/')}>
            Go to Dashboard
          </Button>
          <Button variant="boutique" className="flex-1" onClick={() => { setPurchaseComplete(false); setSelectedPackage(null); }}>
            Buy More Credits
          </Button>
        </div>
      </div>
    );
  }

  // ── Main page ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <p className="text-sm font-medium text-[#6b3d32]">Credit Management</p>
        <h1 className="mt-1 text-3xl font-bold text-[#4e2b22]">
          {isBillsTab ? 'Bills & History' : isMembershipTab ? 'Memberships' : 'Buy Class Credits'}
        </h1>
        <p className="mt-2 text-sm text-[#6b3d32]">
          {isBillsTab
            ? 'View your billing history and manage open invoices'
            : isMembershipTab
            ? 'Subscribe to a membership plan for weekly credits'
            : 'Select a credit package and payment method to get started'}
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-[#ede8e5] bg-[#faf9f7]/80 p-0.5">
        {([
          { key: 'purchase',   label: 'Buy Credits', icon: WalletCardsIcon },
          { key: 'membership', label: 'Membership',  icon: BadgeCheckIcon  },
          { key: 'bills',      label: 'Bills',        icon: FileText        },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => router.push(`/credits?tab=${key}`)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all',
              currentTab === key
                ? 'bg-[#faf9f7] text-[#4e2b22] shadow-sm ring-1 ring-[#ede8e5]'
                : 'text-[#8b6b5c] hover:text-[#6b3d32]',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {/* Membership tab */}
      {isMembershipTab && <MembershipShopSection />}

      {/* Package sections */}
      {isPurchaseTab && !loading && (
        <div className="space-y-4">
          {packages.length === 0 ? (
            <div className="rounded-xl border border-[#ede8e5]/50 bg-[#faf9f7] p-8 text-center">
              <WalletCardsIcon className="mx-auto mb-3 size-8 text-[#c4a88a]" />
              <p className="font-semibold text-[#4e2b22]">No packages available</p>
              <p className="mt-1 text-sm text-[#8b6b5c]">Please contact the studio for assistance.</p>
            </div>
          ) : (
            PACKAGE_SECTIONS.map((section) => (
              <PackageSection
                key={section.key}
                config={section}
                packages={packages}
                selected={selectedPackage}
                onSelect={setSelectedPackage}
              />
            ))
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {isPurchaseTab && loading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-[#ede8e5]/40" />
          ))}
        </div>
      )}

      {/* Purchase error */}
      {isPurchaseTab && purchaseError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Purchase Error</p>
            <p>{purchaseError}</p>
          </div>
        </div>
      )}

      {/* Payment method + order summary — shown after package selection */}
      {isPurchaseTab && selectedPackage && (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ede8e5]/80 text-[#6b3d32]">
              <BanknoteIcon className="size-4" aria-hidden />
            </span>
            <h2 className="text-lg font-semibold text-[#4e2b22]">Payment Method</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <PaymentMethodCard method="stripe"          isSelected={paymentMethod === 'stripe'}         onSelect={() => setPaymentMethod('stripe')}         disabled={true} />
            <PaymentMethodCard method="pay_at_studio"   isSelected={paymentMethod === 'pay_at_studio'}  onSelect={() => setPaymentMethod('pay_at_studio')} />
          </div>

          {/* Order summary */}
          <div className="mt-6 rounded-2xl border border-[#ede8e5]/80 bg-linear-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6">
            <h3 className="mb-4 font-semibold text-[#4e2b22]">Order Summary</h3>

            <div className="mb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#6b3d32]">Package</span>
                <span className="font-medium text-[#4e2b22]">{selectedPkg?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6b3d32]">
                  {selectedPkg?.category === 'session' ? 'Sessions' : 'Credits'}
                </span>
                <span className="font-medium text-[#4e2b22]">{selectedPkg?.creditsAmount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6b3d32]">Payment</span>
                <span className="font-medium text-[#4e2b22]">
                  {paymentMethod === 'pay_at_studio' ? 'Pay at Studio' : 'Stripe'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6b3d32]">Valid until</span>
                <span className="font-medium text-[#4e2b22]">
                  {selectedPkg && format(addDays(new Date(), selectedPkg.validityDays), 'd MMM yyyy')}
                </span>
              </div>
              <div className="mt-2 border-t border-[#ede8e5] pt-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-[#4e2b22]">Total</span>
                  <span className="text-lg font-bold text-[#4e2b22]">
                    {selectedPkg && formatPrice(selectedPkg.priceCents, selectedPkg.currency)}
                  </span>
                </div>
              </div>
            </div>

            {paymentMethod === 'pay_at_studio' && (
              <div className="mb-4 rounded-xl bg-[#d4a574]/10 p-4">
                <p className="text-sm text-[#6b3d32]">
                  <span className="font-medium">Pay at Studio:</span> Your credits are added{' '}
                  <strong>immediately</strong> so you can book right away. Please bring the invoice
                  amount to the studio within <strong>14 days</strong>. An invoice (PDF) will be
                  emailed to you.
                </p>
              </div>
            )}

            {/* Legal consent — Button-Lösung §312j BGB + withdrawal waiver §356 V BGB */}
            <div className="mb-4 space-y-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-[#c4a88a] text-[#4e2b22] focus:ring-[#4e2b22]"
                />
                <span className="text-xs leading-relaxed text-[#6b3d32]">
                  I have read and accept the{' '}
                  <Link href="/agb" target="_blank" className="text-[#4e2b22] underline underline-offset-2">
                    General Terms &amp; Conditions
                  </Link>{' '}
                  – including the Liability Waiver and Cancellation Policy – and the{' '}
                  <Link href="/datenschutz" target="_blank" className="text-[#4e2b22] underline underline-offset-2">
                    Privacy Policy
                  </Link>.
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={acceptedWithdrawal}
                  onChange={(e) => setAcceptedWithdrawal(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-[#c4a88a] text-[#4e2b22] focus:ring-[#4e2b22]"
                />
                <span className="text-xs leading-relaxed text-[#6b3d32]">
                  I expressly consent to the immediate performance of the contract and acknowledge
                  that I lose my statutory 14-day right of withdrawal once the credits are credited
                  to my account.
                </span>
              </label>

              <div className="rounded-lg bg-[#ede8e5]/30 p-3 text-xs leading-relaxed text-[#6b3d32]">
                <strong>Right of Withdrawal:</strong> By purchasing, you request the service begins
                immediately. You waive your 14-day right of withdrawal once credits are provisioned.{' '}
                <Link href="/widerrufsrecht" target="_blank" className="text-[#4e2b22] underline underline-offset-2">
                  Terms of Cancellation
                </Link>
              </div>
            </div>

            <Button
              variant="boutique"
              className="w-full"
              onClick={handlePurchase}
              disabled={isProcessing || status !== 'authenticated' || !acceptedTerms || !acceptedWithdrawal}
            >
              {isProcessing
                ? 'Processing…'
                : status !== 'authenticated'
                ? 'Please sign in'
                : 'Buy now – binding order'}
            </Button>
            <p className="mt-2 text-center text-[10px] leading-snug text-[#a6856f]">
              By clicking this button you place a binding order. Payment is due in person at the studio within 14 days.
            </p>
          </div>
        </section>
      )}

      {/* Bills tab */}
      {!isMembershipTab && <BillsSection isOpen={isBillsTab} />}
    </div>
  );
}
