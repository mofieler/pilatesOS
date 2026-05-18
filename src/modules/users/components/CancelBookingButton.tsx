'use client';

import { useState, useTransition } from 'react';
import { formatStudio, formatStudioTime } from '@/lib/utils/date.utils';
import { ClockIcon, Loader2Icon, XIcon } from 'lucide-react';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cancelBookingAction } from '@/modules/booking/actions/cancelBooking.action';
import {
  CancellationPolicyBanner,
  resolveCancellationPolicy,
} from '@/modules/booking/components/CancellationPolicyBanner';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type CancelBookingButtonProps = {
  bookingId: string;
  className: string;
  startsAt: Date;
  creditsSpent: number;
  creditType: 'pass' | 'session';
  /** Remaining late-cancellation mercy uses for this calendar month (0..3). */
  mercyUsesLeft: number;
  rescheduledAt?: Date | null;
  bookedAt?: Date | null;
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function CancelBookingButton({
  bookingId,
  className,
  startsAt,
  creditsSpent,
  creditType,
  mercyUsesLeft,
  rescheduledAt,
  bookedAt,
}: CancelBookingButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const policy = resolveCancellationPolicy(startsAt, mercyUsesLeft, new Date(), rescheduledAt, bookedAt);
  const isLossState = policy.state === 'loss';

  function handleConfirm() {
    startTransition(async () => {
      try {
        // Call server action directly - userId comes from auth() inside the action
        const result = await cancelBookingAction({
          bookingId,
          reason: 'Cancelled by user via dashboard',
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to cancel booking');
        }

        setOpen(false);
        toast.success('Booking cancelled', {
          description: result.data?.creditsRefunded && result.data.creditsRefunded > 0
            ? `${result.data.creditsRefunded} ${creditType} ${result.data.creditsRefunded === 1 ? 'credit' : 'credits'} refunded.`
            : result.data?.message,
        });
      } catch (error) {
        setOpen(false);
        toast.error(error instanceof Error ? error.message : 'Could not cancel booking.');
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next: boolean) => {
        // Block closing during pending request
        if (!next && isPending) return;
        setOpen(next);
      }}
    >
      <AlertDialogTrigger
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        aria-label="Cancel booking"
      >
        <XIcon className="size-3.5" aria-hidden />
        Cancel
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
          <AlertDialogDescription>
            Review the cancellation policy before confirming.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Booking summary */}
        <div className="space-y-2 rounded-lg bg-slate-50 px-3 py-3 text-sm">
          <p className="font-semibold text-slate-900">{className}</p>
          <div className="flex items-center gap-2 text-slate-600">
            <ClockIcon className="size-4 shrink-0 text-slate-400" aria-hidden />
            <span>
              {formatStudio(startsAt, 'EEEE, d MMMM')} at {formatStudioTime(startsAt)}
            </span>
          </div>
        </div>

        {/* Policy banner */}
        <CancellationPolicyBanner
          startsAt={startsAt}
          mercyUsesLeft={mercyUsesLeft}
          creditsAtStake={creditsSpent}
          creditType={creditType}
          rescheduledAt={rescheduledAt}
          bookedAt={bookedAt}
        />

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep booking</AlertDialogCancel>

          <AlertDialogAction
            disabled={isPending}
            onClick={handleConfirm}
            className={
              isLossState
                ? 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 disabled:opacity-60'
                : 'bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-500 disabled:opacity-60'
            }
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
                Cancelling...
              </span>
            ) : isLossState ? (
              'Cancel & forfeit credits'
            ) : (
              'Yes, cancel booking'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
