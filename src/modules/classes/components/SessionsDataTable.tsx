'use client';

import { useState, useTransition, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { MoreHorizontalIcon, Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import { buttonVariants } from '@/components/ui/button';
import {
  cancelClassSessionAction,
  deleteClassSessionAction,
  updateClassSessionAction,
  getInstructorsAction,
} from '@/modules/classes/actions/class.actions';

// ─── Row type ─────────────────────────────────────────────────────────────────

export type SessionRow = {
  id: string;
  startsAt: Date;
  templateName: string;
  instructorName: string;
  instructorId: string | null;
  bookedCount: number;
  maxCapacity: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
};

// ─── Session Edit Dialog ──────────────────────────────────────────────────────

function SessionEditDialog({
  row,
  open,
  onOpenChange,
}: {
  row: SessionRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [instructors, setInstructors] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedInstructor, setSelectedInstructor] = useState<string | null>(row.instructorId);
  const [maxCapacity, setMaxCapacity] = useState<string>(String(row.maxCapacity));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Load instructors on mount
  useEffect(() => {
    if (open) {
      startTransition(async () => {
        const result = await getInstructorsAction();
        if (result.success) {
          setInstructors(result.data);
        }
      });
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const capacity = parseInt(maxCapacity, 10);
    if (isNaN(capacity) || capacity < 1) {
      setError('Capacity must be a positive number.');
      return;
    }

    if (capacity < row.bookedCount) {
      setError(`Cannot reduce capacity below ${row.bookedCount} booked students.`);
      return;
    }

    startTransition(async () => {
      const result = await updateClassSessionAction({
        id: row.id,
        instructorId: selectedInstructor || null,
        maxCapacity: capacity,
      });

      if (result.success) {
        onOpenChange(false);
        toast.success('Session updated.');
      } else {
        setError(result.error ?? 'Failed to update session.');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Edit session</DialogTitle>
          <DialogDescription>
            Update the instructor or capacity. Credits cannot be changed once students are booked — cancel and create a new session instead.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sess-date" className="text-[#6b3d32] font-medium">Date & Time</Label>
            <div className="h-9 flex items-center rounded-md border border-input bg-[#faf9f7] px-3 text-sm text-[#6b3d32]">
              {format(row.startsAt, 'dd MMM yyyy, HH:mm')}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sess-instr" className="text-[#6b3d32] font-medium">Instructor</Label>
            <select
              id="sess-instr"
              value={selectedInstructor || ''}
              onChange={(e) => setSelectedInstructor(e.target.value || null)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">None</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sess-cap" className="text-[#6b3d32] font-medium">Max capacity</Label>
            <div className="text-xs text-[#8b6b5c] mb-1">Currently booked: {row.bookedCount} / {row.maxCapacity}</div>
            <input
              id="sess-cap"
              type="number"
              min={row.bookedCount}
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="bg-emerald-600 text-white hover:bg-emerald-700">
              {isPending
                ? <span className="flex items-center gap-2"><Loader2Icon className="size-4 animate-spin" />Saving…</span>
                : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<SessionRow['status'], string> = {
  scheduled: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<SessionRow['status'], string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function StatusBadge({ status }: { status: SessionRow['status'] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Actions cell ─────────────────────────────────────────────────────────────

type DialogMode = 'cancel' | 'delete' | 'edit' | null;

function SessionActionsCell({ row }: { row: SessionRow }) {
  const [dialog, setDialog]   = useState<DialogMode>(null);
  const [error, setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canEdit = row.status === 'scheduled';
  const canCancel = row.status === 'scheduled' || row.status === 'in_progress';
  const canDelete = row.status === 'cancelled' || (row.status === 'scheduled' && row.bookedCount === 0);

  if (!canEdit && !canCancel && !canDelete) return null;

  function openDialog(mode: DialogMode) {
    setError(null);
    setDialog(mode);
  }

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelClassSessionAction({
        sessionId: row.id,
        reason: 'Cancelled by administrator',
      });
      if (result.success) {
        setDialog(null);
      } else {
        setError(result.error ?? 'Something went wrong.');
      }
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteClassSessionAction({ id: row.id });
      if (result.success) {
        setDialog(null);
      } else {
        setError(result.error ?? 'Something went wrong.');
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={buttonVariants({ variant: 'ghost', size: 'icon' })}
          aria-label="Open session actions"
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && (
            <DropdownMenuItem onClick={() => openDialog('edit')}>
              Edit Session
            </DropdownMenuItem>
          )}
          {canCancel && (
            <DropdownMenuItem variant="destructive" onClick={() => openDialog('cancel')}>
              Cancel Session
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem variant="destructive" onClick={() => openDialog('delete')}>
              Delete Session
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Cancel confirmation */}
      <AlertDialog open={dialog === 'cancel'} onOpenChange={(v) => { if (!isPending && !v) setDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this session?</AlertDialogTitle>
            <AlertDialogDescription>
              All booked students will receive a full credit refund automatically. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Keep session</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleCancel} disabled={isPending}>
              {isPending ? 'Cancelling…' : 'Yes, cancel session'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={dialog === 'delete'} onOpenChange={(v) => { if (!isPending && !v) setDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              The session record will be permanently removed. This is only available for cancelled sessions or empty unbooked sessions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Keep session</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? 'Deleting…' : 'Delete session'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog */}
      {dialog === 'edit' && (
        <SessionEditDialog row={row} open onOpenChange={(v) => { if (!v && !isPending) setDialog(null); }} />
      )}
    </>
  );
}

// ─── Column definitions ───────────────────────────────────────────────────────

const columns: ColumnDef<SessionRow>[] = [
  {
    accessorKey: 'startsAt',
    header: 'Date & Time',
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums text-slate-900">
        {format(row.original.startsAt, 'dd MMM yyyy, HH:mm')}
      </span>
    ),
  },
  {
    accessorKey: 'templateName',
    header: 'Class',
    cell: ({ row }) => (
      <span className="font-medium text-slate-900">{row.original.templateName}</span>
    ),
  },
  {
    accessorKey: 'instructorName',
    header: 'Instructor',
    cell: ({ row }) => (
      <span className="text-slate-700">{row.original.instructorName}</span>
    ),
  },
  {
    id: 'capacity',
    header: 'Booked / Capacity',
    cell: ({ row }) => {
      const { bookedCount, maxCapacity } = row.original;
      const full = maxCapacity > 0 && bookedCount >= maxCapacity;
      return (
        <span className={`tabular-nums ${full ? 'font-semibold text-red-600' : 'text-slate-700'}`}>
          {bookedCount} / {maxCapacity}
        </span>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => <SessionActionsCell row={row.original} />,
  },
];

// ─────────────────────────────────────────────────────────────────────────────

interface SessionsDataTableProps {
  data: SessionRow[];
}

export function SessionsDataTable({ data }: SessionsDataTableProps) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-slate-200 hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-32 text-center text-sm text-slate-500"
              >
                No sessions found.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="border-slate-200">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
