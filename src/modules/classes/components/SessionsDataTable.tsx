'use client';

import { useState, useTransition } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { MoreHorizontalIcon } from 'lucide-react';
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
} from '@/modules/classes/actions/class.actions';

// ─── Row type ─────────────────────────────────────────────────────────────────

export type SessionRow = {
  id: string;
  startsAt: Date;
  templateName: string;
  instructorName: string;
  bookedCount: number;
  maxCapacity: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
};

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

type DialogMode = 'cancel' | 'delete' | null;

function SessionActionsCell({ row }: { row: SessionRow }) {
  const [dialog, setDialog]   = useState<DialogMode>(null);
  const [error, setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canCancel = row.status === 'scheduled' || row.status === 'in_progress';
  const canDelete = row.status === 'cancelled' || (row.status === 'scheduled' && row.bookedCount === 0);

  if (!canCancel && !canDelete) return null;

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
