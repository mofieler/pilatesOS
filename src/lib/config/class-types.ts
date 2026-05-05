/**
 * CENTRALIZED CLASS & CREDIT TYPES CONFIGURATION
 * 
 * This file serves as the single source of truth for all class and credit types
 * in the Pilates OS application. Any changes to types should be made here only.
 * 
 * Features:
 * - Type-safe definitions
 * - Centralized styling and labels
 * - Easy extension for new types
 * - Validation helpers
 */

// ─── TYPE DEFINITIONS ────────────────────────────────────────────────────────

export type ClassType = 'mat' | 'reformer' | 'private' | 'duo' | 'group' | 'online';
export type CreditType = 'mat_group' | 'reformer_group' | 'private_session';

export interface ClassTypeConfig {
  value: ClassType;
  label: string;
  description: string;
  badgeStyle: string;
  defaultDuration: number; // minutes
  defaultCapacity: number;
  defaultLocation?: string;
}

export interface CreditTypeConfig {
  value: CreditType;
  label: string;
  description: string;
  badgeStyle: string;
  associatedClassType: ClassType;
}

// ─── CLASS TYPES CONFIGURATION ─────────────────────────────────────────────────

export const CLASS_TYPES: Record<ClassType, ClassTypeConfig> = {
  mat: {
    value: 'mat',
    label: 'Mat Class',
    description: 'Group mat-based Pilates class',
    badgeStyle: 'bg-emerald-100 text-emerald-800',
    defaultDuration: 60,
    defaultCapacity: 12,
  },
  reformer: {
    value: 'reformer',
    label: 'Reformer Class',
    description: 'Group reformer machine class',
    badgeStyle: 'bg-teal-100 text-teal-800',
    defaultDuration: 60,
    defaultCapacity: 8,
  },
  private: {
    value: 'private',
    label: 'Private Session',
    description: 'One-on-one private session',
    badgeStyle: 'bg-violet-100 text-violet-800',
    defaultDuration: 60,
    defaultCapacity: 1,
  },
  duo: {
    value: 'duo',
    label: 'Duo Session',
    description: 'Two-person semi-private session',
    badgeStyle: 'bg-indigo-100 text-indigo-800',
    defaultDuration: 60,
    defaultCapacity: 2,
  },
  group: {
    value: 'group',
    label: 'Group Class',
    description: 'General group fitness class',
    badgeStyle: 'bg-sky-100 text-sky-800',
    defaultDuration: 60,
    defaultCapacity: 15,
  },
  online: {
    value: 'online',
    label: 'Online Class',
    description: 'Virtual/online class session',
    badgeStyle: 'bg-orange-100 text-orange-800',
    defaultDuration: 60,
    defaultCapacity: 20,
  },
} as const;

// ─── CREDIT TYPES CONFIGURATION ─────────────────────────────────────────────────

export const CREDIT_TYPES: Record<CreditType, CreditTypeConfig> = {
  mat_group: {
    value: 'mat_group',
    label: 'Mat Class Credits',
    description: 'Credits for group mat classes',
    badgeStyle: 'bg-[#6b8e6b]/10 text-[#4a7c4a]',
    associatedClassType: 'mat',
  },
  reformer_group: {
    value: 'reformer_group',
    label: 'Reformer Class Credits',
    description: 'Credits for group reformer classes',
    badgeStyle: 'bg-[#8b5a3c]/10 text-[#6b3d32]',
    associatedClassType: 'reformer',
  },
  private_session: {
    value: 'private_session',
    label: 'Private Session Credits',
    description: 'Credits for private sessions',
    badgeStyle: 'bg-[#4e2b22]/10 text-[#4e2b22]',
    associatedClassType: 'private',
  },
} as const;

// ─── UTILITY FUNCTIONS ──────────────────────────────────────────────────────────

/**
 * Get all class type values as an array for select options
 */
export function getClassTypeValues(): ClassType[] {
  return Object.keys(CLASS_TYPES) as ClassType[];
}

