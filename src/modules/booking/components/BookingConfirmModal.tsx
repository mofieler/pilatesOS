'use client';

import { useTransition } from 'react';
import { format } from 'date-fns';
import { ClockIcon, CreditCardIcon, Loader2Icon, MapPinIcon } from 'lucide-react';
import { toast } from 'sonner';
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
import { createBookingAction } from '@/modules/booking/actions/createBooking.action';
import type { ServiceErrorCode } from '@/modules/billing/services/credit.service';
import type { ClassSessionCardProps } from './ClassSessionCard';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookingConfirmModalProps {
  session: ClassSessionCardProps | null;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CREDIT_DOT: Record<ClassSessionCardProps['creditType'], string> = {
  mat_group:       'bg-[#8b6b5c]',
  reformer_group:  'bg-[#6b8e6b]',
  private_session: 'bg-[#c4a88a]',
  duo_group:       'bg-[#6366f1]',
  general_group:   'bg-[#0891b2]',
  online_class:     'bg-[#ea580c]',
  sound_healing:   'bg-[#9333ea]',
};

const CREDIT_LABEL: Record<ClassSessionCardProps['creditType'], string> = {
  mat_group:       'Mat Credit',
  reformer_group:  'Reformer Credit',
  private_session: 'Private Session',
  duo_group:       'Duo Credit',
  general_group:   'Group Credit',
  online_class:     'Online Credit',
  sound_healing:   'Sound Healing Credit',
};

function errorHint(code: ServiceErrorCode | undefined): string | undefined {
  switch (code) {
    case 'INSUFFICIENT_CREDITS': return 'Top up your credits to book more classes.';
    case 'CLASS_FULL':           return 'Try joining the waitlist instead.';
    case 'BOOKING_ALREADY_EXISTS': return 'This class is already in your upcoming bookings.';
    case 'WAIVER_REQUIRED':      return 'Please sign the liability waiver before booking. Visit /waiver to sign.';
    default:                     return undefined;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function BookingConfirmModal({ session, onClose }: BookingConfirmModalProps) {
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    if (!session) return;

    startTransition(async () => {
      const result = await createBookingAction({ sessionId: session.id });

      if (result.success) {
        onClose();
        toast.success('Booking confirmed!', {
          description: `See you at ${session.name} on ${format(session.startsAt, 'EEEE, d MMMM')}.`,
        });
      } else {
        onClose();
        toast.error(result.error, {
          description: errorHint(result.code),
        });
      }
    });
  }

  return (
    <AlertDialog
      open={session !== null}
      onOpenChange={(open: boolean) => {
        // Block closing while a booking request is in flight
        if (!open && !isPending) onClose();
      }}
    >
      <AlertDialogContent>
        {session && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{session.name}</AlertDialogTitle>
              <AlertDialogDescription>with {session.instructorName}</AlertDialogDescription>
            </AlertDialogHeader>

            {/* Session details */}
            <div className="space-y-2.5 rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <ClockIcon className="size-4 shrink-0 text-slate-400" aria-hidden />
                <span>
                  {format(session.startsAt, 'EEEE, d MMMM')} at{' '}
                  {format(session.startsAt, 'HH:mm')}
                  {' · '}
                  {session.durationMinutes} min
                </span>
              </div>

              {session.location && (
                <div className="flex items-center gap-2">
                  <MapPinIcon className="size-4 shrink-0 text-slate-400" aria-hidden />
                  <span>{session.location}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <CreditCardIcon className="size-4 shrink-0 text-slate-400" aria-hidden />
                <span className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${CREDIT_DOT[session.creditType]}`} />
                  {session.creditCost}{' '}
                  {CREDIT_LABEL[session.creditType]}{' '}
                  {session.creditCost === 1 ? 'credit' : 'credits'} will be deducted
                </span>
              </div>
            </div>

            {/* Cancellation policy */}
            <p className="text-xs text-slate-400">
              Free cancellation up to 24 hours before the class starts.
            </p>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>

              <AlertDialogAction
                disabled={isPending}
                onClick={handleConfirm}
                className="bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500 disabled:opacity-60"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2Icon className="size-4 animate-spin" aria-hidden />
                    Booking…
                  </span>
                ) : (
                  'Confirm Booking'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
