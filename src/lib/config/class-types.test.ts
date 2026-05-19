import { describe, it, expect } from 'vitest';
import {
  CLASS_TYPES,
  CREDIT_TYPES,
  getClassTypeValues,
  getCreditTypeValues,
  getClassTypeConfig,
  getCreditTypeConfig,
  getClassTypeLabel,
  getCreditTypeLabel,
  getClassTypeBadgeStyle,
  getCreditTypeBadgeStyle,
  getCreditTypeForClassType,
  isValidClassType,
  isValidCreditType,
  getClassTypeSelectOptions,
  getCreditTypeSelectOptions,
  isClassType,
  isCreditType,
  type ClassType,
  type CreditType,
} from './class-types';

describe('Class Types Configuration', () => {
  describe('Type Definitions', () => {
    it('should have all 9 class types', () => {
      const values = getClassTypeValues();
      expect(values).toHaveLength(9);
      expect(values).toContain('reformer_group');
      expect(values).toContain('reformer_private');
      expect(values).toContain('reformer_duo');
      expect(values).toContain('mat_group');
      expect(values).toContain('mat_private');
      expect(values).toContain('mat_duo');
      expect(values).toContain('chair');
      expect(values).toContain('online');
      expect(values).toContain('sound_healing');
    });

    it('should have exactly 2 credit types', () => {
      const expectedTypes: CreditType[] = ['pass', 'session'];
      expect(getCreditTypeValues()).toEqual(expectedTypes);
    });
  });

  describe('Configuration Access', () => {
    it('should return correct class type config for mat_group', () => {
      const config = getClassTypeConfig('mat_group');
      expect(config).toBeDefined();
      expect(config?.value).toBe('mat_group');
      expect(config?.label).toBe('Mat Group');
      expect(typeof config?.defaultDuration).toBe('number');
      expect(typeof config?.defaultCapacity).toBe('number');
    });

    it('should return correct credit type config for pass', () => {
      const config = getCreditTypeConfig('pass');
      expect(config).toBeDefined();
      expect(config?.value).toBe('pass');
      expect(config?.label).toBe('Credits');
    });

    it('should return undefined for invalid types', () => {
      expect(getClassTypeConfig('invalid')).toBeUndefined();
      expect(getCreditTypeConfig('invalid')).toBeUndefined();
    });
  });

  describe('Label Functions', () => {
    it('should return correct labels for valid types', () => {
      expect(getClassTypeLabel('mat_group')).toBe('Mat Group');
      expect(getClassTypeLabel('reformer_private')).toBe('Reformer Private');
      expect(getCreditTypeLabel('pass')).toBe('Credits');
      expect(getCreditTypeLabel('session')).toBe('Session Credits');
    });

    it('should return the value for invalid types', () => {
      expect(getClassTypeLabel('invalid')).toBe('invalid');
      expect(getCreditTypeLabel('invalid')).toBe('invalid');
    });
  });

  describe('Style Functions', () => {
    it('should return badge styles for valid types', () => {
      expect(getClassTypeBadgeStyle('mat_group')).toBe('bg-emerald-100 text-emerald-800');
      expect(getCreditTypeBadgeStyle('pass')).toBeTruthy();
      expect(getCreditTypeBadgeStyle('session')).toBeTruthy();
    });

    it('should return default style for invalid types', () => {
      expect(getClassTypeBadgeStyle('invalid')).toBe('bg-slate-100 text-slate-700');
      expect(getCreditTypeBadgeStyle('invalid')).toBe('bg-slate-100 text-slate-700');
    });
  });

  describe('Validation Functions', () => {
    it('should validate class types correctly', () => {
      expect(isValidClassType('mat_group')).toBe(true);
      expect(isValidClassType('reformer_private')).toBe(true);
      expect(isValidClassType('sound_healing')).toBe(true);
      expect(isValidClassType('mat')).toBe(false);
      expect(isValidClassType('reformer')).toBe(false);
      expect(isValidClassType('invalid')).toBe(false);
    });

    it('should validate credit types correctly', () => {
      expect(isValidCreditType('pass')).toBe(true);
      expect(isValidCreditType('session')).toBe(true);
      expect(isValidCreditType('mat')).toBe(false);
      expect(isValidCreditType('reformer')).toBe(false);
      expect(isValidCreditType('group')).toBe(false);
      expect(isValidCreditType('mat_group')).toBe(false);
      expect(isValidCreditType('invalid')).toBe(false);
    });
  });

  describe('Type Guards', () => {
    it('should work as type guards', () => {
      const unknownValue: unknown = 'mat_group';
      if (isClassType(unknownValue)) {
        expect(unknownValue satisfies ClassType).toBe('mat_group');
      }

      const unknownCreditValue: unknown = 'pass';
      if (isCreditType(unknownCreditValue)) {
        expect(unknownCreditValue satisfies CreditType).toBe('pass');
      }
    });
  });

  describe('Select Options', () => {
    it('should generate 9 class type select options', () => {
      const options = getClassTypeSelectOptions();
      expect(options).toHaveLength(9);
    });

    it('should generate 2 credit type select options', () => {
      const options = getCreditTypeSelectOptions();
      expect(options).toHaveLength(2);
      expect(options.map((o) => o.value)).toEqual(['pass', 'session']);
    });
  });

  describe('Credit Type Derivation', () => {
    it('should map private/duo class types to session credits', () => {
      expect(getCreditTypeForClassType('reformer_private')).toBe('session');
      expect(getCreditTypeForClassType('reformer_duo')).toBe('session');
      expect(getCreditTypeForClassType('mat_private')).toBe('session');
      expect(getCreditTypeForClassType('mat_duo')).toBe('session');
    });

    it('should map every group class type to pass credits', () => {
      expect(getCreditTypeForClassType('reformer_group')).toBe('pass');
      expect(getCreditTypeForClassType('mat_group')).toBe('pass');
      expect(getCreditTypeForClassType('chair')).toBe('pass');
      expect(getCreditTypeForClassType('online')).toBe('pass');
      expect(getCreditTypeForClassType('sound_healing')).toBe('pass');
    });
  });

  describe('Configuration Completeness', () => {
    it('should have all required fields in class type configs', () => {
      Object.values(CLASS_TYPES).forEach((config) => {
        expect(config).toHaveProperty('value');
        expect(config).toHaveProperty('label');
        expect(config).toHaveProperty('description');
        expect(config).toHaveProperty('badgeStyle');
        expect(config).toHaveProperty('defaultDuration');
        expect(config).toHaveProperty('defaultCapacity');
        expect(typeof config.defaultDuration).toBe('number');
        expect(typeof config.defaultCapacity).toBe('number');
      });
    });

    it('should have all required fields in credit type configs', () => {
      Object.values(CREDIT_TYPES).forEach((config) => {
        expect(config).toHaveProperty('value');
        expect(config).toHaveProperty('label');
        expect(config).toHaveProperty('description');
        expect(config).toHaveProperty('badgeStyle');
      });
    });
  });
});
