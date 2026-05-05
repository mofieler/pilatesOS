'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { PlusIcon, Loader2Icon, ClockIcon, UsersIcon, CreditCardIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClassSessionAction } from '@/modules/classes/actions/class.actions';
import type { TemplateOption, InstructorOption } from '@/modules/classes/actions/class.actions';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  templates: TemplateOption[];
  instructors: InstructorOption[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CLASS_TYPE_LABEL: Record<string, string> = {
  private: 'Private',
  duo: 'Duo',
  group: 'Group',
  reformer: 'Reformer',
  mat: 'Mat',
  online: 'Online',
};

function todayString() {
  return format(new Date(), 'yyyy-MM-dd');
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CreateSessionDialog({ templates, instructors }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [templateId, setTemplateId] = useState('');
  const [date, setDate] = useState(todayString());
  const [time, setTime] = useState('09:00');
  const [instructorId, setInstructorId] = useState('');

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;

  function resetForm() {
    setTemplateId('');
    setDate(todayString());
    setTime('09:00');
    setInstructorId('');
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    if (!next) resetForm();
    setOpen(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!templateId) {
      setError('Please select a class template.');
      return;
    }
    if (!date) {
      setError('Please pick a date.');
      return;
    }
    if (!time) {
      setError('Please pick a time.');
      return;
    }

    startTransition(async () => {
      const result = await createClassSessionAction({
        templateId,
        date,
        time,
        instructorId: instructorId || null,
      });

      if (result.success) {
        setOpen(false);
        resetForm();
        toast.success('Session scheduled!', {
          description: `${selectedTemplate?.name ?? 'Class'} on ${format(new Date(`${date}T${time}:00`), 'EEEE, d MMMM')} at ${time}.`,
        });
      } else {
        setError(result.error ?? 'Something went wrong.');
      }
    });
  }

  return (
    <>
      {/* Trigger */}
      <Button
        onClick={() => setOpen(true)}
        className="bg-emerald-600 text-white hover:bg-emerald-700"
      >
        <PlusIcon className="size-4" aria-hidden />
        New Class
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Schedule a new class</DialogTitle>
            <DialogDescription>
              Choose a template and pick a date & time. The instructor and capacity are taken from
              the template by default.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Template */}
            <div className="space-y-1.5">
              <Label htmlFor="template" className="text-[#6b3d32] font-medium">Class template *</Label>
              <select
                id="template"
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value);
                  // Reset instructor override when template changes
                  setInstructorId('');
                }}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {CLASS_TYPE_LABEL[t.classType] ?? t.classType} · {t.durationMinutes}min
                  </option>
                ))}
              </select>
            </div>

            {/* Template preview */}
            {selectedTemplate && (
              <div className="rounded-xl border border-[#ede8e5] bg-[#faf9f7]/60 px-3.5 py-3 text-xs text-[#8b6b5c] space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <ClockIcon className="size-3.5 text-[#a6856f]" aria-hidden />
                  <span>{selectedTemplate.durationMinutes} min</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <UsersIcon className="size-3.5 text-[#a6856f]" aria-hidden />
                  <span>Max {selectedTemplate.maxCapacity} students</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CreditCardIcon className="size-3.5 text-[#a6856f]" aria-hidden />
                  <span>{selectedTemplate.creditCost} {selectedTemplate.creditType} credits</span>
                </div>
                {selectedTemplate.instructorName && (
                  <p className="text-[#6b3d32]">
                    Default instructor: <span className="font-medium text-[#4e2b22]">{selectedTemplate.instructorName}</span>
                  </p>
                )}
                {selectedTemplate.location && (
                  <p className="text-[#6b3d32]">Location: {selectedTemplate.location}</p>
                )}
              </div>
            )}

            {/* Date + Time row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="date" className="text-[#6b3d32] font-medium">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  min={todayString()}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="time" className="text-[#6b3d32] font-medium">Time *</Label>
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Optional instructor override */}
            {instructors.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="instructor" className="text-[#6b3d32] font-medium">
                  Instructor override{' '}
                  <span className="text-[#8b6b5c]">(optional)</span>
                </Label>
                <select
                  id="instructor"
                  value={instructorId}
                  onChange={(e) => setInstructorId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    {selectedTemplate?.instructorName
                      ? `Use template default (${selectedTemplate.instructorName})`
                      : 'Use template default'}
                  </option>
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !templateId}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2Icon className="size-4 animate-spin" aria-hidden />
                    Scheduling…
                  </span>
                ) : (
                  'Schedule class'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
