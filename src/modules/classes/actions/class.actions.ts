'use server';

import { z } from 'zod';
import { addMinutes } from 'date-fns';
import { db } from '@/db';
import { classTemplates, classSessions, instructors, users, bookings, creditBalances } from '@/db/schema';
import type { ClassSession, ClassTemplate, Instructor, User } from '@/db/schema';
import { asc, eq, and, isNull, gte, gt, lte, lt, ne } from 'drizzle-orm';
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
  creditCost: z.number().int().min(1, 'Credit cost must be at least 1'),
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
  // UTC ISO string produced by new Date(`YYYY-MM-DDTHH:MM:00`).toISOString() in the browser
  startsAtISO: z.string().datetime(),
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

  const { templateId, startsAtISO, instructorId } = parsed.data;

  // Fetch template to get duration and defaults
  const [template] = await db
    .select()
    .from(classTemplates)
    .where(eq(classTemplates.id, templateId))
    .limit(1);

  if (!template) {
    return { success: false, error: 'Class template not found.', code: 'NOT_FOUND' };
  }

  // startsAtISO is already UTC — browser converts local time before sending
  const startsAt = new Date(startsAtISO);
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
  classType:       z.enum(getClassTypeValues()).optional(),
  durationMinutes: z.number().int().positive().optional(),
  maxCapacity:     z.number().int().positive().optional(),
  creditCost:      z.number().int().min(1).optional(),
  creditType:      z.enum(getCreditTypeValues()).optional(),
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

  if (session.status !== 'cancelled') {
    return { success: false, error: 'Only cancelled sessions can be deleted.', code: 'INVALID_STATE' };
  }

  // Snapshot the GCal IDs BEFORE deleting — we need them to remove the event in Google.
  const googleEventId = session.googleCalendarEventId;
  const googleCalendarId = session.googleCalendarId;
  const instructorId = session.instructorId;

  try {
    // The bookings FK is RESTRICT — delete all cancelled bookings for this session first,
    // then delete the session. Credit transactions already captured the full audit trail.
    await db.transaction(async (tx) => {
      await tx.delete(bookings)
        .where(and(eq(bookings.sessionId, parsed.data.id), eq(bookings.status, 'cancelled')));
      await tx.delete(classSessions).where(eq(classSessions.id, parsed.data.id));
    });
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
        classType: (r.template?.classType ?? 'mat_group') as ClassType,
        creditType: (r.template?.creditType ?? 'mat') as CreditType,
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
  // UTC ISO string produced by new Date(`YYYY-MM-DDTHH:MM:00`).toISOString() in the browser
  startsAtISO: z.string().datetime(),
  durationMinutes: z.number().int().positive(),
  // new Date().getTimezoneOffset() from the browser — used to generate local-time suggestions
  tzOffsetMinutes: z.number().int(),
});

