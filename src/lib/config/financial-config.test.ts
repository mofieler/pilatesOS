/**
 * TESTS FOR FINANCIAL CONFIGURATION
 * 
 * These tests ensure the financial configuration system works correctly
 * and maintains type safety throughout the application.
 */

import { describe, it, expect } from 'vitest';
import {
  PAYMENT_METHODS,
  CREDIT_PACK_CATEGORIES,
  DEFAULT_CREDIT_PACKS,
  FINANCIAL_CONFIG,
  getPaymentMethodValues,
  getCreditPackCategoryValues,
  getPaymentMethodConfig,
  getCreditPackCategoryConfig,
  getPaymentMethodLabel,
  getCreditPackCategoryLabel,
  getActivePaymentMethods,
  getPaymentMethodsForCurrency,
  getCreditPacksForCategory,
  getActiveCreditPacks,
  getPaymentMethodSelectOptions,
  getCreditPackCategorySelectOptions,
  isValidPaymentMethod,
  isValidCreditPackCategory,
  calculateProcessingFee,
  getSupportedCurrencies,
  isPaymentMethod,
  isCreditPackCategory,
  type PaymentMethod,
  type CreditPackCategory,
  type PaymentMethodConfig,
  type CreditPackTemplate,
} from './financial-config';

describe('Financial Configuration', () => {
  describe('Payment Methods', () => {
    it('should have all expected payment methods', () => {
      const expectedMethods: PaymentMethod[] = ['stripe', 'pay_at_studio', 'bank_transfer', 'cash', 'sound_healing_credits'];
      expect(getPaymentMethodValues()).toEqual(expectedMethods);
    });

    it('should return correct payment method config', () => {
      const stripeConfig = getPaymentMethodConfig('stripe');
      expect(stripeConfig).toEqual({
        value: 'stripe',
        label: 'Credit Card (Stripe)',
        description: 'Pay securely with credit/debit card',
        icon: 'credit-card',
        requiresOnlinePayment: true,
        requiresManualConfirmation: false,
        supportedCurrencies: ['eur', 'usd', 'gbp'],
        processingFeePercent: 2.9,
        isActive: true,
      });
    });

    it('should return undefined for invalid payment method', () => {
      expect(getPaymentMethodConfig('invalid')).toBeUndefined();
    });

    it('should return correct labels for valid payment methods', () => {
      expect(getPaymentMethodLabel('stripe')).toBe('Credit Card (Stripe)');
      expect(getPaymentMethodLabel('sound_healing_credits')).toBe('Sound Healing Credits');
    });

    it('should return the value for invalid payment method', () => {
      expect(getPaymentMethodLabel('invalid')).toBe('invalid');
    });

    it('should validate payment methods correctly', () => {
      expect(isValidPaymentMethod('stripe')).toBe(true);
      expect(isValidPaymentMethod('sound_healing_credits')).toBe(true);
      expect(isValidPaymentMethod('invalid')).toBe(false);
    });

    it('should work as type guards', () => {
      const unknownValue: unknown = 'stripe';
      if (isPaymentMethod(unknownValue)) {
        expect(unknownValue satisfies PaymentMethod).toBe('stripe');
      }
    });

    it('should filter active payment methods', () => {
      const activeMethods = getActivePaymentMethods();
      expect(activeMethods).toHaveLength(5);
      expect(activeMethods.every(method => method.isActive)).toBe(true);
    });

    it('should filter payment methods by currency', () => {
      const eurMethods = getPaymentMethodsForCurrency('eur');
      expect(eurMethods).toHaveLength(5);
      
      const usdMethods = getPaymentMethodsForCurrency('usd');
      expect(usdMethods).toHaveLength(1);
      expect(usdMethods[0].value).toBe('stripe');
    });
  });

  describe('Credit Pack Categories', () => {
    it('should have all expected categories', () => {
      const expectedCategories: CreditPackCategory[] = ['standard', 'premium', 'vip', 'specialty', 'wellness'];
      expect(getCreditPackCategoryValues()).toEqual(expectedCategories);
    });

    it('should return correct category config', () => {
      const wellnessConfig = getCreditPackCategoryConfig('wellness');
      expect(wellnessConfig).toEqual({
        value: 'wellness',
        label: 'Wellness Packs',
        description: 'Holistic wellness and healing packages',
        badgeStyle: 'bg-green-100 text-green-800',
        defaultValidityDays: 180,
      });
    });

    it('should validate categories correctly', () => {
      expect(isValidCreditPackCategory('wellness')).toBe(true);
      expect(isValidCreditPackCategory('invalid')).toBe(false);
    });

    it('should work as type guards', () => {
      const unknownValue: unknown = 'wellness';
      if (isCreditPackCategory(unknownValue)) {
        expect(unknownValue satisfies CreditPackCategory).toBe('wellness');
      }
    });
  });

  describe('Credit Pack Templates', () => {
    it('should have default credit packs', () => {
      expect(DEFAULT_CREDIT_PACKS).toHaveLength(5);
    });

    it('should filter packs by category', () => {
      const wellnessPacks = getCreditPacksForCategory('wellness');
      expect(wellnessPacks).toHaveLength(1);
      expect(wellnessPacks[0].category).toBe('wellness');
    });

    it('should filter active packs', () => {
      const activePacks = getActiveCreditPacks();
      expect(activePacks.every(pack => pack.isActive)).toBe(true);
    });

    it('should have sound healing pack with correct configuration', () => {
      const soundHealingPack = DEFAULT_CREDIT_PACKS.find(pack => pack.id === 'sound-healing-5-pack');
      expect(soundHealingPack).toBeDefined();
      expect(soundHealingPack?.category).toBe('wellness');
      expect(soundHealingPack?.paymentMethods).toContain('sound_healing_credits');
    });
  });

  describe('Select Options', () => {
    it('should generate correct payment method select options', () => {
      const options = getPaymentMethodSelectOptions();
      expect(options).toHaveLength(5);
      expect(options[0]).toEqual({
        value: 'stripe',
        label: 'Credit Card (Stripe)',
        description: 'Pay securely with credit/debit card',
      });
    });

    it('should generate correct category select options', () => {
      const options = getCreditPackCategorySelectOptions();
      expect(options).toHaveLength(5);
      expect(options[0]).toEqual({
        value: 'standard',
        label: 'Standard Packs',
      });
    });
  });

  describe('Financial Calculations', () => {
    it('should calculate processing fees correctly', () => {
      expect(calculateProcessingFee(10000, 'stripe')).toBe(290); // 2.9% of 10000 cents
      expect(calculateProcessingFee(10000, 'pay_at_studio')).toBe(0); // No fee
      expect(calculateProcessingFee(10000, 'sound_healing_credits')).toBe(0); // No fee
    });

    it('should handle invalid payment method for fee calculation', () => {
      expect(calculateProcessingFee(10000, 'invalid' as PaymentMethod)).toBe(0);
    });
  });

  describe('Supported Currencies', () => {
    it('should return all supported currencies', () => {
      const currencies = getSupportedCurrencies();
      expect(currencies).toContain('eur');
      expect(currencies).toContain('usd');
      expect(currencies).toContain('gbp');
    });
  });

  describe('Financial Config', () => {
    it('should have correct financial configuration', () => {
      expect(FINANCIAL_CONFIG).toEqual({
        defaultCurrency: 'eur',
        supportedCurrencies: ['eur', 'usd', 'gbp'],
        taxRatePercent: 21,
        refundPolicyDays: 14,
        autoRefundEnabled: true,
        partialPaymentEnabled: true,
      });
    });
  });

  describe('Configuration Completeness', () => {
    it('should have all required fields in payment method configs', () => {
      Object.values(PAYMENT_METHODS).forEach(config => {
        expect(config).toHaveProperty('value');
        expect(config).toHaveProperty('label');
        expect(config).toHaveProperty('description');
        expect(config).toHaveProperty('requiresOnlinePayment');
        expect(config).toHaveProperty('requiresManualConfirmation');
        expect(config).toHaveProperty('supportedCurrencies');
        expect(config).toHaveProperty('isActive');
        expect(typeof config.requiresOnlinePayment).toBe('boolean');
        expect(typeof config.requiresManualConfirmation).toBe('boolean');
        expect(Array.isArray(config.supportedCurrencies)).toBe(true);
        expect(typeof config.isActive).toBe('boolean');
      });
    });

    it('should have all required fields in credit pack category configs', () => {
      Object.values(CREDIT_PACK_CATEGORIES).forEach(config => {
        expect(config).toHaveProperty('value');
        expect(config).toHaveProperty('label');
        expect(config).toHaveProperty('description');
        expect(config).toHaveProperty('badgeStyle');
        expect(config).toHaveProperty('defaultValidityDays');
        expect(typeof config.defaultValidityDays).toBe('number');
      });
    });

    it('should have all required fields in credit pack templates', () => {
      DEFAULT_CREDIT_PACKS.forEach(pack => {
        expect(pack).toHaveProperty('id');
        expect(pack).toHaveProperty('name');
        expect(pack).toHaveProperty('category');
        expect(pack).toHaveProperty('creditsAmount');
        expect(pack).toHaveProperty('priceCents');
        expect(pack).toHaveProperty('currency');
        expect(pack).toHaveProperty('validityDays');
        expect(pack).toHaveProperty('paymentMethods');
        expect(pack).toHaveProperty('sortOrder');
        expect(pack).toHaveProperty('isActive');
        expect(typeof pack.creditsAmount).toBe('number');
        expect(typeof pack.priceCents).toBe('number');
        expect(Array.isArray(pack.paymentMethods)).toBe(true);
        expect(typeof pack.sortOrder).toBe('number');
        expect(typeof pack.isActive).toBe('boolean');
      });
    });
  });
});
