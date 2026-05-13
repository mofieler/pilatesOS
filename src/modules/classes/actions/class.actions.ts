'use server';

import { z } from 'zod';
import { addMinutes } from 'date-fns';
import { db } from '@/db';
import { classTemplates, classSessions, instructors, users } from '@/db/schema';
import type { ClassSession, ClassTemplate, Instructor, User } from '@/db/schema';
import { asc, eq, and, isNull, gte, lte, lt, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import { cancellationService } from '@/modules/booking/services/cancellation.service';
import type { ServiceResult } from '@/modules/billing/services/credit.service';
import type { InstructorCancellationResult } from '@/modules/booking/services/cancellation.service';
import type { ClassType, CreditType } from '@/lib/config/class-types';
import { getClassTypeValues, getCreditTypeValues, getCreditTypeForClassType } from '@/lib/config/class-types';

// ─── Lookup Types (for dropdowns) ─────────────────────────────────────────────

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

export type InstructorOption = {
  id: string;
  name: string;
};

// ─── Shared Types ─────────────────────────────────────────────────────────────

export type AdminSession = ClassSession & {
  template: ClassTemplate | null;
  instructor: (Instructor & { user: User }) | null;
};

export type PaginatedSessions = {
  data: AdminSession[];
  nextCursor: Date | null;
};

// ─── Auth Guard ───────────────────────────────────────────────────────────────

async function requireAdminOrInstructor() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== 'admin' && session.user.role !== 'instructor') return null;
  return session;
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createClassTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  classType: z.enum(getClassTypeValues()),
  durationMinutes: z.number().int().positive('Duration must be a positive integer'),
  maxCapacity: z.number().int().positive('Capacity must be a positive integer'),
  creditCost: z.number().int().positive('Credit cost must be a positive integer'),
  creditType: z.enum(getCreditTypeValues()).optional(),
  instructorId: z.string().uuid('Invalid instructor ID').optional(),
  vibeTags: z.array(z.string()).optional(),
  location: z.string().max(255).optional(),
  isActive: z.boolean().optional(),
});

const getAdminSessionsSchema = z.object({
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
  limit: z.number().int().positive().max(100).optional(),
  // Cursor is the startsAt of the last item from the previous page (ISO string coerced to Date).
  cursor: z.coerce.date().optional(),
});

const cancelClassSessionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  reason: z.string().min(1, 'Cancellation reason is required').max(500),
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new class template.
 * Admin and instructors only.
 */
export async function createClassTemplateAction(
  input: z.infer<typeof createClassTemplateSchema>,
): Promise<ServiceResult<ClassTemplate>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) {
    return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };
  }

  const parsed = createClassTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
      code: 'INVALID_STATE',
    };
  }

  const {
    name,
    description,
    classType,
    durationMinutes,
    maxCapacity,
    creditCost,
    creditType,
    instructorId,
    vibeTags,
    location,
    isActive,
  } = parsed.data;

  try {
    const [template] = await db
      .insert(classTemplates)
      .values({
        name,
        description,
        classType,
        durationMinutes,
        maxCapacity,
        creditCost,
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

/**
 * Fetch all sessions with template and instructor data for the admin panel.
 * Cursor-based pagination ordered by startsAt descending (most recent first).
 * [FIX-4] Uses cursor pagination, not offset.
 */
export async function getAdminSessionsAction(
  input: z.infer<typeof getAdminSessionsSchema> = {},
): Promise<ServiceResult<PaginatedSessions>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) {
    return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };
  }

  const parsed = getAdminSessionsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
      code: 'INVALID_STATE',
    };
  }

  const { status, limit, cursor } = parsed.data;
  const safeLimit = Math.min(limit ?? 50, 100);

  try {
    const rows = await db.query.classSessions.findMany({
      with: {
        template: true,
        instructor: { with: { user: true } },
      },
      where: (sessions, { eq, and, lt }) =>
        and(
          status !== undefined ? eq(sessions.status, status) : undefined,
          cursor !== undefined ? lt(sessions.startsAt, cursor) : undefined,
        ),
      orderBy: (sessions, { desc }) => [desc(sessions.startsAt)],
      limit: safeLimit + 1,
    });

    const hasNextPage = rows.length > safeLimit;
    const data = hasNextPage ? rows.slice(0, safeLimit) : rows;
    const nextCursor =
      hasNextPage && data.length > 0 ? data[data.length - 1].startsAt : null;

    return {
      success: true,
      data: {
        data: data as AdminSession[],
        nextCursor,
      },
    };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'getAdminSessionsAction failed', err }));
    return { success: false, error: 'Failed to fetch sessions.', code: 'DB_ERROR' };
  }
}

/**
 * Cancel an entire class session as admin or instructor.
 * Delegates to cancellationService which refunds all bookings atomically.
 */