export async function checkSlotAvailabilityAction(
  input: z.infer<typeof checkSlotSchema>,
): Promise<ServiceResult<AvailabilityResult>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = checkSlotSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input.', code: 'INVALID_STATE' };

  const { instructorId, startsAtISO, durationMinutes, tzOffsetMinutes } = parsed.data;
  // startsAtISO is already UTC — browser converts local time before sending
  const startsAt = new Date(startsAtISO);
  const endsAt = addMinutes(startsAt, durationMinutes);

  try {
    const { getBlocksInRange } = await import(
      '@/modules/calendar/services/calendar-sync.service'
    );

    const conflicts: ConflictItem[] = [];

    if (instructorId) {
      // Check Pilateq sessions that overlap the slot.
      // Use strict gt on endsAt so back-to-back classes (A ends at 10:00, B starts at 10:00)
      // are NOT flagged as conflicts.
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
            gt(classSessions.endsAt, startsAt),
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

      // Check GCal blocks that overlap.
      // Include blocks belonging to this instructor AND admin-level blocks (instructorId = null),
      // since admins connect their own calendars which apply studio-wide.
      const blocks = await getBlocksInRange(startsAt, endsAt);
      for (const b of blocks) {
        if (b.instructorId === instructorId || b.instructorId === null) {
          conflicts.push({
            type: 'gcal_block',
            summary: b.summary ?? 'Blocked (Google Calendar)',
            startsAt: b.startsAt,
            endsAt: b.endsAt,
          });
        }
      }
    }

    // ── Suggestions ─────────────────────────────────────────────────────────────
    // Scan studio hours (07:00–22:00 local) in 30-min steps.
    // All conflict checks are done in UTC; suggestions are returned as local HH:MM
    // strings so they go directly into the time <input> without re-conversion.
    const suggestions: string[] = [];
    if (instructorId && conflicts.length > 0) {
      const utcDateStr = startsAt.toISOString().split('T')[0]; // UTC date of the slot
      const dayStartUTC = new Date(`${utcDateStr}T00:00:00.000Z`);
      const dayEndUTC = new Date(`${utcDateStr}T23:59:59.999Z`);

      const daySessions = await db
        .select({ startsAt: classSessions.startsAt, endsAt: classSessions.endsAt })
        .from(classSessions)
        .where(
          and(
            eq(classSessions.instructorId, instructorId),
            ne(classSessions.status, 'cancelled'),
            gte(classSessions.startsAt, dayStartUTC),
            lte(classSessions.startsAt, dayEndUTC),
          ),
        );

      const dayBlocks = await getBlocksInRange(dayStartUTC, dayEndUTC);
      const busyIntervals = [
        ...daySessions,
        ...dayBlocks.filter((b) => b.instructorId === instructorId || b.instructorId === null),
      ];

      // localOffsetH: hours to ADD to UTC to get local time (positive for UTC+N zones)
      // e.g. CEST (UTC+2): tzOffsetMinutes = -120 → localOffsetH = +2
      const localOffsetH = -(tzOffsetMinutes / 60);

      // Studio window in UTC: 07:00 local → (7 - localOffsetH) UTC
      const studioOpenUTC = 7 - localOffsetH;   // e.g. 5 for CEST
      const studioCloseUTC = 22 - localOffsetH; // e.g. 20 for CEST

      const requestedUTCMinutes = startsAt.getUTCHours() * 60 + startsAt.getUTCMinutes();

      const freeBefore: string[] = [];
      const freeAfter: string[] = [];

      const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');

      for (let h = studioOpenUTC; h < studioCloseUTC; h++) {
        for (const m of [0, 30]) {
          const slotUTCMin = h * 60 + m;
          if (slotUTCMin === requestedUTCMinutes) continue; // skip the conflicting slot itself

          const candidateStart = new Date(`${utcDateStr}T${pad(h)}:${m === 0 ? '00' : '30'}:00.000Z`);
          const candidateEnd = addMinutes(candidateStart, durationMinutes);
          const busy = busyIntervals.some(
            (b) => b.startsAt < candidateEnd && b.endsAt > candidateStart,
          );
          if (busy) continue;

          // Convert UTC slot hour to local time string for display
          let localH = h + localOffsetH;
          if (localH < 0) localH += 24;
          if (localH >= 24) localH -= 24;
          const localTimeStr = `${pad(localH)}:${m === 0 ? '00' : '30'}`;

          if (slotUTCMin < requestedUTCMinutes) {
            freeBefore.push(localTimeStr);
          } else {
            freeAfter.push(localTimeStr);
          }
        }
      }

      // Return nearest slots: up to 3 after requested time, then up to 2 before (nearest first)
      suggestions.push(
        ...freeAfter.slice(0, 3),
        ...freeBefore.slice(-2).reverse(),
      );
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

// ─── Update a scheduled session ──────────────────────────────────────────────

const updateClassSessionSchema = z.object({
  id: z.string().uuid('Invalid session ID'),
  instructorId: z.string().uuid().nullable().optional(),
  maxCapacity: z.number().int().positive().optional(),
});

/**
 * Update a scheduled session (e.g., change instructor).
 * Prevents credit changes if the session has bookings (to avoid confusion).
 * Admins should cancel and recreate if they need to change credits.
 */
export async function updateClassSessionAction(
  input: z.infer<typeof updateClassSessionSchema>,
): Promise<ServiceResult<ClassSession>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) {
    return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };
  }

  const parsed = updateClassSessionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
      code: 'INVALID_STATE',
    };
  }

  const { id, instructorId, maxCapacity } = parsed.data;

  try {
    const [session] = await db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, id))
      .limit(1);

    if (!session) {
      return { success: false, error: 'Session not found.', code: 'NOT_FOUND' };
    }

    // Warn if there are bookings
    if (session.bookedCount > 0 && maxCapacity !== undefined && maxCapacity < session.bookedCount) {
      return {
        success: false,
        error: `Cannot reduce capacity below ${session.bookedCount} booked students.`,
        code: 'INVALID_STATE',
      };
    }

    const updates: Partial<ClassSession> = { updatedAt: new Date() };
    if (instructorId !== undefined) updates.instructorId = instructorId;
    if (maxCapacity !== undefined) updates.maxCapacity = maxCapacity;

    const [updated] = await db
      .update(classSessions)
      .set(updates)
      .where(eq(classSessions.id, id))
      .returning();

    revalidatePath('/admin/classes');
    revalidatePath('/book');

    // Fire-and-forget GCal sync if instructor changed
    if (instructorId !== undefined && instructorId !== session.instructorId) {
      (async () => {
        try {
          const { pushSession } = await import(
            '@/modules/calendar/services/calendar-sync.service'
          );
          await pushSession(session.id);
        } catch (err) {
          console.warn('[calendar] Session update GCal push failed:', err);
        }
      })();
    }

    return { success: true, data: updated as ClassSession };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'updateClassSessionAction failed', err }));
    return { success: false, error: 'Failed to update session.', code: 'DB_ERROR' };
  }
}

