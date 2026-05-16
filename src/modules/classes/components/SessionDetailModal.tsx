'use client';

import { useState, useTransition, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Loader2Icon,
  Trash2Icon,
  CalendarClockIcon,
  ChevronDownIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getSessionStudentsAction,
  removeStudentFromSessionAction,
  type SessionStudent,
} from '@/modules/classes/actions/class.actions';
import { rescheduleClassSessionAction } from '@/modules/classes/actions/classSession.actions';

type Props = {
  sessionId: string;
  sessionTitle: string;
  startsAt: Date;
  endsAt: Date;
  instructorName: string;
  bookedCount: number;
  maxCapacity: number;
  status: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type DialogMode = 'remove' | null;

export function SessionDetailModal({
  sessionId,
  sessionTitle,
  startsAt,
  endsAt,
  instructorName,
  bookedCount,
  maxCapacity,
  status,
  open,
  onOpenChange,
}: Props) {
  const [students, setStudents] = useState<SessionStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Remove student dialog
  const [removeDialog, setRemoveDialog] = useState<DialogMode>(null);
  const [selectedStudent, setSelectedStudent] = useState<SessionStudent | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [removeError, setRemoveError] = useState('');

  // Reschedule form
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(format(startsAt, 'yyyy-MM-dd'));
  const [rescheduleTime, setRescheduleTime] = useState(format(startsAt, 'HH:mm'));
  const [rescheduleError, setRescheduleError] = useState('');

  // Reset reschedule form whenever the modal opens (possibly for a different session)
  useEffect(() => {
    if (open) {
      setRescheduleOpen(false);
      setRescheduleDate(format(startsAt, 'yyyy-MM-dd'));
      setRescheduleTime(format(startsAt, 'HH:mm'));
      setRescheduleError('');
    }
  }, [open, startsAt]);

  // Load students when modal opens
  useEffect(() => {
    if (!open) return;

    setLoading(true);
    (async () => {
      const result = await getSessionStudentsAction(sessionId);
      if (result.success) {
        setStudents(result.data);
      } else {
        toast.error('Failed to load students');
      }
      setLoading(false);
    })();
  }, [open, sessionId]);

  function openRemoveDialog(student: SessionStudent) {
    setSelectedStudent(student);
    setRemoveReason('');
    setRemoveError('');
    setRemoveDialog('remove');
  }

  function handleReschedule() {
    if (!rescheduleDate || !rescheduleTime) {
      setRescheduleError('Please enter a valid date and time.');
      return;
    }
    setRescheduleError('');
    const startsAtISO = new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString();

    startTransition(async () => {
      const result = await rescheduleClassSessionAction({ id: sessionId, startsAtISO });
      if (result.success) {
        const studentNote = bookedCount > 0
          ? ` ${bookedCount} student${bookedCount !== 1 ? 's' : ''} notified by email.`
          : '';
        toast.success(`Class rescheduled successfully.${studentNote}`);
        setRescheduleOpen(false);
        onOpenChange(false);
      } else {
        setRescheduleError(result.error ?? 'Failed to reschedule.');
      }
    });
  }

  function handleRemoveStudent() {
    if (!selectedStudent) return;

    setRemoveError('');
    const reason = removeReason.trim();
    if (!reason || reason.length < 3) {
      setRemoveError('Please provide a reason (at least 3 characters)');
      return;
    }

    startTransition(async () => {
      const result = await removeStudentFromSessionAction({
        bookingId: selectedStudent.bookingId,
        reason,
      });

      if (result.success) {
        toast.success(`${selectedStudent.name ?? 'Student'} has been removed and notified via email.`);
        setRemoveDialog(null);
        setStudents(students.filter((s) => s.bookingId !== selectedStudent.bookingId));
      } else {
        setRemoveError(result.error ?? 'Failed to remove student');
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl" showCloseButton>
          <DialogHeader>
            <DialogTitle>{sessionTitle}</DialogTitle>
            <DialogDescription>
              {format(startsAt, 'EEEE, d MMMM yyyy')} · {format(startsAt, 'HH:mm')} – {format(endsAt, 'HH:mm')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Session info */}
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div>
                <div className="text-slate-600 font-medium">Instructor</div>
                <div className="text-slate-900">{instructorName}</div>
              </div>
              <div>
                <div className="text-slate-600 font-medium">Capacity</div>
                <div className="text-slate-900">
                  {bookedCount} / {maxCapacity} booked
                </div>
              </div>
            </div>

            {/* Reschedule section */}
            {status !== 'cancelled' && (
              <div className="rounded-lg border border-[#ede8e5]">
                <button
                  type="button"
                  onClick={() => setRescheduleOpen((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-[#4e2b22] hover:bg-[#faf9f7] rounded-lg transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <CalendarClockIcon className="size-4" />
                    Reschedule class
                  </span>
                  <ChevronDownIcon className={['size-4 text-[#8b6b5c] transition-transform', rescheduleOpen ? 'rotate-180' : ''].join(' ')} />
                </button>

                {rescheduleOpen && (
                  <div className="border-t border-[#ede8e5] px-4 pb-4 pt-3 space-y-3">
                    {bookedCount > 0 && (
                      <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                        <strong>{bookedCount} student{bookedCount !== 1 ? 's' : ''}</strong> will receive an email with the new time and a free 24-hour cancellation window.
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="reschedule-date" className="text-xs">New date</Label>
                        <Input
                          id="reschedule-date"
                          type="date"
                          value={rescheduleDate}
                          onChange={(e) => setRescheduleDate(e.target.value)}
                          disabled={isPending}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="reschedule-time" className="text-xs">New time</Label>
                        <Input
                          id="reschedule-time"
                          type="time"
                          value={rescheduleTime}
                          onChange={(e) => setRescheduleTime(e.target.value)}
                          disabled={isPending}
                          className="text-sm"
                        />
                      </div>
                    </div>
                    {rescheduleError && (
                      <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                        {rescheduleError}
                      </div>
                    )}
                    <Button
                      type="button"
                      onClick={handleReschedule}
                      disabled={isPending}
                      className="w-full bg-[#4e2b22] hover:bg-[#6b3d32] text-white text-sm"
                    >
                      {isPending ? (
                        <span className="flex items-center gap-2">
                          <Loader2Icon className="size-4 animate-spin" />
                          Rescheduling…
                        </span>
                      ) : (
                        'Confirm reschedule & notify students'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Students list */}
            <div className="space-y-3">
              <h3 className="font-semibold text-[#4e2b22]">Booked Students ({students.length})</h3>

              {loading ? (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2Icon className="size-4 animate-spin" />
                  Loading students…
                </div>
              ) : students.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
                  No students booked for this session.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {students.map((student) => (
                    <div
                      key={student.bookingId}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 truncate">{student.name}</div>
                        <div className="text-xs text-slate-600 truncate">{student.email}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {student.creditsSpent} {student.creditType} credits · Booked {format(student.bookedAt, 'dd MMM')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openRemoveDialog(student)}
                        disabled={isPending}
                        className="ml-3 p-2 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                        title="Remove from class"
                      >
                        <Trash2Icon className="size-4 text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove student confirmation */}
      <AlertDialog open={removeDialog === 'remove'} onOpenChange={(v) => {
        if (!isPending && !v) setRemoveDialog(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {selectedStudent?.name ?? 'student'} from class?</AlertDialogTitle>
            <AlertDialogDescription>
              They will receive an email notification and {selectedStudent?.creditsSpent} {selectedStudent?.creditType} credit(s) will be refunded.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="reason" className="text-sm font-medium">
                Reason for removal *
              </Label>
              <Input
                id="reason"
                placeholder="e.g., Requested cancellation, Medical reasons, etc."
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                disabled={isPending}
                className="text-sm"
              />
              <p className="text-xs text-slate-600">This will be included in the email notification to the student.</p>
            </div>
            {removeError && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {removeError}
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveStudent}
              disabled={isPending || !removeReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2Icon className="size-4 animate-spin" />
                  Removing…
                </span>
              ) : (
                'Remove & Notify'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
