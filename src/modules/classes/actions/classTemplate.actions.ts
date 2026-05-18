'use server';

import { z } from 'zod';
import { db } from '@/db';
import { classTemplates, instructors, users } from '@/db/schema';
import type { ClassTemplate } from '@/db/schema';
import { asc, eq, and, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import type { ServiceResult } from '@/modules/billing/services/credit.service';
import type { ClassType, CreditType } from '@/lib/config/class-types';
import { getClassTypeValues, getCreditTypeValues, getCreditTypeForClassType } from '@/lib/config/class-types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TemplateOption = {
  id: string;
  name: string;
  classType: ClassType;
  durationMinutes: number;
  maxCapacity: number;
  creditCost: number;
  creditType: CreditType;
  instructorId: string | null;
  instructorName: string | null;
  location: string | null;
};

export type AdminTemplateRow = TemplateOption & { isActive: boolean; description: string | null };

// ─── Auth Guards ─────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') return null;
  return session;
}

async function requireAdminOrInstructor() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== 'admin' && session.user.role !== 'instructor') return null;
  return session;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createClassTemplateSchema = z.object({
  name:            z.string().min(1, 'Name is required').max(255),
  description:     z.string().optional(),
  classType:       z.enum(getClassTypeValues()),
  durationMinutes: z.number().int().positive('Duration must be a positive integer'),
  maxCapacity:     z.number().int().positive('Capacity must be a positive integer'),
  creditCost:      z.number().int().min(0, 'Credit cost must be 0 or greater'),
  creditType:      z.enum(getCreditTypeValues()).optional(),
  instructorId:    z.string().uuid('Invalid instructor ID').optional(),
  vibeTags:        z.array(z.string()).optional(),
  location:        z.string().max(255).optional(),
  isActive:        z.boolean().optional(),
});

const updateClassTemplateSchema = z.object({
  id:              z.string().uuid(),
  name:            z.string().min(1).max(255).optional(),
  description:     z.string().max(1000).optional().nullable(),
  classType:       z.enum(getClassTypeValues()).optional(),
  durationMinutes: z.number().int().positive().optional(),
  maxCapacity:     z.number().int().positive().optional(),
  creditCost:      z.number().int().min(0).optional(),
  creditType:      z.enum(getCreditTypeValues()).optional(),
  instructorId:    z.string().uuid().nullable().optional(),
  location:        z.string().max(255).nullable().optional(),
  isActive:        z.boolean().optional(),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createClassTemplateAction(
  input: z.infer<typeof createClassTemplateSchema>,
): Promise<ServiceResult<ClassTemplate>> {
  const authSession = await requireAdmin();
  if (!authSession) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = createClassTemplateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.', code: 'INVALID_STATE' };

  const { name, description, classType, durationMinutes, maxCapacity, creditCost, instructorId, vibeTags, location, isActive } = parsed.data;

  try {
    const [template] = await db
      .insert(classTemplates)
      .values({
        name, description, classType, durationMinutes, maxCapacity, creditCost,
        creditType: getCreditTypeForClassType(classType),
        instructorId: instructorId || null,
        vibeTags: vibeTags ?? [],
        location: location || null,
        isActive: isActive === true,
      })
      .returning();

    revalidatePath('/admin/classes');
    return { success: true, data: template as ClassTemplate };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'createClassTemplateAction failed', err }));
    return { success: false, error: 'Failed to create class template.', code: 'DB_ERROR' };
  }
}

export async function getClassTemplatesAction(): Promise<ServiceResult<TemplateOption[]>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  try {
    const templates = await db.select().from(classTemplates).where(eq(classTemplates.isActive, true)).orderBy(asc(classTemplates.name));
    const instructorList = await db
      .select({ id: instructors.id, name: users.name })
      .from(instructors)
      .innerJoin(users, and(eq(instructors.userId, users.id), isNull(users.deletedAt)))
      .where(eq(instructors.isActive, true));

    const instructorMap = new Map(instructorList.map((i) => [i.id, i.name]));
    return {
      success: true,
      data: templates.map((t) => ({
        id: t.id, name: t.name, classType: t.classType, durationMinutes: t.durationMinutes,
        maxCapacity: t.maxCapacity, creditCost: t.creditCost, creditType: t.creditType,
        instructorId: t.instructorId,
        instructorName: t.instructorId ? instructorMap.get(t.instructorId) ?? null : null,
        location: t.location,
      })),
    };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'getClassTemplatesAction failed', err }));
    return { success: false, error: 'Failed to fetch templates.', code: 'DB_ERROR' };
  }
}

export async function getClassTemplatesAdminAction(): Promise<ServiceResult<AdminTemplateRow[]>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  try {
    const rows = await db
      .select({
        id: classTemplates.id, name: classTemplates.name, description: classTemplates.description,
        classType: classTemplates.classType, durationMinutes: classTemplates.durationMinutes,
        maxCapacity: classTemplates.maxCapacity, creditCost: classTemplates.creditCost,
        creditType: classTemplates.creditType, instructorId: classTemplates.instructorId,
        location: classTemplates.location, isActive: classTemplates.isActive,
        instructorName: users.name,
      })
      .from(classTemplates)
      .leftJoin(instructors, eq(classTemplates.instructorId, instructors.id))
      .leftJoin(users, and(eq(instructors.userId, users.id), isNull(users.deletedAt)))
      .orderBy(asc(classTemplates.name));

    return { success: true, data: rows as AdminTemplateRow[] };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'getClassTemplatesAdminAction failed', err }));
    return { success: false, error: 'Failed to fetch templates.', code: 'DB_ERROR' };
  }
}

export async function updateClassTemplateAction(
  input: z.infer<typeof updateClassTemplateSchema>,
): Promise<ServiceResult<ClassTemplate>> {
  const authSession = await requireAdmin();
  if (!authSession) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = updateClassTemplateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.', code: 'INVALID_STATE' };

  const { id, ...fields } = parsed.data;
  if (fields.classType) fields.creditType = getCreditTypeForClassType(fields.classType);

  try {
    const [template] = await db.update(classTemplates).set({ ...fields, updatedAt: new Date() }).where(eq(classTemplates.id, id)).returning();
    if (!template) return { success: false, error: 'Template not found.', code: 'NOT_FOUND' };

    revalidatePath('/admin/templates');
    revalidatePath('/admin/classes');
    revalidatePath('/book');
    return { success: true, data: template as ClassTemplate };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'updateClassTemplateAction failed', err }));
    return { success: false, error: 'Failed to update template.', code: 'DB_ERROR' };
  }
}

export async function deleteClassTemplateAction(input: { id: string }): Promise<ServiceResult<null>> {
  const authSession = await requireAdmin();
  if (!authSession) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid ID.', code: 'INVALID_STATE' };

  try {
    const deleted = await db.delete(classTemplates).where(eq(classTemplates.id, parsed.data.id)).returning({ id: classTemplates.id });
    if (deleted.length === 0) return { success: false, error: 'Template not found.', code: 'NOT_FOUND' };

    revalidatePath('/admin/templates');
    revalidatePath('/admin/classes');
    return { success: true, data: null };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23503') {
      return { success: false, error: 'Cannot delete — this template is used by one or more sessions. Deactivate it instead.', code: 'INVALID_STATE' };
    }
    console.error(JSON.stringify({ level: 'error', msg: 'deleteClassTemplateAction failed', err }));
    return { success: false, error: 'Failed to delete template.', code: 'DB_ERROR' };
  }
}
