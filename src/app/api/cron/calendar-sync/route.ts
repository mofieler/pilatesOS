import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/db';
import { calendarConnections, classSessions, instructors } from '@/db/schema';
import { and, eq, gte, isNotNull, isNull, or, ne } from 'drizzle-orm';
import {
  listActiveConnections,
  pullBlocks,
  pushSession,
} from '@/modules/calendar/services/calendar-sync.service';

// POST /api/cron/calendar-sync
// Triggered by an external scheduler (Coolify cron, Vercel cron, etc.) every
// 5 minutes. Auth via shared secret in `Authorization: Bearer <CRON_SECRET>`.
//
// Performs:
//  1. Pull external GCal events for all active connections → external_calendar_blocks.
//  2. Retry-sweep: re-push class_sessions whose previous push errored and that
//     start in the future or within the last hour.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface SyncReport {
  connections: number;
  pulledAdded: number;
  pulledUpdated: number;
  pulledRemoved: number;
  pulledErrors: number;
  retriedPushes: number;
  retriedSuccesses: number;
}

async function runPullSweep() {
  const conns = await listActiveConnections();
  const report = {
    connections: conns.length,
    pulledAdded: 0,
    pulledUpdated: 0,
    pulledRemoved: 0,
    pulledErrors: 0,
  };

  for (const conn of conns) {
    if (!conn.selectedCalendarId) continue;
    try {
      const r = await pullBlocks(conn);
      report.pulledAdded += r.added;
      report.pulledUpdated += r.updated;
      report.pulledRemoved += r.removed;
      await db
        .update(calendarConnections)
        .set({
          lastSyncAt: new Date(),
          lastPullSyncToken: r.nextSyncToken,
          lastSyncError: null,
        })
        .where(eq(calendarConnections.id, conn.id));
    } catch (err) {
      report.pulledErrors += 1;
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(calendarConnections)
        .set({ lastSyncError: message.slice(0, 500) })
        .where(eq(calendarConnections.id, conn.id));
      console.error(`[CRON] pullBlocks failed for connection ${conn.id}:`, message);
    }
  }
  return report;
}

async function runPushRetrySweep() {
  // Find sessions that need a push:
  //   • Never synced (googleCalendarEventId IS NULL), OR
  //   • Previously errored (googleCalendarSyncError IS NOT NULL)
  // Both cases: upcoming/recent, not cancelled, and instructor has an active
  // calendar connection with a selected calendar — JOIN ensures we don't
  // endlessly retry sessions with no matching connection.
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const toRetry = await db
    .selectDistinct({ id: classSessions.id })
    .from(classSessions)
    .innerJoin(instructors, eq(classSessions.instructorId, instructors.id))
    .innerJoin(
      calendarConnections,
      and(
        eq(calendarConnections.userId, instructors.userId),
        eq(calendarConnections.syncEnabled, true),
        isNotNull(calendarConnections.selectedCalendarId),
      ),
    )
    .where(
      and(
        ne(classSessions.status, 'cancelled'),
        gte(classSessions.startsAt, cutoff),
        or(
          isNull(classSessions.googleCalendarEventId),
          isNotNull(classSessions.googleCalendarSyncError),
        ),
      ),
    )
    .limit(50);

  let succeeded = 0;
  for (const row of toRetry) {
    await pushSession(row.id);
    const [after] = await db
      .select({
        eventId: classSessions.googleCalendarEventId,
        err: classSessions.googleCalendarSyncError,
      })
      .from(classSessions)
      .where(eq(classSessions.id, row.id))
      .limit(1);
    if (after?.eventId && !after?.err) succeeded += 1;
  }
  return { retriedPushes: toRetry.length, retriedSuccesses: succeeded };
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const pullPart = await runPullSweep();
    const pushPart = await runPushRetrySweep();
    const report: SyncReport = { ...pullPart, ...pushPart };
    console.info(
      `[CRON] calendar-sync done in ${Date.now() - startedAt}ms`,
      JSON.stringify(report),
    );
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    console.error('[CRON] calendar-sync fatal:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

// Also accept GET for manual browser-based testing (still auth-protected).
export const GET = POST;