export async function cancelClassSessionAction(
  input: z.infer<typeof cancelClassSessionSchema>,
): Promise<ServiceResult<InstructorCancellationResult>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) {
    return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };
  }

  const parsed = cancelClassSessionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
      code: 'INVALID_STATE',
    };
  }

  return cancellationService.cancelSessionByInstructor(
    parsed.data.sessionId,
    authSession.user.id,
    parsed.data.reason,
  );
}

// ─── Create a scheduled session from a template ───────────────────────────────

const createClassSessionSchema = z.object({
  templateId: z.string().uuid('Invalid template ID'),
  // YYYY-MM-DD
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (expected YYYY-MM-DD)'),
  // HH:MM
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time (expected HH:MM)'),
  // Optional overrides
  instructorId: z.string().uuid().optional().nullable(),
});

export async function createClassSessionAction(
  input: z.infer<typeof createClassSessionSchema>,
): Promise<ServiceResult<ClassSession>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) {
    return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };
  }

  const parsed = createClassSessionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
      code: 'INVALID_STATE',
    };
  }

  const { templateId, date, time, instructorId } = parsed.data;

  // Fetch template to get duration and defaults
  const [template] = await db
    .select()
    .from(classTemplates)
    .where(eq(classTemplates.id, templateId))
    .limit(1);

  if (!template) {
    return { success: false, error: 'Class template not found.', code: 'NOT_FOUND' };
  }

  const startsAt = new Date(`${date}T${time}:00`);
  if (isNaN(startsAt.getTime())) {
    return { success: false, error: 'Invalid date or time.', code: 'INVALID_STATE' };
  }

  const endsAt = addMinutes(startsAt, template.durationMinutes);
  const resolvedInstructorId = instructorId ?? template.instructorId ?? null;

  try {
    const [session] = await db
      .insert(classSessions)
      .values({
        templateId,
        instructorId: resolvedInstructorId,
        startsAt,
        endsAt,
        maxCapacity: template.maxCapacity,
        bookedCount: 0,
        waitlistCount: 0,
        status: 'scheduled',
      })
      .returning();

    revalidatePath('/admin/classes');
    revalidatePath('/book');

    // Push to Google Calendar — awaited so the push completes before the
    // server action returns (fire-and-forget IIFEs can be killed early in
    // Next.js server action context). pushSession never throws; failures are
    // written to googleCalendarSyncError and retried by the cron sweep.
    try {
      const { pushSession } = await import(
        '@/modules/calendar/services/calendar-sync.service'
      );
      await pushSession(session.id);
    } catch (err) {
      console.warn('[calendar] New session GCal push failed:', err);
    }

    return { success: true, data: session as ClassSession };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'createClassSessionAction failed', err }));
    return { success: false, error: 'Failed to create session.', code: 'DB_ERROR' };
  }
}

/**
 * Return all active class templates for the "New Class" form dropdown.
 */
export async function getClassTemplatesAction(): Promise<ServiceResult<TemplateOption[]>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) {
    return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };
  }

  try {
    // Fetch templates
    const templates = await db
      .select()
      .from(classTemplates)
      .where(eq(classTemplates.isActive, true))
      .orderBy(asc(classTemplates.name));

    // Fetch all active instructors with names
    const instructorList = await db
      .select({ id: instructors.id, name: users.name })
      .from(instructors)
      .innerJoin(users, and(eq(instructors.userId, users.id), isNull(users.deletedAt)))
      .where(eq(instructors.isActive, true));

    const instructorMap = new Map(instructorList.map((i) => [i.id, i.name]));

    const rows: TemplateOption[] = templates.map((t) => ({
      id: t.id,
      name: t.name,
      classType: t.classType,
      durationMinutes: t.durationMinutes,
      maxCapacity: t.maxCapacity,
      creditCost: t.creditCost,
      creditType: t.creditType,
      instructorId: t.instructorId,
      instructorName: t.instructorId ? instructorMap.get(t.instructorId) ?? null : null,
      location: t.location,
    }));

    return { success: true, data: rows };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'getClassTemplatesAction failed', err }));
    return { success: false, error: 'Failed to fetch templates.', code: 'DB_ERROR' };
  }
}

// ─── Admin: list ALL templates (active + inactive) with instructor ────────────

export type AdminTemplateRow = TemplateOption & { isActive: boolean; description: string | null };

