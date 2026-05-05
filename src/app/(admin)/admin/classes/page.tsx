import {
  getAdminSessionsAction,
  getClassTemplatesAction,
  getInstructorsAction,
} from '@/modules/classes/actions/class.actions';
import {
  SessionsDataTable,
  type SessionRow,
} from '@/modules/classes/components/SessionsDataTable';
import { CreateSessionDialog } from '@/modules/classes/components/CreateSessionDialog';
import type { AdminSession } from '@/modules/classes/actions/class.actions';

// ─── Data mapping ─────────────────────────────────────────────────────────────

function toSessionRow(session: AdminSession): SessionRow {
  return {
    id: session.id,
    startsAt: session.startsAt,
    templateName: session.template?.name ?? '—',
    instructorName: session.instructor?.user?.name ?? '—',
    bookedCount: session.bookedCount,
    maxCapacity: session.maxCapacity,
    status: session.status,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function ClassesPage() {
  const [sessionsResult, templatesResult, instructorsResult] = await Promise.all([
    getAdminSessionsAction(),
    getClassTemplatesAction(),
    getInstructorsAction(),
  ]);

  const rows: SessionRow[] =
    sessionsResult.success ? sessionsResult.data.data.map(toSessionRow) : [];

  const templates = templatesResult.success ? templatesResult.data : [];
  const instructors = instructorsResult.success ? instructorsResult.data : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Classes</h1>
          <p className="mt-1 text-sm text-slate-500">
            All scheduled and past sessions
            {sessionsResult.success && ` · ${sessionsResult.data.data.length} shown`}
          </p>
        </div>

        <CreateSessionDialog templates={templates} instructors={instructors} />
      </div>

      {/* Error state */}
      {!sessionsResult.success && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load sessions: {sessionsResult.error}
        </div>
      )}

      {/* Data table */}
      <SessionsDataTable data={rows} />
    </div>
  );
}
