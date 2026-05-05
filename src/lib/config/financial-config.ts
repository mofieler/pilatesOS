/**
 * CENTRALIZED FINANCIAL CONFIGURATION
 * 
 * This file serves as the single source of truth for all financial configurations
 * including credit packs, payment modalities, and financial types in the Pilates OS.
 * 
 * Features:
 * - Type-safe definitions for payment methods
 * - Configurable credit pack templates
 * - Easy extension for new payment modalities
 * - Validation helpers for financial operations
 */

// ─── TYPE DEFINITIONS ────────────────────────────────────────────────────────

export type PaymentMethod = 'stripe' | 'pay_at_studio' | 'bank_transfer' | 'cash' | 'sound_healing_credits';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'overdue' | 'refunded';
export type CreditPackCategory = 'standard' | 'premium' | 'vip' | 'specialty' | 'wellness';

export interface PaymentMethodConfig {
  value: PaymentMethod;
  label: string;
  description: string;
  icon?: string;
  requiresOnlinePayment: boolean;
  requiresManualConfirmation: boolean;
  supportedCurrencies: string[];
  processingFeePercent?: number;
  isActive: boolean;
}

export interface CreditPackTemplate {
  id: string;
  name: string;
  description: string;
  category: CreditPackCategory;
  creditsAmount: number;
  priceCents: number;
  currency: string;
  validityDays: number;
  paymentMethods: PaymentMethod[];
  sortOrder: number;
  isActive: boolean;
  stripePriceId?: string;
  metadata?: Record<string, unknown>;
}

export interface FinancialConfig {
  defaultCurrency: string;
  supportedCurrencies: string[];
  taxRatePercent: number;
  refundPolicyDays: number;
  autoRefundEnabled: boolean;
  partialPaymentEnabled: boolean;
}

// ─── PAYMENT METHODS CONFIGURATION ─────────────────────────────────────────────

export const PAYMENT_METHODS: Record<PaymentMethod, PaymentMethodConfig> = {
  stripe: {
    value: 'stripe',
    label: 'Credit Card (Stripe)',
    description: 'Pay securely with credit/debit card',
    icon: 'credit-card',
    requiresOnlinePayment: true,
    requiresManualConfirmation: false,
    supportedCurrencies: ['eur', 'usd', 'gbp'],
    processingFeePercent: 2.9,
    isActive: true,
  },
  pay_at_studio: {
    value: 'pay_at_studio',
    label: 'Pay at Studio',
    description: 'Pay in person at the studio',
    icon: 'building',
    requiresOnlinePayment: false,
    requiresManualConfirmation: true,
    supportedCurrencies: ['eur'],
    isActive: true,
  },
  bank_transfer: {
    value: 'bank_transfer',
    label: 'Bank Transfer',
    description: 'Transfer funds directly to our bank account',
    icon: 'bank',
    requiresOnlinePayment: false,
    requiresManualConfirmation: true,
    supportedCurrencies: ['eur'],
    processingFeePercent: 0,
    isActive: true,
  },
  cash: {
    value: 'cash',
    label: 'Cash Payment',
    description: 'Pay with cash at the studio',
    icon: 'banknote',
    requiresOnlinePayment: false,
    requiresManualConfirmation: true,
    supportedCurrencies: ['eur'],
    isActive: true,
  },
  sound_healing_credits: {
    value: 'sound_healing_credits',
    label: 'Sound Healing Credits',
    description: 'Pay using sound healing session credits',
    icon: 'music',
    requiresOnlinePayment: false,
    requiresManualConfirmation: false,
    supportedCurrencies: ['eur'],
    processingFeePercent: 0,
    isActive: true,
  },
} as const;

// ─── CREDIT PACK CATEGORIES CONFIGURATION ───────────────────────────────────────

