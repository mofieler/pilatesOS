/**
 * CENTRALIZED CLASS & CREDIT TYPES CONFIGURATION
 *
 * Credit model — TWO credit currencies (post-Sprint-6 consolidation):
 *   'pass'     Universal group-class credit.
 *              Accepted for: reformer_group, mat_group, chair, online, yoga, sound_healing.
 *   'session'  Private / duo session credit.
 *              Accepted for: mat_private, mat_duo, reformer_private, reformer_duo.
 *              Also used for the Welcome Journey intro session.
 */

// ─── TYPE DEFINITIONS ──────────────────────────────────────────────────────────

export type ClassType =
  | 'reformer_group'
  | 'reformer_private'
  | 'reformer_duo'
  | 'mat_group'
  | 'mat_private'
  | 'mat_duo'
  | 'chair'
  | 'online'
  | 'sound_healing';

export type CreditType = 'pass' | 'session';

export interface ClassTypeConfig {
  value: ClassType;
  label: string;
  description: string;
  badgeStyle: string;
  defaultDuration: number;
  defaultCapacity: number;
  location?: string;
}

export interface CreditTypeConfig {
  value: CreditType;
  label: string;
  description: string;
  badgeStyle: string;
}

// ─── CLASS TYPES ───────────────────────────────────────────────────────────────

export const CLASS_TYPES: Record<ClassType, ClassTypeConfig> = {
  reformer_group: {
    value: 'reformer_group',
    label: 'Reformer Group',
    description: 'Group class on the reformer machine',
    badgeStyle: 'bg-teal-100 text-teal-800',
    defaultDuration: 60,
    defaultCapacity: 8,
  },
  reformer_private: {
    value: 'reformer_private',
    label: 'Reformer Private',
    description: 'One-on-one private reformer session',
    badgeStyle: 'bg-teal-50 text-teal-700 border border-teal-200',
    defaultDuration: 60,
    defaultCapacity: 1,
  },
  reformer_duo: {
    value: 'reformer_duo',
    label: 'Reformer Duo',
    description: 'Two-person reformer session',
    badgeStyle: 'bg-teal-50 text-teal-600 border border-teal-100',
    defaultDuration: 60,
    defaultCapacity: 2,
  },
  mat_group: {
    value: 'mat_group',
    label: 'Mat Group',
    description: 'Group mat Pilates class',
    badgeStyle: 'bg-emerald-100 text-emerald-800',
    defaultDuration: 60,
    defaultCapacity: 12,
  },
  mat_private: {
    value: 'mat_private',
    label: 'Mat Private',
    description: 'One-on-one private mat session',
    badgeStyle: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    defaultDuration: 60,
    defaultCapacity: 1,
  },
  mat_duo: {
    value: 'mat_duo',
    label: 'Mat Duo',
    description: 'Two-person mat session',
    badgeStyle: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    defaultDuration: 60,
    defaultCapacity: 2,
  },
  chair: {
    value: 'chair',
    label: 'Chair Pilates',
    description: 'Pilates using a chair — accepts group credits',
    badgeStyle: 'bg-amber-100 text-amber-800',
    defaultDuration: 60,
    defaultCapacity: 8,
  },
  online: {
    value: 'online',
    label: 'Online Class',
    description: 'Virtual / online class — accepts group credits',
    badgeStyle: 'bg-orange-100 text-orange-800',
    defaultDuration: 60,
    defaultCapacity: 20,
  },
  sound_healing: {
    value: 'sound_healing',
    label: 'Sound Healing',
    description: 'Therapeutic sound healing session — uses group credits',
    badgeStyle: 'bg-purple-100 text-purple-800',
    defaultDuration: 60,
    defaultCapacity: 12,
  },
} as const;

// ─── CREDIT TYPES ──────────────────────────────────────────────────────────────

export const CREDIT_TYPES: Record<CreditType, CreditTypeConfig> = {
  pass: {
    value: 'pass',
    label: 'Credits',
    description: 'Universal credits — accepted for every group class (Mat, Reformer, Chair, Yoga, Sound Healing). Cost varies by class.',
    badgeStyle: 'bg-[#c4a88a]/20 text-[#4e2b22]',
  },
  session: {
    value: 'session',
    label: 'Session Credits',
    description: 'For private 1:1 and duo sessions — Mat costs 3, Reformer costs 5.',
    badgeStyle: 'bg-[#4e2b22]/10 text-[#4e2b22]',
  },
} as const;

// ─── DERIVED MAPPING ───────────────────────────────────────────────────────────

/** Returns the credit type a class template should default to. */
export function getCreditTypeForClassType(classType: ClassType): CreditType {
  if (
    classType === 'reformer_private' ||
    classType === 'reformer_duo' ||
    classType === 'mat_private' ||
    classType === 'mat_duo'
  ) {
    return 'session';
  }
  return 'pass';
}

// ─── UTILITY FUNCTIONS ─────────────────────────────────────────────────────────

export function getClassTypeValues(): [ClassType, ...ClassType[]] {
  return Object.keys(CLASS_TYPES) as [ClassType, ...ClassType[]];
}

export function getCreditTypeValues(): [CreditType, ...CreditType[]] {
  return Object.keys(CREDIT_TYPES) as [CreditType, ...CreditType[]];
}

export function getClassTypeConfig(value: string): ClassTypeConfig | undefined {
  return CLASS_TYPES[value as ClassType];
}

export function getCreditTypeConfig(value: string): CreditTypeConfig | undefined {
  return CREDIT_TYPES[value as CreditType];
}

export function getClassTypeLabel(value: string): string {
  return getClassTypeConfig(value)?.label ?? value;
}

export function getCreditTypeLabel(value: string): string {
  return getCreditTypeConfig(value)?.label ?? value;
}

export function getClassTypeBadgeStyle(value: string): string {
  return getClassTypeConfig(value)?.badgeStyle ?? 'bg-slate-100 text-slate-700';
}

export function getCreditTypeBadgeStyle(value: string): string {
  return getCreditTypeConfig(value)?.badgeStyle ?? 'bg-slate-100 text-slate-700';
}

export function isValidClassType(value: string): value is ClassType {
  return value in CLASS_TYPES;
}

export function isValidCreditType(value: string): value is CreditType {
  return value in CREDIT_TYPES;
}

export function getClassTypeSelectOptions(): Array<{ value: ClassType; label: string }> {
  return Object.values(CLASS_TYPES).map((c) => ({ value: c.value, label: c.label }));
}

export function getCreditTypeSelectOptions(): Array<{ value: CreditType; label: string }> {
  return Object.values(CREDIT_TYPES).map((c) => ({ value: c.value, label: c.label }));
}

export function isClassType(value: unknown): value is ClassType {
  return typeof value === 'string' && isValidClassType(value);
}

export function isCreditType(value: unknown): value is CreditType {
  return typeof value === 'string' && isValidCreditType(value);
}

// ─── LEGACY COMPATIBILITY (used in booking pages / credit package cards) ────────

export const LEGACY_CREDIT_TYPE_LABELS: Record<string, string> = {
  pass:    'Credits',
  session: 'Session Credits',
};

export const LEGACY_CREDIT_TYPE_STYLES: Record<string, string> = {
  pass:    'bg-[#c4a88a]/20 text-[#4e2b22]',
  session: 'bg-[#4e2b22]/10 text-[#4e2b22]',
};

export const LEGACY_CLASS_TYPE_OPTIONS = getClassTypeSelectOptions();
