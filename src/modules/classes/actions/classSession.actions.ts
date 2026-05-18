'use server';

import { z } from 'zod';
import { addMinutes } from 'date-fns';
import { db } from '@/db';
import { classTemplates, classSessions, instructors, users, bookings } from '@/db/schema';
import type { ClassSession, ClassTemplate, Instructor, User } from '@/db/schema';
import { asc, eq, and, isNull, inArray, gte, gt, lte, lt, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import { cancellationService } from '@/modules/booking/services/cancellation.service';
import { sendClassRescheduledEmail } from '@/lib/email/resend';
import type { ServiceResult } from '@/modules/billing/services/credit.service';
import type { InstructorCancellationResult } from '@/modules/booking/services/cancellation.service';
import type { ClassType, CreditType } from '@/lib/config/class-types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InstructorOption = { id: string; name: string };

export type AdminSession = ClassSession & {
  template: ClassTemplate | null;
  instructor: (Instructor & { user: User }) | null;
};

export type PaginatedSessions = {
  data: AdminSession[];
  nextCursor: Date | null;
};

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

export type ConflictItem = {
  type: 'session' | 'gcal_block';
  summary: string;
  startsAt: Date;
  endsAt: Date;
};

export type AvailabilityResult = {
  conflicts: ConflictItem[];
  suggestions: string[];
};

// ─── Auth Guard ───────────────────────────────────────────────────────────────

type AuthCtx = {
  userId: string;
  role: 'admin' | 'instructor';
  instructorId: string | null; // instructors.id for instructor role, null for admin
};

async function requireAdminOrInstructor(): Promise<AuthCtx | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const role = session.user.role as string;
  if (role !== 'admin' && role !== 'instructor') return null;

  let instructorId: string | null = null;
  if (role === 'instructor') {
    const [row] = await db
      .select({ id: instructors.id })
      .from(instructors)
      .where(eq(instructors.userId, session.user.id))
      .limit(1);
    instructorId = row?.id ?? null;
    if (!instructorId) return null; // user has instructor role but no instructor record
  }

  return { userId: session.user.id, role: role as 'admin' | 'instructor', instructorId };
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const getAdminSessionsSchema = z.object({
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
  limit:  z.number().int().positive().max(100).optional(),
  cursor: z.coerce.date().optional(),
});

const cancelClassSessionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  reason:    z.string().min(1, 'Cancellation reason is required').max(500),
});

const createClassSessionSchema = z.object({
  templateId:   z.string().uuid('Invalid template ID'),
  startsAtISO:  z.string().datetime(),
  instructorId: z.string().uuid().optional().nullable(),
});

const updateClassSessionSchema = z.object({
  id:           z.string().uuid('Invalid session ID'),
  instructorId: z.string().uuid().nullable().optional(),
  maxCapacity:  z.number().int().positive().optional(),
});

const rescheduleClassSessionSchema = z.object({
  id:              z.string().uuid('Invalid session ID'),
  startsAtISO:     z.string().datetime(),
  durationMinutes: z.number().int().positive().optional(),
});