// ─── Get Booked Students for a Session ────────────────────────────────────────

export type SessionStudent = {
  userId: string;
  name: string | null;
  email: string | null;
  bookingId: string;
  bookingStatus: string;
  creditsSpent: number;
  creditType: CreditType;
  bookedAt: Date;
};

export async function getSessionStudentsAction(
  sessionId: string,
): Promise<ServiceResult<SessionStudent[]>> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin' && session.user.role !== 'instructor') {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  try {
    const data = await db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        bookingId: bookings.id,
        bookingStatus: bookings.status,
        creditsSpent: bookings.creditsSpent,
        creditType: bookings.creditType,
        bookedAt: bookings.bookedAt,
      })
      .from(bookings)
      .innerJoin(users, eq(bookings.userId, users.id))
      .where(
        and(
          eq(bookings.sessionId, sessionId),
          eq(bookings.status, 'confirmed'),
          isNull(users.deletedAt),
        ),
      )
      .orderBy(asc(bookings.bookedAt));

    return { success: true, data: data as SessionStudent[] };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'getSessionStudentsAction failed', err }));
    return { success: false, error: 'Failed to load students.', code: 'DB_ERROR' };
  }
}

// ─── Remove Student from Session (Admin) ──────────────────────────────────────

const removeStudentSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().min(3).max(500),
});

export async function removeStudentFromSessionAction(
  input: z.infer<typeof removeStudentSchema>,
): Promise<ServiceResult<{ success: boolean }>> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  const parsed = removeStudentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input', code: 'INVALID_STATE' };
  }

  const { bookingId, reason } = parsed.data;

  try {
    // Get booking details before transaction
    const [bookingData] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!bookingData) {
      return { success: false, error: 'Booking not found', code: 'NOT_FOUND' };
    }

    if (bookingData.status !== 'confirmed') {
      return { success: false, error: 'Can only remove confirmed bookings', code: 'INVALID_STATE' };
    }

    // Get user email for notification
    const [userData] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, bookingData.userId))
      .limit(1);

    // Refund transaction
    await db.transaction(async (tx) => {
      const { creditTransactions } = await import('@/db/schema');

      // Cancel the booking
      await tx
        .update(bookings)
        .set({
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationReason: `Admin removed: ${reason}`,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, bookingId));

      // Record refund transaction
      await tx.insert(creditTransactions).values({
        userId: bookingData.userId,
        type: 'refund',
        creditType: bookingData.creditType,
        amount: bookingData.creditsSpent,
        balanceAfter: 0,
        description: `Refund: removed from class by admin`,
        processedBy: session.user.id,
      });

      // Update balance
      const [balance] = await tx
        .select()
        .from(creditBalances)
        .where(
          and(
            eq(creditBalances.userId, bookingData.userId),
            eq(creditBalances.creditType, bookingData.creditType),
          ),
        )
        .for('update')
        .limit(1);

      const newBalance = (balance?.balance ?? 0) + bookingData.creditsSpent;
      if (balance) {
        await tx
          .update(creditBalances)
          .set({ balance: newBalance, updatedAt: new Date() })
          .where(eq(creditBalances.id, balance.id));
      } else {
        await tx.insert(creditBalances).values({
          userId: bookingData.userId,
          creditType: bookingData.creditType,
          balance: newBalance,
        });
      }

      // Decrement session booked count
      const [sessionData] = await tx
        .select()
        .from(classSessions)
        .where(eq(classSessions.id, bookingData.sessionId!))
        .limit(1);

      if (sessionData) {
        await tx
          .update(classSessions)
          .set({ bookedCount: Math.max(0, sessionData.bookedCount - 1), updatedAt: new Date() })
          .where(eq(classSessions.id, bookingData.sessionId!));
      }
    });

    revalidatePath('/admin/classes');
    revalidatePath('/book');

    // Fire-and-forget email notification
    (async () => {
      try {
        const { sendNotificationEmail } = await import('@/lib/email/resend');
        if (userData?.email) {
          await sendNotificationEmail(
            userData.email,
            'Removed from class',
            'You have been removed from a class',
            `Reason: ${reason}\n\nYour credits have been fully refunded to your account.`,
          );
        }
      } catch (err) {
        console.warn('[email] Student removed notification failed:', err);
      }
    })();

    return { success: true, data: { success: true } };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'removeStudentFromSessionAction failed', err }));
    return { success: false, error: 'Failed to remove student.', code: 'DB_ERROR' };
  }
}