export const CREDIT_PACK_CATEGORIES: Record<CreditPackCategory, {
  value: CreditPackCategory;
  label: string;
  description: string;
  badgeStyle: string;
  defaultValidityDays: number;
}> = {
  standard: {
    value: 'standard',
    label: 'Standard Packs',
    description: 'Regular credit packages for classes',
    badgeStyle: 'bg-slate-100 text-slate-700',
    defaultValidityDays: 365,
  },
  premium: {
    value: 'premium',
    label: 'Premium Packs',
    description: 'Enhanced packages with bonus credits',
    badgeStyle: 'bg-emerald-100 text-emerald-800',
    defaultValidityDays: 365,
  },
  vip: {
    value: 'vip',
    label: 'VIP Packs',
    description: 'Exclusive packages with maximum benefits',
    badgeStyle: 'bg-amber-100 text-amber-800',
    defaultValidityDays: 365,
  },
  specialty: {
    value: 'specialty',
    label: 'Specialty Packs',
    description: 'Specialized packages for specific programs',
    badgeStyle: 'bg-purple-100 text-purple-800',
    defaultValidityDays: 180,
  },
  wellness: {
    value: 'wellness',
    label: 'Wellness Packs',
    description: 'Holistic wellness and healing packages',
    badgeStyle: 'bg-green-100 text-green-800',
    defaultValidityDays: 180,
  },
} as const;

// ─── DEFAULT CREDIT PACK TEMPLATES ─────────────────────────────────────────────

export const DEFAULT_CREDIT_PACKS: CreditPackTemplate[] = [
  {
    id: 'mat-5-pack',
    name: '5 Mat Classes',
    description: 'Perfect for trying out our mat classes',
    category: 'standard',
    creditsAmount: 5,
    priceCents: 7500,
    currency: 'eur',
    validityDays: 90,
    paymentMethods: ['stripe', 'pay_at_studio', 'bank_transfer', 'cash'],
    sortOrder: 10,
    isActive: true,
  },
  {
    id: 'mat-10-pack',
    name: '10 Mat Classes',
    description: 'Our most popular mat class package',
    category: 'standard',
    creditsAmount: 10,
    priceCents: 14000,
    currency: 'eur',
    validityDays: 180,
    paymentMethods: ['stripe', 'pay_at_studio', 'bank_transfer', 'cash'],
    sortOrder: 20,
    isActive: true,
  },
  {
    id: 'reformer-5-pack',
    name: '5 Reformer Classes',
    description: 'Experience our reformer equipment',
    category: 'premium',
    creditsAmount: 5,
    priceCents: 12500,
    currency: 'eur',
    validityDays: 90,
    paymentMethods: ['stripe', 'pay_at_studio', 'bank_transfer', 'cash'],
    sortOrder: 30,
    isActive: true,
  },
  {
    id: 'private-3-pack',
    name: '3 Private Sessions',
    description: 'Personalized one-on-one training',
    category: 'vip',
    creditsAmount: 3,
    priceCents: 22500,
    currency: 'eur',
    validityDays: 120,
    paymentMethods: ['stripe', 'pay_at_studio', 'bank_transfer', 'cash'],
    sortOrder: 40,
    isActive: true,
  },
  {
    id: 'sound-healing-5-pack',
    name: '5 Sound Healing Sessions',
    description: 'Therapeutic sound healing experiences',
    category: 'wellness',
    creditsAmount: 5,
    priceCents: 15000,
    currency: 'eur',
    validityDays: 180,
    paymentMethods: ['stripe', 'pay_at_studio', 'sound_healing_credits'],
    sortOrder: 50,
    isActive: true,
  },
];

// ─── FINANCIAL CONFIGURATION ─────────────────────────────────────────────────────

export const FINANCIAL_CONFIG: FinancialConfig = {
  defaultCurrency: 'eur',
  supportedCurrencies: ['eur', 'usd', 'gbp'],
  taxRatePercent: 21,
  refundPolicyDays: 14,
  autoRefundEnabled: true,
  partialPaymentEnabled: true,
};

// ─── UTILITY FUNCTIONS ──────────────────────────────────────────────────────────

/**
 * Get all payment method values as an array
 */
export function getPaymentMethodValues(): PaymentMethod[] {
  return Object.keys(PAYMENT_METHODS) as PaymentMethod[];
}

/**
 * Get all credit pack category values as an array
 */
