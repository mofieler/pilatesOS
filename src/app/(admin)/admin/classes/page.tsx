import {
  getAdminSessionsAction,
  getClassTemplatesAdminAction,
  getInstructorsAction,
  type AdminTemplateRow,
} from '@/modules/classes/actions/class.actions';
import {
  SessionsDataTable,
  type SessionRow,
} from '@/modules/classes/components/SessionsDataTable';
import { CreateSessionDialog } from '@/modules/classes/components/CreateSessionDialog';
import { ClassTemplatesManager } from '@/modules/classes/components/ClassTemplatesManager';
import type { AdminSession } from '@/modules/classes/actions/class.actions';
import { Package2Icon, CalendarIcon } from 'lucide-react';

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
    getClassTemplatesAdminAction(),
    getInstructorsAction(),
  ]);

  const rows: SessionRow[] =
    sessionsResult.success ? sessionsResult.data.data.map(toSessionRow) : [];

  const templates = templatesResult.success ? templatesResult.data : [];
  const instructors = instructorsResult.success ? instructorsResult.data : [];
  const hasTemplates = templates.length > 0;
  const hasSessions = rows.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Classes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage class templates and schedule sessions
            {sessionsResult.success && ` · ${sessionsResult.data.data.length} sessions`}
          </p>
        </div>

        {hasTemplates && (
          <CreateSessionDialog templates={templates} instructors={instructors} />
        )}
      </div>

      {/* Templates Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#4e2b22]">Class Templates</h2>
          {hasTemplates && (
            <p className="text-sm text-[#8b6b5c]">
              {templates.length} template{templates.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {!hasTemplates && (
          <div className="rounded-xl border border-[#ede8e5]/50 bg-gradient-to-br from-[#faf9f7] to-[#f5f3f1] p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#c4a88a]/20 mb-4">
              <Package2Icon className="w-8 h-8 text-[#c4a88a]" />
            </div>
            <h2 className="text-xl font-semibold text-[#4e2b22] mb-3">No Class Templates Yet</h2>
            <p className="text-[#6b3d32] mb-6 max-w-md mx-auto">
              Class templates define the structure of your classes. Create templates first before scheduling sessions.
            </p>
            
            {/* Setup Guide */}
            <div className="bg-white/80 rounded-lg p-6 text-left max-w-2xl mx-auto">
              <h3 className="text-lg font-semibold text-[#4e2b22] mb-4">Getting Started Guide</h3>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#4a7c4a]/20 flex items-center justify-center text-sm font-semibold text-[#4a7c4a]">1</div>
                  <div>
                    <h4 className="font-medium text-[#4e2b22]">Create Class Templates</h4>
                    <p className="text-sm text-[#8b6b5c] mt-1">Define your class types, duration, capacity, and credit costs. Templates are reusable blueprints for scheduling classes.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#c4a88a]/20 flex items-center justify-center text-sm font-semibold text-[#c4a88a]">2</div>
                  <div>
                    <h4 className="font-medium text-[#4e2b22]">Schedule Classes</h4>
                    <p className="text-sm text-[#8b6b5c] mt-1">Once templates are created, you can schedule individual class sessions based on them.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#4e2b22]/20 flex items-center justify-center text-sm font-semibold text-[#4e2b22]">3</div>
                  <div>
                    <h4 className="font-medium text-[#4e2b22]">Best Practices</h4>
                    <div className="text-sm text-[#8b6b5c] mt-1 space-y-2">
                      <p>• Create templates for each class type (Mat, Reformer, Private, etc.)</p>
                      <p>• Set appropriate credit costs based on class value</p>
                      <p>• Define clear capacity limits for safety and quality</p>
                      <p>• Assign default instructors for consistency</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {hasTemplates && (
          <ClassTemplatesManager templates={templates} instructors={instructors} />
        )}
      </div>

      {/* Sessions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-[#4e2b22]">Scheduled Classes</h2>
            {hasSessions && (
              <span className="text-sm text-[#8b6b5c]">
                {rows.length} session{rows.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {hasTemplates && (
            <CreateSessionDialog templates={templates} instructors={instructors} />
          )}
        </div>

        {!hasTemplates && (
          <div className="rounded-lg border border-[#c4a88a]/20 bg-[#c4a88a]/5 px-4 py-3 text-sm text-[#4a7c4a]">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              <span>Create class templates first to schedule sessions</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {!sessionsResult.success && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to load sessions: {sessionsResult.error}
          </div>
        )}

        {/* Data table */}
        {hasTemplates && (
          <SessionsDataTable data={rows} />
        )}
      </div>
    </div>
  );
}
