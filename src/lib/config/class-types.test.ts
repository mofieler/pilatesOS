/**
 * TESTS FOR CLASS TYPES CONFIGURATION
 * 
 * These tests ensure the configuration system works correctly
 * and maintains type safety throughout the application.
 */

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
    it('should have all expected class types', () => {
      const expectedTypes: ClassType[] = ['mat', 'reformer', 'private', 'duo', 'group', 'online', 'sound_healing'];
      expect(getClassTypeValues()).toEqual(expectedTypes);
    });

    it('should have all expected credit types', () => {
      const expectedTypes: CreditType[] = ['mat_group', 'reformer_group', 'private_session', 'duo_group', 'general_group', 'online_class', 'sound_healing'];
      expect(getCreditTypeValues()).toEqual(expectedTypes);
    });
  });

  describe('Configuration Access', () => {
    it('should return correct class type config', () => {
      const matConfig = getClassTypeConfig('mat');
      expect(matConfig).toEqual({
        value: 'mat',
        label: 'Mat Class',
        description: 'Group mat-based Pilates class',
        badgeStyle: 'bg-emerald-100 text-emerald-800',
        defaultDuration: 60,
        defaultCapacity: 12,
      });
    });

    it('should return correct credit type config', () => {
      const matGroupConfig = getCreditTypeConfig('mat_group');
      expect(matGroupConfig).toEqual({
        value: 'mat_group',
        label: 'Mat Class Credits',
        description: 'Credits for group mat classes',
        badgeStyle: 'bg-[#6b8e6b]/10 text-[#4a7c4a]',
        associatedClassType: 'mat',
      });
    });

    it('should return undefined for invalid types', () => {
      expect(getClassTypeConfig('invalid')).toBeUndefined();
      expect(getCreditTypeConfig('invalid')).toBeUndefined();
    });
  });

  describe('Label Functions', () => {
    it('should return correct labels for valid types', () => {
      expect(getClassTypeLabel('mat')).toBe('Mat Class');
      expect(getCreditTypeLabel('mat_group')).toBe('Mat Class Credits');
    });

    it('should return the value for invalid types', () => {
      expect(getClassTypeLabel('invalid')).toBe('invalid');
      expect(getCreditTypeLabel('invalid')).toBe('invalid');
    });
  });

  describe('Style Functions', () => {
    it('should return correct badge styles for valid types', () => {
      expect(getClassTypeBadgeStyle('mat')).toBe('bg-emerald-100 text-emerald-800');
      expect(getCreditTypeBadgeStyle('mat_group')).toBe('bg-[#6b8e6b]/10 text-[#4a7c4a]');
    });

    it('should return default style for invalid types', () => {
      expect(getClassTypeBadgeStyle('invalid')).toBe('bg-slate-100 text-slate-700');
      expect(getCreditTypeBadgeStyle('invalid')).toBe('bg-slate-100 text-slate-700');
    });
  });

  describe('Validation Functions', () => {
    it('should validate class types correctly', () => {
      expect(isValidClassType('mat')).toBe(true);
      expect(isValidClassType('reformer')).toBe(true);
      expect(isValidClassType('invalid')).toBe(false);
    });

    it('should validate credit types correctly', () => {
      expect(isValidCreditType('mat_group')).toBe(true);
      expect(isValidCreditType('reformer_group')).toBe(true);
      expect(isValidCreditType('invalid')).toBe(false);
    });
  });

  describe('Type Guards', () => {
    it('should work as type guards', () => {
      const unknownValue: unknown = 'mat';
      if (isClassType(unknownValue)) {
        // This should compile without error
        expect(unknownValue satisfies ClassType).toBe('mat');
      }

      const unknownCreditValue: unknown = 'mat_group';
      if (isCreditType(unknownCreditValue)) {
        // This should compile without error
        expect(unknownCreditValue satisfies CreditType).toBe('mat_group');
      }
    });
  });

  describe('Select Options', () => {
    it('should generate correct class type select options', () => {
      const options = getClassTypeSelectOptions();
      expect(options).toHaveLength(6);
      expect(options[0]).toEqual({
        value: 'mat',
        label: 'Mat Class',
      });
    });

    it('should generate correct credit type select options', () => {
      const options = getCreditTypeSelectOptions();
      expect(options).toHaveLength(3);
      expect(options[0]).toEqual({
        value: 'mat_group',
        label: 'Mat Class Credits',
      });
    });
  });

  describe('Credit Type Association', () => {
    it('should return correct credit type for class type', () => {
      expect(getCreditTypeForClassType('mat')).toBe('mat_group');
      expect(getCreditTypeForClassType('reformer')).toBe('reformer_group');
      expect(getCreditTypeForClassType('private')).toBe('private_session');
    });

    it('should return default credit type for unmapped class type', () => {
      expect(getCreditTypeForClassType('group')).toBe('mat_group');
      expect(getCreditTypeForClassType('online')).toBe('mat_group');
    });
  });

  describe('Configuration Completeness', () => {
    it('should have all required fields in class type configs', () => {
      Object.values(CLASS_TYPES).forEach(config => {
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
      Object.values(CREDIT_TYPES).forEach(config => {
        expect(config).toHaveProperty('value');
        expect(config).toHaveProperty('label');
        expect(config).toHaveProperty('description');
        expect(config).toHaveProperty('badgeStyle');
        expect(config).toHaveProperty('associatedClassType');
        expect(['mat', 'reformer', 'private', 'duo', 'group', 'online', 'sound_healing']).toContain(config.associatedClassType);
      });
    });
  });
});