export function getCreditPackCategoryValues(): CreditPackCategory[] {
  return Object.keys(CREDIT_PACK_CATEGORIES) as CreditPackCategory[];
}

/**
 * Get payment method configuration by value
 */
export function getPaymentMethodConfig(value: string): PaymentMethodConfig | undefined {
  return PAYMENT_METHODS[value as PaymentMethod];
}

/**
 * Get credit pack category configuration by value
 */
export function getCreditPackCategoryConfig(value: string): typeof CREDIT_PACK_CATEGORIES[CreditPackCategory] | undefined {
  return CREDIT_PACK_CATEGORIES[value as CreditPackCategory];
}

/**
 * Get payment method label for display
 */
export function getPaymentMethodLabel(value: string): string {
  return getPaymentMethodConfig(value)?.label || value;
}

/**
 * Get credit pack category label for display
 */
export function getCreditPackCategoryLabel(value: string): string {
  return getCreditPackCategoryConfig(value)?.label || value;
}

/**
 * Get active payment methods
 */
export function getActivePaymentMethods(): PaymentMethodConfig[] {
  return Object.values(PAYMENT_METHODS).filter(method => method.isActive);
}

/**
 * Get payment methods that support a specific currency
 */
export function getPaymentMethodsForCurrency(currency: string): PaymentMethodConfig[] {
  return Object.values(PAYMENT_METHODS).filter(
    method => method.isActive && method.supportedCurrencies.includes(currency)
  );
}

/**
 * Get default credit pack templates for a category
 */
export function getCreditPacksForCategory(category: CreditPackCategory): CreditPackTemplate[] {
  return DEFAULT_CREDIT_PACKS.filter(pack => pack.category === category && pack.isActive);
}

/**
 * Get all active credit pack templates
 */
export function getActiveCreditPacks(): CreditPackTemplate[] {
  return DEFAULT_CREDIT_PACKS.filter(pack => pack.isActive);
}

/**
 * Get select options for payment methods
 */
export function getPaymentMethodSelectOptions(): Array<{ value: PaymentMethod; label: string; description?: string }> {
  return getActivePaymentMethods().map(config => ({
    value: config.value,
    label: config.label,
    description: config.description,
  }));
}

/**
 * Get select options for credit pack categories
 */
export function getCreditPackCategorySelectOptions(): Array<{ value: CreditPackCategory; label: string }> {
  return Object.values(CREDIT_PACK_CATEGORIES).map(config => ({
    value: config.value,
    label: config.label,
  }));
}

/**
 * Validate if a value is a valid payment method
 */
export function isValidPaymentMethod(value: string): value is PaymentMethod {
  return value in PAYMENT_METHODS;
}

/**
 * Validate if a value is a valid credit pack category
 */
export function isValidCreditPackCategory(value: string): value is CreditPackCategory {
  return value in CREDIT_PACK_CATEGORIES;
}

/**
 * Calculate processing fee for a payment method
 */
export function calculateProcessingFee(amountCents: number, paymentMethod: PaymentMethod): number {
  const config = getPaymentMethodConfig(paymentMethod);
  if (!config?.processingFeePercent) return 0;
  return Math.round((amountCents * config.processingFeePercent) / 100);
}

/**
 * Get supported currencies for all active payment methods
 */
export function getSupportedCurrencies(): string[] {
  const currencies = new Set<string>();
  getActivePaymentMethods().forEach(method => {
    method.supportedCurrencies.forEach(currency => currencies.add(currency));
  });
  return Array.from(currencies);
}

// ─── TYPE GUARDS ───────────────────────────────────────────────────────────────

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && isValidPaymentMethod(value);
}

export function isCreditPackCategory(value: unknown): value is CreditPackCategory {
  return typeof value === 'string' && isValidCreditPackCategory(value);
}

// ─── EXPORTS FOR LEGACY COMPATIBILITY ───────────────────────────────────────────

/**
 * Legacy compatibility exports - these will be removed in future versions
 * @deprecated Use the new modular system instead
 */
export const LEGACY_PAYMENT_METHODS = ['stripe', 'pay_at_studio'];
export const LEGACY_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'cancelled', 'overdue'];