const checkSlotSchema = z.object({
  instructorId:     z.string().uuid().optional(),
  startsAtISO:      z.string().datetime(),
  durationMinutes:  z.number().int().positive(),
  tzOffsetMinutes:  z.number().int(),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getAdminSessionsAction(
  input: z.infer<typeof getAdminSessionsSchema> = {},
): Promise<ServiceResult<PaginatedSessions>> {
  const ctx = await requireAdminOrInstructor();
  if (!ctx) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = getAdminSessionsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.', code: 'INVALID_STATE' };

  const { status, limit, cursor } = parsed.data;
  const safeLimit = Math.min(limit ?? 50, 100);

  try {
    const rows = await db.query.classSessions.findMany({
      with: { template: true, instructor: { with: { user: true } } },
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
    const nextCursor = hasNextPage && data.length > 0 ? data[data.length - 1].startsAt : null;

    return { success: true, data: { data: data as AdminSession[], nextCursor } };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'getAdminSessionsAction failed', err }));
    return { success: false, error: 'Failed to fetch sessions.', code: 'DB_ERROR' };
  }
}

export async function cancelClassSessionAction(
  input: z.infer<typeof cancelClassSessionSchema>,
): Promise<ServiceResult<InstructorCancellationResult>> {
  const ctx = await requireAdminOrInstructor();
  if (!ctx) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = cancelClassSessionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.', code: 'INVALID_STATE' };

  if (ctx.role === 'instructor') {
    const [session] = await db.select({ instructorId: classSessions.instructorId }).from(classSessions).where(eq(classSessions.id, parsed.data.sessionId)).limit(1);
    if (!session) return { success: false, error: 'Session not found.', code: 'NOT_FOUND' };
    if (session.instructorId !== ctx.instructorId) {
      return { success: false, error: 'You can only cancel your own sessions.', code: 'UNAUTHORIZED' };
    }
  }

  return cancellationService.cancelSessionByInstructor(parsed.data.sessionId, ctx.userId, parsed.data.reason);
}

export async function createClassSessionAction(
  input: z.infer<typeof createClassSessionSchema>,
): Promise<ServiceResult<ClassSession>> {
  const ctx = await requireAdminOrInstructor();
  if (!ctx) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = createClassSessionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.', code: 'INVALID_STATE' };

  const { templateId, startsAtISO } = parsed.data;
  // Instructors can only create sessions for themselves — ignore any passed instructorId
  const instructorId = ctx.role === 'instructor' ? ctx.instructorId : parsed.data.instructorId;

  const [template] = await db.select().from(classTemplates).where(eq(classTemplates.id, templateId)).limit(1);
  if (!template) return { success: false, error: 'Class template not found.', code: 'NOT_FOUND' };

  const startsAt = new Date(startsAtISO);
  if (isNaN(startsAt.getTime())) return { success: false, error: 'Invalid date or time.', code: 'INVALID_STATE' };

  const endsAt = addMinutes(startsAt, template.durationMinutes);
  const resolvedInstructorId = instructorId ?? template.instructorId ?? null;

  try {
    const [session] = await db
      .insert(classSessions)
      .values({ templateId, instructorId: resolvedInstructorId, startsAt, endsAt, maxCapacity: template.maxCapacity, bookedCount: 0, waitlistCount: 0, status: 'scheduled' })
      .returning();

    revalidatePath('/admin/classes');
    revalidatePath('/book');

    try {
      const { pushSession } = await import('@/modules/calendar/services/calendar-sync.service');
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

export async function deleteClassSessionAction(input: { id: string }): Promise<ServiceResult<null>> {
  const ctx = await requireAdminOrInstructor();
  if (!ctx) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };
  // Instructors cannot delete sessions — cancellation is the correct flow for them
  if (ctx.role === 'instructor') return { success: false, error: 'Only admins can delete sessions.', code: 'UNAUTHORIZED' };

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid ID.', code: 'INVALID_STATE' };

  const [session] = await db.select().from(classSessions).where(eq(classSessions.id, parsed.data.id)).limit(1);
  if (!session) return { success: false, error: 'Session not found.', code: 'NOT_FOUND' };

  if (session.status !== 'cancelled' && session.bookedCount > 0) {
    const cancelResult = await cancellationService.cancelSessionByInstructor(session.id, ctx.userId, 'Session deleted by administrator');
    if (!cancelResult.success) return { success: false, error: cancelResult.error ?? 'Failed to cancel session before deleting.', code: 'DB_ERROR' };
  }

  const { googleCalendarEventId, googleCalendarId, instructorId } = session;

  try {
    await db.transaction(async (tx) => {
      await tx.delete(bookings).where(and(eq(bookings.sessionId, parsed.data.id), eq(bookings.status, 'cancelled')));
      await tx.delete(classSessions).where(eq(classSessions.id, parsed.data.id));
    });
    revalidatePath('/admin/classes');

    if (googleCalendarEventId && googleCalendarId && instructorId) {
      (async () => {
        try {
          const { deleteEventDirect } = await import('@/modules/calendar/services/calendar-sync.service');
          await deleteEventDirect({ instructorDbId: instructorId, googleCalendarId, googleEventId: googleCalendarEventId });
        } catch (err) {
          console.warn('[calendar] Session delete GCal cleanup failed:', err);
        }
      })();
    }

    return { success: true, data: null };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'deleteClassSessionAction failed', err }));
    return { success: false, error: 'Failed to delete session.', code: 'DB_ERROR' };
  }
}