export async function getClassTemplatesAdminAction(): Promise<ServiceResult<AdminTemplateRow[]>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) {
    return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };
  }

  try {
    const rows = await db
      .select({
        id:              classTemplates.id,
        name:            classTemplates.name,
        description:     classTemplates.description,
        classType:       classTemplates.classType,
        durationMinutes: classTemplates.durationMinutes,
        maxCapacity:     classTemplates.maxCapacity,
        creditCost:      classTemplates.creditCost,
        creditType:      classTemplates.creditType,
        instructorId:    classTemplates.instructorId,
        location:        classTemplates.location,
        isActive:        classTemplates.isActive,
        instructorName:  users.name,
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

// ─── Admin: update a class template ──────────────────────────────────────────

const updateClassTemplateSchema = z.object({
  id:              z.string().uuid(),
  name:            z.string().min(1).max(255).optional(),
  description:     z.string().max(1000).optional().nullable(),
  classType:       z.enum(['private', 'duo', 'group', 'reformer', 'mat', 'online', 'sound_healing']).optional(),
  durationMinutes: z.number().int().positive().optional(),
  maxCapacity:     z.number().int().positive().optional(),
  creditCost:      z.number().int().positive().optional(),
  creditType:      z.enum(['mat_group', 'reformer_group', 'private_session', 'duo_group', 'general_group', 'online_class', 'sound_healing']).optional(),
  instructorId:    z.string().uuid().nullable().optional(),
  location:        z.string().max(255).nullable().optional(),
  isActive:        z.boolean().optional(),
});

export async function deleteClassTemplateAction(
  input: { id: string },
): Promise<ServiceResult<null>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid ID.', code: 'INVALID_STATE' };

  try {
    const deleted = await db
      .delete(classTemplates)
      .where(eq(classTemplates.id, parsed.data.id))
      .returning({ id: classTemplates.id });

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

export async function deleteClassSessionAction(
  input: { id: string },
): Promise<ServiceResult<null>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid ID.', code: 'INVALID_STATE' };

  const [session] = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, parsed.data.id))
    .limit(1);

  if (!session) return { success: false, error: 'Session not found.', code: 'NOT_FOUND' };

  if (session.status !== 'cancelled' && session.bookedCount > 0) {
    return { success: false, error: 'Only cancelled sessions or sessions with no bookings can be deleted.', code: 'INVALID_STATE' };
  }

  // Snapshot the GCal IDs BEFORE deleting — we need them to remove the event in Google.
  const googleEventId = session.googleCalendarEventId;
  const googleCalendarId = session.googleCalendarId;
  const instructorId = session.instructorId;

  try {
    await db.delete(classSessions).where(eq(classSessions.id, parsed.data.id));
    revalidatePath('/admin/classes');

    // Fire-and-forget GCal cleanup — delete the mirror event if one existed.
    if (googleEventId && googleCalendarId && instructorId) {
      (async () => {
        try {
          const { deleteEventDirect } = await import(
            '@/modules/calendar/services/calendar-sync.service'
          );
          await deleteEventDirect({
            instructorDbId: instructorId,
            googleCalendarId,
            googleEventId,
          });
        } catch (err) {
          console.warn('[calendar] Session delete GCal cleanup failed:', err);
        }
      })();
    }

    return { success: true, data: null };
  } catch (err: unknown) {
    console.error(JSON.stringify({ level: 'error', msg: 'deleteClassSessionAction failed', err }));
    return { success: false, error: 'Failed to delete session.', code: 'DB_ERROR' };
  }
}

export async function updateClassTemplateAction(
  input: z.infer<typeof updateClassTemplateSchema>,
): Promise<ServiceResult<ClassTemplate>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) {
    return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };
  }

  const parsed = updateClassTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.', code: 'INVALID_STATE' };
  }

  const { id, ...fields } = parsed.data;

  // Credit type is always derived from class type — never stored independently.
  if (fields.classType) {
    fields.creditType = getCreditTypeForClassType(fields.classType);
  }

  try {
    const [template] = await db
      .update(classTemplates)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(classTemplates.id, id))
      .returning();

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

// ─── Week View ────────────────────────────────────────────────────────────────

export type WeekViewSessionData = {
  id: string;
  templateName: string;
  classType: ClassType;
  creditType: CreditType;
  creditCost: number;
  durationMinutes: number;
  instructorId: string | null;
  instructorName: string | null;
  startsAt: Date;
  endsAt: Date;
  bookedCount: number;
  maxCapacity: number;
  status: string;
};

export async function getSessionsForRangeAction(
  from: Date,
  to: Date,
): Promise<ServiceResult<WeekViewSessionData[]>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  try {
    const rows = await db.query.classSessions.findMany({
      with: {
        template: true,
        instructor: { with: { user: true } },
      },
      where: (s, { and, gte, lte }) => and(gte(s.startsAt, from), lte(s.startsAt, to)),
      orderBy: (s, { asc }) => [asc(s.startsAt)],
    });

    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        templateName: r.template?.name ?? '—',
        classType: (r.template?.classType ?? 'group') as ClassType,
        creditType: (r.template?.creditType ?? 'mat_group') as CreditType,
        creditCost: r.template?.creditCost ?? 0,
        durationMinutes: r.template?.durationMinutes ?? 60,
        instructorId: r.instructorId,
        instructorName: r.instructor?.user?.name ?? null,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        bookedCount: r.bookedCount,
        maxCapacity: r.maxCapacity,
        status: r.status,
      })),
    };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'getSessionsForRangeAction failed', err }));
    return { success: false, error: 'Failed to fetch sessions.', code: 'DB_ERROR' };
  }
}

