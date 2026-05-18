'use client';

import { useState, useTransition } from 'react';
import { formatStudio, formatStudioTime } from '@/lib/utils/date.utils';
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
import { createDuoInviteAction } from '@/modules/booking/actions/createDuoInvite.action';
import { CANCELLATION_WINDOW_HOURS } from '@/constants/BOOKING_RULES';
import { DuoInviteShareSheet } from './DuoInviteShareSheet';
import type { ServiceErrorCode } from '@/modules/billing/services/credit.service';
import type { ClassSessionCardProps } from './ClassSessionCard';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookingConfirmModalProps {
  session: ClassSessionCardProps | null;
  onClose: () => void;
}

type Step = 'confirm' | 'duo-share';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CREDIT_DOT: Record<ClassSessionCardProps['creditType'], string> = {
  pass:    'bg-[#c4a88a]',
  session:  'bg-[#4e2b22]',
};

const CREDIT_LABEL: Record<ClassSessionCardProps['creditType'], string> = {
  pass:    'Credit',
  session: 'Session Credit',
};

function errorHint(code: ServiceErrorCode | undefined): string | undefined {
  switch (code) {
    case 'INSUFFICIENT_CREDITS':    return 'Top up your credits to book more classes.';
    case 'CLASS_FULL':              return 'Try joining the waitlist instead.';
    case 'BOOKING_ALREADY_EXISTS': return 'This class is already in your upcoming bookings.';
    default:                        return undefined;
  }
}

function isDuoClass(classType: ClassSessionCardProps['classType']): boolean {
  return classType === 'reformer_duo' || classType === 'mat_duo';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BookingConfirmModal({ session, onClose }: BookingConfirmModalProps) {
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>('confirm');
  const [duoInvite, setDuoInvite] = useState<{ token: string; expiresAt: Date } | null>(null);
  const [newBookingId, setNewBookingId] = useState<string | null>(null);

  function handleClose() {
    setStep('confirm');
    setDuoInvite(null);
    setNewBookingId(null);
    onClose();
  }

  function handleConfirm() {
    if (!session) return;

    startTransition(async () => {
      const result = await createBookingAction({ sessionId: session.id });

      if (!result.success) {
        handleClose();
        toast.error(result.error, { description: errorHint(result.code) });
        return;
      }

      const bookingId = result.data?.id;

      // For duo classes, generate an invite link before closing
      if (isDuoClass(session.classType) && bookingId) {
        setNewBookingId(bookingId);
        const invite = await createDuoInviteAction({ bookingId });
        if (invite.success && invite.data) {
          setDuoInvite(invite.data);
          setStep('duo-share');
          return;
        }
      }

      handleClose();
      toast.success('Booking confirmed!', {
        description: `See you at ${session.name} on ${formatStudio(session.startsAt, 'EEEE, d MMMM')}.`,
      });
    });
  }

  // Show share sheet for duo classes
  if (step === 'duo-share' && duoInvite && session) {
    return (
      <AlertDialog open onOpenChange={(open) => { if (!open) handleClose(); }}>
        <AlertDialogContent className="p-0 overflow-hidden">
          <DuoInviteShareSheet
            sessionName={session.name}
            startsAt={session.startsAt}
            inviteToken={duoInvite.token}
            expiresAt={duoInvite.expiresAt}
            onDone={() => {
              handleClose();
              toast.success('Booking confirmed!', {
                description: `See you at ${session.name} on ${formatStudio(session.startsAt, 'EEEE, d MMMM')}.`,
              });
            }}
          />
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog
      open={session !== null}
      onOpenChange={(open: boolean) => {
        if (!open && !isPending) handleClose();
      }}
    >
      <AlertDialogContent>
        {session && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{session.name}</AlertDialogTitle>
              <AlertDialogDescription>with {session.instructorName}</AlertDialogDescription>
            </AlertDialogHeader>

            {isDuoClass(session.classType) && (
              <p className="text-xs text-[#8b6b5c] flex items-center gap-1.5 -mt-1">
                <span className="text-[#c4a88a]">●</span>
                After booking you'll get a link to invite your duo partner
              </p>
            )}

            {/* Session details */}
            <div className="space-y-2.5 rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <ClockIcon className="size-4 shrink-0 text-slate-400" aria-hidden />
                <span>
                  {formatStudio(session.startsAt, 'EEEE, d MMMM')} at{' '}
                  {formatStudioTime(session.startsAt)}
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

            <p className="text-xs text-slate-400">
              Free cancellation up to {CANCELLATION_WINDOW_HOURS} hours before the class starts.
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
                    Booking...
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