export async function updateClassSessionAction(
  input: z.infer<typeof updateClassSessionSchema>,
): Promise<ServiceResult<ClassSession>> {
  const ctx = await requireAdminOrInstructor();
  if (!ctx) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = updateClassSessionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.', code: 'INVALID_STATE' };

  const { id, maxCapacity } = parsed.data;
  // Instructors cannot reassign sessions to another instructor
  const instructorId = ctx.role === 'instructor' ? undefined : parsed.data.instructorId;

  try {
    const [session] = await db.select().from(classSessions).where(eq(classSessions.id, id)).limit(1);
    if (!session) return { success: false, error: 'Session not found.', code: 'NOT_FOUND' };

    if (ctx.role === 'instructor' && session.instructorId !== ctx.instructorId) {
      return { success: false, error: 'You can only edit your own sessions.', code: 'UNAUTHORIZED' };
    }

    if (session.bookedCount > 0 && maxCapacity !== undefined && maxCapacity < session.bookedCount) {
      return { success: false, error: `Cannot reduce capacity below ${session.bookedCount} booked students.`, code: 'INVALID_STATE' };
    }

    const updates: Partial<ClassSession> = { updatedAt: new Date() };
    if (instructorId !== undefined) updates.instructorId = instructorId;
    if (maxCapacity !== undefined) updates.maxCapacity = maxCapacity;

    const [updated] = await db.update(classSessions).set(updates).where(eq(classSessions.id, id)).returning();

    revalidatePath('/admin/classes');
    revalidatePath('/book');

    if (instructorId !== undefined && instructorId !== session.instructorId) {
      (async () => {
        try {
          const { pushSession } = await import('@/modules/calendar/services/calendar-sync.service');
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

export async function rescheduleClassSessionAction(
  input: z.infer<typeof rescheduleClassSessionSchema>,
): Promise<ServiceResult<ClassSession>> {
  const ctx = await requireAdminOrInstructor();
  if (!ctx) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = rescheduleClassSessionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.', code: 'INVALID_STATE' };

  const { id, startsAtISO, durationMinutes } = parsed.data;

  try {
    const [session] = await db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, id))
      .limit(1);

    if (!session) return { success: false, error: 'Session not found.', code: 'NOT_FOUND' };

    if (ctx.role === 'instructor' && session.instructorId !== ctx.instructorId) {
      return { success: false, error: 'You can only reschedule your own sessions.', code: 'UNAUTHORIZED' };
    }
    if (session.status === 'cancelled') {
      return { success: false, error: 'Cannot reschedule a cancelled class.', code: 'INVALID_STATE' };
    }

    const newStartsAt = new Date(startsAtISO);
    if (isNaN(newStartsAt.getTime())) {
      return { success: false, error: 'Invalid date or time.', code: 'INVALID_STATE' };
    }
    if (newStartsAt <= new Date()) {
      return { success: false, error: 'New start time must be in the future.', code: 'INVALID_STATE' };
    }

    // Resolve duration: explicit override → template duration → fallback to existing gap
    let resolvedDuration = durationMinutes;
    if (!resolvedDuration && session.templateId) {
      const [tmpl] = await db
        .select({ durationMinutes: classTemplates.durationMinutes })
        .from(classTemplates)
        .where(eq(classTemplates.id, session.templateId))
        .limit(1);
      resolvedDuration = tmpl?.durationMinutes;
    }
    if (!resolvedDuration) {
      resolvedDuration = Math.round((session.endsAt.getTime() - session.startsAt.getTime()) / 60000);
    }

    const newEndsAt = addMinutes(newStartsAt, resolvedDuration);
    const now = new Date();

    // Capture old times before updating — used in student notification emails
    const oldStartsAt = session.startsAt;

    const [updated] = await db
      .update(classSessions)
      .set({ startsAt: newStartsAt, endsAt: newEndsAt, rescheduledAt: now, updatedAt: now })
      .where(eq(classSessions.id, id))
      .returning();

    revalidatePath('/admin/classes');
    revalidatePath('/book');

    // Fire-and-forget: notify all confirmed students
    Promise.resolve().then(async () => {
      try {
        const confirmedBookings = await db
          .select({ userId: bookings.userId })
          .from(bookings)
          .where(and(eq(bookings.sessionId, id), eq(bookings.status, 'confirmed')));

        if (confirmedBookings.length === 0) return;

        const [tmpl] = await db
          .select({ name: classTemplates.name })
          .from(classTemplates)
          .where(eq(classTemplates.id, session.templateId!))
          .limit(1);

        const studentIds = confirmedBookings.map((b) => b.userId);
        const students = await db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(and(inArray(users.id, studentIds), isNull(users.deletedAt)));

        const fmt = (d: Date) => ({
          date: d.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Berlin' }),
          time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }),
        });
        const oldFmt = fmt(oldStartsAt);
        const newFmt = fmt(newStartsAt);

        await Promise.allSettled(
          students
            .filter((s) => s.email)
            .map((s) =>
              sendClassRescheduledEmail(
                s.email!,
                s.name ?? 'there',
                tmpl?.name ?? 'your class',
                oldFmt.date, oldFmt.time,
                newFmt.date, newFmt.time,
              ),
            ),
        );
      } catch (err) {
        console.warn('[email] Reschedule notification emails failed:', err);
      }
    }).catch(() => {});

    // Fire-and-forget GCal sync with updated times
    (async () => {
      try {
        const { pushSession } = await import('@/modules/calendar/services/calendar-sync.service');
        await pushSession(id);
      } catch (err) {
        console.warn('[calendar] Reschedule GCal push failed:', err);
      }
    })();

    return { success: true, data: updated as ClassSession };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'rescheduleClassSessionAction failed', err }));
    return { success: false, error: 'Failed to reschedule session.', code: 'DB_ERROR' };
  }
}