// ─── Slot availability check ──────────────────────────────────────────────────

export type ConflictItem = {
  type: 'session' | 'gcal_block';
  summary: string;
  startsAt: Date;
  endsAt: Date;
};

export type AvailabilityResult = {
  conflicts: ConflictItem[];
  suggestions: string[]; // HH:MM time strings for the same date
};

const checkSlotSchema = z.object({
  instructorId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.number().int().positive(),
});

export async function checkSlotAvailabilityAction(
  input: z.infer<typeof checkSlotSchema>,
): Promise<ServiceResult<AvailabilityResult>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = checkSlotSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input.', code: 'INVALID_STATE' };

  const { instructorId, date, time, durationMinutes } = parsed.data;
  const startsAt = new Date(`${date}T${time}:00`);
  const endsAt = addMinutes(startsAt, durationMinutes);

  try {
    const { getBlocksInRange } = await import(
      '@/modules/calendar/services/calendar-sync.service'
    );

    const conflicts: ConflictItem[] = [];

    if (instructorId) {
      // Check Pilateq sessions that overlap the slot
      const overlappingSessions = await db
        .select({
          startsAt: classSessions.startsAt,
          endsAt: classSessions.endsAt,
        })
        .from(classSessions)
        .where(
          and(
            eq(classSessions.instructorId, instructorId),
            ne(classSessions.status, 'cancelled'),
            lt(classSessions.startsAt, endsAt),
            gte(classSessions.endsAt, startsAt),
          ),
        );

      for (const s of overlappingSessions) {
        conflicts.push({
          type: 'session',
          summary: 'Pilateq class',
          startsAt: s.startsAt,
          endsAt: s.endsAt,
        });
      }

      // Check GCal blocks that overlap
      const blocks = await getBlocksInRange(startsAt, endsAt);
      for (const b of blocks) {
        if (b.instructorId === instructorId) {
          conflicts.push({
            type: 'gcal_block',
            summary: b.summary ?? 'Blocked (Google Calendar)',
            startsAt: b.startsAt,
            endsAt: b.endsAt,
          });
        }
      }
    }

    // Build suggestions: scan 06:00–21:00 in 30-min steps on the same date
    const suggestions: string[] = [];
    if (instructorId && conflicts.length > 0) {
      const dayStart = new Date(`${date}T00:00:00`);
      const dayEnd = new Date(`${date}T23:59:59`);

      const daySessions = await db
        .select({ startsAt: classSessions.startsAt, endsAt: classSessions.endsAt })
        .from(classSessions)
        .where(
          and(
            eq(classSessions.instructorId, instructorId),
            ne(classSessions.status, 'cancelled'),
            gte(classSessions.startsAt, dayStart),
            lte(classSessions.startsAt, dayEnd),
          ),
        );

      const dayBlocks = await getBlocksInRange(dayStart, dayEnd);
      const busyIntervals = [
        ...daySessions,
        ...dayBlocks.filter((b) => b.instructorId === instructorId),
      ];

      for (let h = 6; h <= 20; h++) {
        for (const m of [0, 30]) {
          const candidateStart = new Date(`${date}T${String(h).padStart(2, '0')}:${m === 0 ? '00' : '30'}:00`);
          const candidateEnd = addMinutes(candidateStart, durationMinutes);
          const busy = busyIntervals.some(
            (b) => b.startsAt < candidateEnd && b.endsAt > candidateStart,
          );
          if (!busy) {
            suggestions.push(`${String(h).padStart(2, '0')}:${m === 0 ? '00' : '30'}`);
            if (suggestions.length >= 3) break;
          }
        }
        if (suggestions.length >= 3) break;
      }
    }

    return { success: true, data: { conflicts, suggestions } };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'checkSlotAvailabilityAction failed', err }));
    return { success: false, error: 'Failed to check availability.', code: 'DB_ERROR' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return all active instructors for the optional instructor override dropdown.
 */
export async function getInstructorsAction(): Promise<ServiceResult<InstructorOption[]>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) {
    return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };
  }

  try {
    const rows = await db
      .select({ id: instructors.id, name: users.name })
      .from(instructors)
      .innerJoin(users, and(eq(instructors.userId, users.id), isNull(users.deletedAt)))
      .where(eq(instructors.isActive, true))
      .orderBy(asc(users.name));

    return { success: true, data: rows };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'getInstructorsAction failed', err }));
    return { success: false, error: 'Failed to fetch instructors.', code: 'DB_ERROR' };
  }
}