/**
 * Get all credit type values as an array for select options
 */
export function getCreditTypeValues(): CreditType[] {
  return Object.keys(CREDIT_TYPES) as CreditType[];
}

/**
 * Get class type configuration by value
 */
export function getClassTypeConfig(value: string): ClassTypeConfig | undefined {
  return CLASS_TYPES[value as ClassType];
}

/**
 * Get credit type configuration by value
 */
export function getCreditTypeConfig(value: string): CreditTypeConfig | undefined {
  return CREDIT_TYPES[value as CreditType];
}

/**
 * Get class type label for display
 */
export function getClassTypeLabel(value: string): string {
  return getClassTypeConfig(value)?.label || value;
}

/**
 * Get credit type label for display
 */
export function getCreditTypeLabel(value: string): string {
  return getCreditTypeConfig(value)?.label || value;
}

/**
 * Get class type badge styling
 */
export function getClassTypeBadgeStyle(value: string): string {
  return getClassTypeConfig(value)?.badgeStyle || 'bg-slate-100 text-slate-700';
}

/**
 * Get credit type badge styling
 */
export function getCreditTypeBadgeStyle(value: string): string {
  return getCreditTypeConfig(value)?.badgeStyle || 'bg-slate-100 text-slate-700';
}

/**
 * Get appropriate credit type for a given class type
 */
export function getCreditTypeForClassType(classType: ClassType): CreditType {
  const creditTypeEntry = Object.entries(CREDIT_TYPES).find(
    ([_, config]) => config.associatedClassType === classType
  );
  return (creditTypeEntry?.[0] as CreditType) || 'mat_group';
}

/**
 * Validate if a value is a valid class type
 */
export function isValidClassType(value: string): value is ClassType {
  return value in CLASS_TYPES;
}

/**
 * Validate if a value is a valid credit type
 */
export function isValidCreditType(value: string): value is CreditType {
  return value in CREDIT_TYPES;
}

/**
 * Get select options for class types (for dropdown components)
 */
export function getClassTypeSelectOptions(): Array<{ value: ClassType; label: string }> {
  return Object.values(CLASS_TYPES).map(config => ({
    value: config.value,
    label: config.label,
  }));
}

/**
 * Get select options for credit types (for dropdown components)
 */
export function getCreditTypeSelectOptions(): Array<{ value: CreditType; label: string }> {
  return Object.values(CREDIT_TYPES).map(config => ({
    value: config.value,
    label: config.label,
  }));
}

// ─── TYPE GUARDS ───────────────────────────────────────────────────────────────

/**
 * Type guard for ClassType
 */
export function isClassType(value: unknown): value is ClassType {
  return typeof value === 'string' && isValidClassType(value);
}

/**
 * Type guard for CreditType
 */
export function isCreditType(value: unknown): value is CreditType {
  return typeof value === 'string' && isValidCreditType(value);
}

// ─── EXPORTS FOR LEGACY COMPATIBILITY ───────────────────────────────────────────

/**
 * Legacy compatibility exports - these will be removed in future versions
 * @deprecated Use the new modular system instead
 */
export const LEGACY_CLASS_TYPE_OPTIONS = [
  { value: 'reformer', label: 'Reformer' },
  { value: 'mat', label: 'Mat' },
  { value: 'private', label: 'Private' },
  { value: 'duo', label: 'Duo' },
  { value: 'group', label: 'Group' },
  { value: 'online', label: 'Online' },
];

export const LEGACY_CREDIT_TYPE_LABELS = { 
  mat_group: 'Mat Class', 
  reformer_group: 'Reformer Class', 
  private_session: 'Private Session' 
};

export const LEGACY_CREDIT_TYPE_STYLES = {
  mat_group: 'bg-[#6b8e6b]/10 text-[#4a7c4a]',
  reformer_group: 'bg-[#8b5a3c]/10 text-[#6b3d32]',
  private_session: 'bg-[#4e2b22]/10 text-[#4e2b22]',
};