export async function getSessionsForRangeAction(from: Date, to: Date): Promise<ServiceResult<WeekViewSessionData[]>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  try {
    const rows = await db.query.classSessions.findMany({
      with: { template: true, instructor: { with: { user: true } } },
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
        startsAt: r.startsAt, endsAt: r.endsAt,
        bookedCount: r.bookedCount, maxCapacity: r.maxCapacity,
        status: r.status,
      })),
    };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'getSessionsForRangeAction failed', err }));
    return { success: false, error: 'Failed to fetch sessions.', code: 'DB_ERROR' };
  }
}

export async function getInstructorsAction(): Promise<ServiceResult<InstructorOption[]>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

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

export async function checkSlotAvailabilityAction(
  input: z.infer<typeof checkSlotSchema>,
): Promise<ServiceResult<AvailabilityResult>> {
  const authSession = await requireAdminOrInstructor();
  if (!authSession) return { success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' };

  const parsed = checkSlotSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input.', code: 'INVALID_STATE' };

  const { instructorId, startsAtISO, durationMinutes, tzOffsetMinutes } = parsed.data;
  const startsAt = new Date(startsAtISO);
  const endsAt   = addMinutes(startsAt, durationMinutes);

  try {
    const { getBlocksInRange } = await import('@/modules/calendar/services/calendar-sync.service');
    const conflicts: ConflictItem[] = [];

    if (instructorId) {
      const overlappingSessions = await db
        .select({ startsAt: classSessions.startsAt, endsAt: classSessions.endsAt })
        .from(classSessions)
        .where(and(
          eq(classSessions.instructorId, instructorId),
          ne(classSessions.status, 'cancelled'),
          lt(classSessions.startsAt, endsAt),
          gt(classSessions.endsAt, startsAt),
        ));

      for (const s of overlappingSessions) {
        conflicts.push({ type: 'session', summary: 'Pilateq class', startsAt: s.startsAt, endsAt: s.endsAt });
      }

      const blocks = await getBlocksInRange(startsAt, endsAt);
      for (const b of blocks) {
        if (b.instructorId === instructorId || b.instructorId === null) {
          conflicts.push({ type: 'gcal_block', summary: b.summary ?? 'Blocked (Google Calendar)', startsAt: b.startsAt, endsAt: b.endsAt });
        }
      }
    }

    const suggestions: string[] = [];
    if (instructorId && conflicts.length > 0) {
      const utcDateStr  = startsAt.toISOString().split('T')[0];
      const dayStartUTC = new Date(`${utcDateStr}T00:00:00.000Z`);
      const dayEndUTC   = new Date(`${utcDateStr}T23:59:59.999Z`);

      const daySessions = await db
        .select({ startsAt: classSessions.startsAt, endsAt: classSessions.endsAt })
        .from(classSessions)
        .where(and(
          eq(classSessions.instructorId, instructorId),
          ne(classSessions.status, 'cancelled'),
          gte(classSessions.startsAt, dayStartUTC),
          lte(classSessions.startsAt, dayEndUTC),
        ));

      const dayBlocks = await getBlocksInRange(dayStartUTC, dayEndUTC);
      const busyIntervals = [
        ...daySessions,
        ...dayBlocks.filter((b) => b.instructorId === instructorId || b.instructorId === null),
      ];

      const localOffsetH = -(tzOffsetMinutes / 60);
      const studioOpenUTC  = 7  - localOffsetH;
      const studioCloseUTC = 22 - localOffsetH;
      const requestedUTCMinutes = startsAt.getUTCHours() * 60 + startsAt.getUTCMinutes();

      const freeBefore: string[] = [];
      const freeAfter:  string[] = [];
      const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');

      for (let h = studioOpenUTC; h < studioCloseUTC; h++) {
        for (const m of [0, 30]) {
          const slotUTCMin = h * 60 + m;
          if (slotUTCMin === requestedUTCMinutes) continue;

          const candidateStart = new Date(`${utcDateStr}T${pad(h)}:${m === 0 ? '00' : '30'}:00.000Z`);
          const candidateEnd   = addMinutes(candidateStart, durationMinutes);
          const busy = busyIntervals.some((b) => b.startsAt < candidateEnd && b.endsAt > candidateStart);
          if (busy) continue;

          let localH = h + localOffsetH;
          if (localH < 0) localH += 24;
          if (localH >= 24) localH -= 24;
          const localTimeStr = `${pad(localH)}:${m === 0 ? '00' : '30'}`;

          if (slotUTCMin < requestedUTCMinutes) freeBefore.push(localTimeStr);
          else freeAfter.push(localTimeStr);
        }
      }

      suggestions.push(...freeAfter.slice(0, 3), ...freeBefore.slice(-2).reverse());
    }

    return { success: true, data: { conflicts, suggestions } };
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'checkSlotAvailabilityAction failed', err }));
    return { success: false, error: 'Failed to check availability.', code: 'DB_ERROR' };
  }
}
