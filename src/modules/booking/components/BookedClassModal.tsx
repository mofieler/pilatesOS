'use client';

import { format } from 'date-fns';
import { ClockIcon, MapPinIcon, CheckCircleIcon, UserIcon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { ClassSessionCardProps } from './ClassSessionCard';
import { CancelBookingButton } from '@/modules/users/components/CancelBookingButton';

export interface BookedClassModalProps {
  session: ClassSessionCardProps | null;
  onClose: () => void;
}

export function BookedClassModal({ session, onClose }: BookedClassModalProps) {
  if (!session || !session.bookingId) return null;

  return (
    <AlertDialog open={!!session} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="border-emerald-500 overflow-hidden">
        <AlertDialogHeader>
          <div className="flex items-start justify-between mb-2">
            <AlertDialogTitle className="text-xl">{session.name}</AlertDialogTitle>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
              <CheckCircleIcon className="size-4" />
              Booked
            </span>
          </div>
          <AlertDialogDescription>
            You're successfully booked for this class. 
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Session details */}
        <div className="space-y-3 rounded-xl bg-slate-50 px-4 py-3.5 text-sm my-4 text-slate-700 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <ClockIcon className="size-4 shrink-0 text-slate-400" aria-hidden />
            <span className="font-medium">
              {format(session.startsAt, 'EEEE, d MMMM')} at{' '}
              {format(session.startsAt, 'HH:mm')}
              {' · '}
              {session.durationMinutes} min
            </span>
          </div>

          <div className="flex items-center gap-3">
            <UserIcon className="size-4 shrink-0 text-slate-400" aria-hidden />
            <span>with <span className="font-medium">{session.instructorName}</span></span>
          </div>

          {session.location && (
            <div className="flex items-center gap-3">
              <MapPinIcon className="size-4 shrink-0 text-slate-400" aria-hidden />
              <span>{session.location}</span>
            </div>
          )}
        </div>

        <AlertDialogFooter className="sm:flex-row-reverse sm:justify-start gap-3 mt-6 sm:space-x-0">
          <AlertDialogCancel onClick={onClose} className="mt-0 w-full sm:w-auto">
            Close
          </AlertDialogCancel>
          {/* Note: CancelBookingButton renders an AlertDialogTrigger with its own AlertDialog internally */}
          <div className="flex w-full sm:w-auto items-center">
            <CancelBookingButton
              bookingId={session.bookingId}
              className={session.name}
              startsAt={session.startsAt}
              creditsSpent={session.creditsSpent ?? session.creditCost}
              creditType={session.creditType as 'reformer' | 'mat' | 'group' | 'session' | 'sound_healing'}
              mercyAvailable={session.mercyAvailable ?? false}
            />
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
