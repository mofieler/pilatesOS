'use server';

import { z } from 'zod';
import { db } from '@/db';
import { membershipPlans, userMemberships, users } from '@/db/schema';
import type { CreditType } from '@/db/schema';
import { eq, and, isNull, desc, asc } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { addDays } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { getCreditTypeValues } from '@/lib/config/class-types';

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') return null;
  return session;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const planCreateSchema = z.object({
  name:          z.string().min(1, 'Name is required').max(255),
  description:   z.string().max(1000).optional().nullable(),
  creditType:    z.enum(getCreditTypeValues()),
  weeklyCredits: z.number().int().positive('Weekly credits must be positive'),
  durationWeeks: z.number().int().positive('Duration must be positive'),
  priceCents:    z.number().int().min(0, 'Price must be 0 or more'),
  currency:      z.string().length(3).default('eur'),
  isActive:      z.boolean().default(true),
  sortOrder:     z.number().int().min(0).default(0),
});

const planUpdateSchema = planCreateSchema.partial().extend({ id: z.string().uuid() });

const assignSchema = z.object({
  userId:    z.string().uuid(),
  planId:    z.string().uuid(),
  startedAt: z.coerce.date(),
});

// ─── Plan CRUD ────────────────────────────────────────────────────────────────

export type MembershipPlanRow = Awaited<ReturnType<typeof getMembershipPlansAction>>['data'][number];

export async function getMembershipPlansAction() {
  const session = await requireAdmin();
  if (!session) return { success: false as const, error: 'Unauthorized', data: [] as never[] };

  try {
    const plans = await db
      .select()
      .from(membershipPlans)
      .orderBy(asc(membershipPlans.sortOrder), asc(membershipPlans.name));
    return { success: true as const, data: plans };
  } catch {
    return { success: false as const, error: 'Failed to fetch plans', data: [] as never[] };
  }
}

export async function createMembershipPlanAction(input: z.infer<typeof planCreateSchema>) {
  const session = await requireAdmin();
  if (!session) return { success: false as const, error: 'Unauthorized' };

  const parsed = planCreateSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  try {
    const [plan] = await db.insert(membershipPlans).values(parsed.data).returning();
    revalidatePath('/admin/memberships');
    return { success: true as const, data: plan };
  } catch {
    return { success: false as const, error: 'Failed to create plan' };
  }
}

export async function updateMembershipPlanAction(input: z.infer<typeof planUpdateSchema>) {
  const session = await requireAdmin();
  if (!session) return { success: false as const, error: 'Unauthorized' };

  const parsed = planUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { id, ...fields } = parsed.data;

  try {
    const [plan] = await db
      .update(membershipPlans)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(membershipPlans.id, id))
      .returning();
    if (!plan) return { success: false as const, error: 'Plan not found' };
    revalidatePath('/admin/memberships');
    return { success: true as const, data: plan };
  } catch {
    return { success: false as const, error: 'Failed to update plan' };
  }
}

export async function deleteMembershipPlanAction(input: { id: string }) {
  const session = await requireAdmin();
  if (!session) return { success: false as const, error: 'Unauthorized' };

  try {
    const [active] = await db
      .select({ id: userMemberships.id })
      .from(userMemberships)
      .where(and(eq(userMemberships.planId, input.id), eq(userMemberships.status, 'active')))
      .limit(1);

    if (active) return { success: false as const, error: 'Cannot delete — active members use this plan. Deactivate it instead.' };

    const deleted = await db.delete(membershipPlans).where(eq(membershipPlans.id, input.id)).returning({ id: membershipPlans.id });
    if (deleted.length === 0) return { success: false as const, error: 'Plan not found' };

    revalidatePath('/admin/memberships');
    return { success: true as const, data: null };
  } catch {
    return { success: false as const, error: 'Failed to delete plan' };
  }
}

// ─── User memberships ─────────────────────────────────────────────────────────

export type ActiveMembershipRow = Awaited<ReturnType<typeof getActiveMembershipsAction>>['data'][number];

export async function getActiveMembershipsAction() {
  const session = await requireAdmin();
  if (!session) return { success: false as const, error: 'Unauthorized', data: [] as never[] };

  try {
    const rows = await db
      .select({
        id:                 userMemberships.id,
        userId:             userMemberships.userId,
        userName:           users.name,
        userEmail:          users.email,
        planId:             userMemberships.planId,
        planName:           membershipPlans.name,
        creditType:         userMemberships.creditType,
        weeklyCredits:      userMemberships.weeklyCredits,
        status:             userMemberships.status,
        startedAt:          userMemberships.startedAt,
        endsAt:             userMemberships.endsAt,
        lastCreditGrantAt:  userMemberships.lastCreditGrantAt,
        nextCreditGrantAt:  userMemberships.nextCreditGrantAt,
        createdAt:          userMemberships.createdAt,
      })
      .from(userMemberships)
      .innerJoin(users, and(eq(userMemberships.userId, users.id), isNull(users.deletedAt)))
      .innerJoin(membershipPlans, eq(userMemberships.planId, membershipPlans.id))
      .orderBy(desc(userMemberships.createdAt));

    return { success: true as const, data: rows };
  } catch {
    return { success: false as const, error: 'Failed to fetch memberships', data: [] as never[] };
  }
}

export async function getStudentsListAction() {
  const session = await requireAdmin();
  if (!session) return { success: false as const, error: 'Unauthorized', data: [] as never[] };

  try {
    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.role, 'student'), isNull(users.deletedAt)))
      .orderBy(asc(users.name));
    return { success: true as const, data: rows };
  } catch {
    return { success: false as const, error: 'Failed to fetch students', data: [] as never[] };
  }
}

