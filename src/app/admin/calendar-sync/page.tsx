import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { calendarConnections, instructors, users } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { listAccessibleCalendars } from '@/modules/calendar/services/google-calendar.client';
import {
  CalendarConnectionPanel,
  type ConnectionState,
  type AccessibleCalendar,
} from '@/modules/calendar/components/CalendarConnectionPanel';
import { ConnectCalendarButton } from '@/modules/calendar/components/ConnectCalendarButton';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ connected?: string; error?: string }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Zugriff wurde abgelehnt.',
  missing_params: 'Google hat keinen Code zurückgegeben.',
  invalid_state: 'Sicherheitsfehler — bitte erneut versuchen.',
  token_exchange: 'Token-Austausch fehlgeschlagen. Bitte erneut versuchen.',
};

async function loadConnectionsForUser(opts: {
  currentUserId: string;
  isAdmin: boolean;
}): Promise<ConnectionState[]> {
  // Admins see ALL connections; instructors see only their own.
  const rows = await db
    .select({
      connection: calendarConnections,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(calendarConnections)
    .innerJoin(users, and(eq(calendarConnections.userId, users.id), isNull(users.deletedAt)))
    .where(opts.isAdmin ? undefined : eq(calendarConnections.userId, opts.currentUserId));

  const results: ConnectionState[] = [];
  for (const row of rows) {
    let calendars: AccessibleCalendar[] = [];
    let loadError: string | null = null;
    try {
      calendars = await listAccessibleCalendars(row.connection);
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err);
    }
    results.push({
      id: row.connection.id,
      ownerName: row.ownerName,
      ownerEmail: row.ownerEmail,
      googleAccountEmail: row.connection.googleAccountEmail,
      selectedCalendarId: row.connection.selectedCalendarId,
      selectedCalendarName: row.connection.selectedCalendarName,
      syncEnabled: row.connection.syncEnabled,
      lastSyncAt: row.connection.lastSyncAt,
      lastSyncError: row.connection.lastSyncError,
      calendars,
      loadError,
      isCurrentUser: row.connection.userId === opts.currentUserId,
    });
  }
  return results;
}

async function loadUnconnectedInstructors() {
  // Instructors that have a user record but no calendar_connection.
  // Only useful for the admin view.
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
    })
    .from(instructors)
    .innerJoin(users, and(eq(instructors.userId, users.id), isNull(users.deletedAt)))
    .leftJoin(calendarConnections, eq(calendarConnections.userId, users.id))
    .where(and(eq(instructors.isActive, true), isNull(calendarConnections.id)));
  return rows;
}

export default async function CalendarSyncPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const role = session.user.role as string | undefined;
  if (role !== 'admin' && role !== 'instructor') redirect('/');

  const { connected, error } = await searchParams;
  const isAdmin = role === 'admin';

  const connections = await loadConnectionsForUser({
    currentUserId: session.user.id,
    isAdmin,
  });
  const unconnectedInstructors = isAdmin ? await loadUnconnectedInstructors() : [];

  // Does the current user already have a connection?
  const currentUserHasConnection = connections.some((c) => c.isCurrentUser);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#4e2b22]">Google Calendar Sync</h1>
        <p className="mt-1 text-sm text-[#6b3d32]">
          Verbinde deinen Google Kalender, damit Pilateq-Klassen automatisch eingetragen und
          private Termine als belegte Slots in der Buchungs-UI erscheinen.
        </p>
      </div>

      {connected === '1' && (
        <div className="flex items-start gap-2 rounded-xl bg-success/10 border border-success/30 p-4 text-sm text-success">
          <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Erfolgreich verbunden!</p>
            <p className="text-success/80">
              Wähle unten den Kalender aus, mit dem synchronisiert werden soll.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-error/10 border border-error/30 p-4 text-sm text-error">
          <AlertCircle className="size-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Fehler bei der Verbindung</p>
            <p className="text-error/80">{ERROR_MESSAGES[error] ?? error}</p>
          </div>
        </div>
      )}

      {/* Current user's connection (or connect button) */}
      {!currentUserHasConnection && (
        <div className="rounded-2xl border border-dashed border-[#c4a88a]/60 bg-[#faf9f7]/50 p-6 text-center">
          <p className="text-sm text-[#6b3d32] mb-3">
            Du hast deinen Google Kalender noch nicht verbunden.
          </p>
          <ConnectCalendarButton />
          <p className="mt-3 text-xs text-[#8b6b5c]">
            Erforderlich:&nbsp;
            <code className="rounded bg-[#ede8e5] px-1.5 py-0.5">
              https://www.googleapis.com/auth/calendar
            </code>
          </p>
        </div>
      )}

      {/* All visible connections */}
      {connections.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {connections.map((c) => (
            <CalendarConnectionPanel key={c.id} connection={c} />
          ))}
        </div>
      )}

      {/* Admin view: unconnected instructors */}
      {isAdmin && unconnectedInstructors.length > 0 && (
        <div className="rounded-2xl border border-[#ede8e5] bg-[#faf9f7] p-5">
          <h2 className="text-base font-semibold text-[#4e2b22] mb-1">
            Nicht verbundene Instructors
          </h2>
          <p className="text-xs text-[#8b6b5c] mb-3">
            Diese Instructors haben noch keinen Google Kalender verbunden. Sie müssen sich selbst
            einloggen und den Connect-Button drücken.
          </p>
          <ul className="space-y-1.5">
            {unconnectedInstructors.map((i) => (
              <li
                key={i.userId}
                className="flex items-center justify-between text-sm rounded-lg bg-white border border-[#ede8e5] px-3 py-2"
              >
                <span className="text-[#4e2b22] font-medium">{i.name}</span>
                <span className="text-xs text-[#8b6b5c]">{i.email}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl bg-[#ede8e5]/40 p-5 text-xs text-[#6b3d32] space-y-1.5">
        <p className="font-semibold text-[#4e2b22]">Wie funktioniert die Sync?</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>Pilateq → Google:</strong> Klassen, die dir zugewiesen sind, erscheinen sofort
            in deinem ausgewählten Kalender mit aktueller Teilnehmerliste.
          </li>
          <li>
            <strong>Google → Pilateq:</strong> Termine, die du selbst im Kalender einträgst,
            blockieren den entsprechenden Slot in der Buchungs-UI (alle 5 Min synchronisiert).
          </li>
          <li>
            <strong>Hinweis:</strong> Pilateq-eigene Events werden im Kalender mit{' '}
            <code className="rounded bg-white px-1">[Pilateq]</code> markiert und sollten dort
            nicht editiert werden — die nächste Sync überschreibt Änderungen.
          </li>
        </ul>
      </div>
    </div>
  );
}