export async function assignMembershipAction(input: z.infer<typeof assignSchema>) {
  const session = await requireAdmin();
  if (!session) return { success: false as const, error: 'Unauthorized' };

  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { userId, planId, startedAt } = parsed.data;

  try {
    const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, planId)).limit(1);
    if (!plan) return { success: false as const, error: 'Plan not found' };
    if (!plan.isActive) return { success: false as const, error: 'Plan is inactive' };

    const [existing] = await db
      .select({ id: userMemberships.id })
      .from(userMemberships)
      .where(and(eq(userMemberships.userId, userId), eq(userMemberships.status, 'active')))
      .limit(1);

    if (existing) return { success: false as const, error: 'Student already has an active membership' };

    const endsAt = addDays(startedAt, plan.durationWeeks * 7);

    const [membership] = await db.insert(userMemberships).values({
      userId,
      planId,
      creditType:         plan.creditType as CreditType,
      weeklyCredits:      plan.weeklyCredits,
      startedAt,
      endsAt,
      status:             'active',
      nextCreditGrantAt:  startedAt,
    }).returning();

    revalidatePath('/admin/memberships');
    return { success: true as const, data: membership };
  } catch {
    return { success: false as const, error: 'Failed to assign membership' };
  }
}

export async function cancelUserMembershipAction(input: { membershipId: string }) {
  const session = await requireAdmin();
  if (!session) return { success: false as const, error: 'Unauthorized' };

  try {
    const [membership] = await db
      .update(userMemberships)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(userMemberships.id, input.membershipId))
      .returning();

    if (!membership) return { success: false as const, error: 'Membership not found' };

    revalidatePath('/admin/memberships');
    return { success: true as const, data: membership };
  } catch {
    return { success: false as const, error: 'Failed to cancel membership' };
  }
}

// ─── Public plan listing (student-facing) ────────────────────────────────────

export async function getActiveMembershipPlansAction() {
  try {
    const plans = await db
      .select()
      .from(membershipPlans)
      .where(eq(membershipPlans.isActive, true))
      .orderBy(asc(membershipPlans.sortOrder), asc(membershipPlans.name));
    return { success: true as const, data: plans };
  } catch {
    return { success: false as const, error: 'Failed to fetch plans', data: [] as never[] };
  }
}

// ─── Student self-subscribe ───────────────────────────────────────────────────

const selfSubscribeSchema = z.object({
  planId:                     z.string().uuid(),
  acceptedTerms:              z.boolean().refine((v) => v, 'You must accept the Terms & Conditions'),
  acceptedWithdrawalWaiver:   z.boolean().refine((v) => v, 'You must accept the withdrawal waiver'),
  purchaseIpAddress:          z.string().max(45).optional(),
});

export async function subscribeMembershipAction(input: z.infer<typeof selfSubscribeSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: 'Unauthorized' };

  const parsed = selfSubscribeSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { planId, acceptedTerms, acceptedWithdrawalWaiver, purchaseIpAddress } = parsed.data;
  const userId = session.user.id;
  const now = new Date();

  try {
    const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, planId)).limit(1);
    if (!plan) return { success: false as const, error: 'Plan not found' };
    if (!plan.isActive) return { success: false as const, error: 'This plan is no longer available' };

    const [existing] = await db
      .select({ id: userMemberships.id })
      .from(userMemberships)
      .where(and(eq(userMemberships.userId, userId), eq(userMemberships.status, 'active')))
      .limit(1);

    if (existing) return { success: false as const, error: 'You already have an active membership' };

    const endsAt = addDays(now, plan.durationWeeks * 7);

    const [membership] = await db.insert(userMemberships).values({
      userId,
      planId,
      creditType:                 plan.creditType as CreditType,
      weeklyCredits:              plan.weeklyCredits,
      startedAt:                  now,
      endsAt,
      status:                     'active',
      nextCreditGrantAt:          now,
      selfPurchased:              true,
      acceptedTermsAt:            acceptedTerms ? now : undefined,
      acceptedWithdrawalWaiverAt: acceptedWithdrawalWaiver ? now : undefined,
      purchaseIpAddress:          purchaseIpAddress ?? null,
    }).returning();

    revalidatePath('/credits');
    revalidatePath('/');
    return { success: true as const, data: membership };
  } catch {
    return { success: false as const, error: 'Failed to subscribe. Please try again.' };
  }
}

// ─── Student-facing ───────────────────────────────────────────────────────────

export type MyMembership = NonNullable<Awaited<ReturnType<typeof getMyMembershipAction>>>;

export async function getMyMembershipAction() {
  const session = await auth();
  if (!session?.user?.id) return null;

  try {
    const [row] = await db
      .select({
        id:                userMemberships.id,
        planName:          membershipPlans.name,
        planDescription:   membershipPlans.description,
        creditType:        userMemberships.creditType,
        weeklyCredits:     userMemberships.weeklyCredits,
        status:            userMemberships.status,
        startedAt:         userMemberships.startedAt,
        endsAt:            userMemberships.endsAt,
        lastCreditGrantAt: userMemberships.lastCreditGrantAt,
        nextCreditGrantAt: userMemberships.nextCreditGrantAt,
      })
      .from(userMemberships)
      .innerJoin(membershipPlans, eq(userMemberships.planId, membershipPlans.id))
      .where(and(
        eq(userMemberships.userId, session.user.id),
        eq(userMemberships.status, 'active'),
      ))
      .orderBy(desc(userMemberships.startedAt))
      .limit(1);

    return row ?? null;
  } catch {
    return null;
  }
}
