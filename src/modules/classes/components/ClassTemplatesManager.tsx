'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { PlusIcon, Loader2Icon, PencilIcon, Trash2Icon, CheckCircleIcon, AlertTriangleIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createClassTemplateAction,
  updateClassTemplateAction,
  deleteClassTemplateAction,
} from '@/modules/classes/actions/class.actions';
import type { AdminTemplateRow, InstructorOption } from '@/modules/classes/actions/class.actions';
import {
  getClassTypeSelectOptions,
  getClassTypeBadgeStyle,
  getCreditTypeBadgeStyle,
  getClassTypeLabel,
  getCreditTypeLabel,
  getCreditTypeForClassType,
  CREDIT_TYPES,
  type ClassType,
  type CreditType,
} from '@/lib/config/class-types';
import { getCreditPackagesAction } from '@/modules/billing/actions/creditPackage.actions';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIVATE_CLASS_TYPES = new Set<ClassType>([
  'reformer_private', 'reformer_duo', 'mat_private', 'mat_duo',
]);

const GROUP_ELIGIBLE = new Set<ClassType>(['reformer_group', 'mat_group', 'chair', 'online', 'yoga', 'sound_healing']);

function compatibleCreditTypes(classType: ClassType): CreditType[] {
  if (PRIVATE_CLASS_TYPES.has(classType)) return [];
  const primary = getCreditTypeForClassType(classType);
  // group-eligible classes accept both their primary type AND group credits as fallback
  return GROUP_ELIGIBLE.has(classType) ? [primary, 'group'] : [primary];
}

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

// ─── Slim package type (only what we need) ────────────────────────────────────

type PackageOption = {
  id: string;
  name: string;
  creditsAmount: number;
  creditType: string;
  priceCents: number;
  currency: string;
};

// ─── Package selector sub-component ──────────────────────────────────────────

function PackageSelectorField({
  classType,
  selectedCreditType,
  packages,
  loaded,
  onChange,
}: {
  classType: ClassType;
  selectedCreditType: string;
  packages: PackageOption[];
  loaded: boolean;
  onChange: (creditType: CreditType) => void;
}) {
  const isPrivate = PRIVATE_CLASS_TYPES.has(classType);

  if (isPrivate) {
    return (
      <div className="flex h-9 w-full items-center rounded-md border border-input bg-[#faf9f7] px-3 py-1 text-sm text-[#6b3d32]">
        N/A — Session Package
        <span className="ml-2 text-xs text-[#a6856f]">(no credit cost)</span>
      </div>
    );
  }

  if (!loaded) {
    return <div className="h-16 animate-pulse rounded-xl bg-slate-100" />;
  }

  const compatibleTypes = compatibleCreditTypes(classType);
  const compatiblePackages = packages.filter((p) =>
    compatibleTypes.includes(p.creditType as CreditType),
  );

  if (compatiblePackages.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-500" />
        <div>
          <p className="text-sm font-medium text-amber-800">No credit packages configured</p>
          <p className="mt-0.5 text-xs text-amber-700">
            Create packages first, then link them to templates.{' '}
            <Link href="/admin/credits" className="font-semibold underline underline-offset-2">
              Go to Credit Packages →
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // Group compatible packages by credit type
  const byType = compatibleTypes.reduce<Record<string, PackageOption[]>>((acc, ct) => {
    acc[ct] = compatiblePackages.filter((p) => p.creditType === ct);
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      {compatibleTypes.map((ct) => {
        const cfg = CREDIT_TYPES[ct];
        const pkgs = byType[ct] ?? [];
        const isSelected = selectedCreditType === ct;

        return (
          <button
            key={ct}
            type="button"
            onClick={() => onChange(ct)}
            className={[
              'w-full text-left rounded-xl border p-3 transition-all duration-150',
              isSelected
                ? 'border-[#4e2b22] bg-[#4e2b22]/5 shadow-sm ring-1 ring-[#4e2b22]/10'
                : 'border-[#ede8e5] bg-[#faf9f7] hover:border-[#c4a88a]/60 hover:bg-white/70',
            ].join(' ')}
          >
            {/* Header row */}
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isSelected && <CheckCircleIcon className="size-4 text-[#4e2b22]" />}
                <span className={`text-sm font-semibold ${isSelected ? 'text-[#4e2b22]' : 'text-[#6b3d32]'}`}>
                  {cfg.label}
                </span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.badgeStyle}`}>
                {pkgs.length} package{pkgs.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Package pills */}
            {pkgs.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {pkgs.map((pkg) => (
                  <span
                    key={pkg.id}
                    className="inline-flex items-center gap-1 rounded-md border border-[#ede8e5] bg-white/80 px-2 py-0.5 text-[11px] text-[#6b3d32]"
                  >
                    {pkg.name}
                    <span className="text-[#c4a88a]">·</span>
                    {pkg.creditsAmount} cr
                    <span className="text-[#c4a88a]">·</span>
                    {formatPrice(pkg.priceCents, pkg.currency)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#a6856f]">No packages of this type yet</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Form types ───────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  description: string;
  classType: ClassType;
  durationMinutes: string;
  maxCapacity: string;
  creditCost: string;
  creditType: string;
  instructorId: string;
  location: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  name: '', description: '', classType: 'reformer_group', durationMinutes: '60',
  maxCapacity: '8', creditCost: '3', creditType: 'reformer',
  instructorId: '', location: '', isActive: true,
};

function fromTemplate(t: AdminTemplateRow): FormState {
  return {
    name:            t.name,
    description:     t.description ?? '',
    classType:       t.classType,
    durationMinutes: String(t.durationMinutes),
    maxCapacity:     String(t.maxCapacity),
    creditCost:      String(t.creditCost),
    creditType:      t.creditType,
    instructorId:    t.instructorId ?? '',
    location:        t.location ?? '',
    isActive:        t.isActive,
  };
}

// ─── Template form dialog ─────────────────────────────────────────────────────

function TemplateFormDialog({
  open, onOpenChange, editingTemplate, instructors,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingTemplate: AdminTemplateRow | null;
  instructors: InstructorOption[];
}) {
  const isEdit = editingTemplate !== null;
  const [form, setForm] = useState<FormState>(
    isEdit ? fromTemplate(editingTemplate!) : EMPTY_FORM,
  );
  const [error, setError]   = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Fetch credit packages for the selector
  const [packages, setPackages]     = useState<PackageOption[]>([]);
  const [packagesLoaded, setPackagesLoaded] = useState(false);

  useEffect(() => {
    getCreditPackagesAction().then((res) => {
      setPackages(res.success ? res.data.filter((p) => p.isActive) : []);
      setPackagesLoaded(true);
    });
  }, []);

  const handleOpen = (v: boolean) => {
    if (!isPending) {
      if (v) setForm(isEdit ? fromTemplate(editingTemplate!) : EMPTY_FORM);
      setError(null);
      onOpenChange(v);
    }
  };

  const set = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const isPrivate       = PRIVATE_CLASS_TYPES.has(form.classType);
    const durationMinutes = parseInt(form.durationMinutes, 10);
    const maxCapacity     = parseInt(form.maxCapacity, 10);
    const creditCost      = isPrivate ? 0 : parseInt(form.creditCost, 10);

    if (isNaN(durationMinutes) || durationMinutes < 1) { setError('Duration must be positive.'); return; }
    if (isNaN(maxCapacity) || maxCapacity < 1) { setError('Capacity must be positive.'); return; }
    if (!isPrivate && (isNaN(creditCost) || creditCost < 1)) { setError('Credit cost must be positive.'); return; }

    const payload = {
      name:            form.name,
      description:     form.description || undefined,
      classType:       form.classType as AdminTemplateRow['classType'],
      durationMinutes,
      maxCapacity,
      creditCost,
      creditType:      form.creditType as AdminTemplateRow['creditType'],
      instructorId:    form.instructorId || undefined,
      location:        form.location || undefined,
      isActive:        form.isActive,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateClassTemplateAction({ id: editingTemplate!.id, ...payload })
        : await createClassTemplateAction(payload);

      if (result.success) {
        onOpenChange(false);
        toast.success(isEdit ? 'Template updated.' : 'Template created.');
      } else {
        setError(result.error ?? 'Something went wrong.');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit class template' : 'New class template'}</DialogTitle>
          <DialogDescription>
            Templates define what a class is. When you schedule a session, it is based on a template.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name" className="text-[#6b3d32] font-medium">Name *</Label>
            <Input id="tpl-name" value={form.name} onChange={set('name')} required placeholder="e.g. Reformer Flow" />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-desc" className="text-[#6b3d32] font-medium">
              Description <span className="text-[#8b6b5c]">(optional)</span>
            </Label>
            <textarea
              id="tpl-desc"
              value={form.description}
              onChange={set('description')}
              rows={2}
              placeholder="Shown in the booking calendar"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {/* Class type + duration */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-type" className="text-[#6b3d32] font-medium">Class type *</Label>
              <select
                id="tpl-type"
                value={form.classType}
                onChange={(e) => {
                  const classType = e.target.value as ClassType;
                  const isPrivate = PRIVATE_CLASS_TYPES.has(classType);
                  const newCreditType = getCreditTypeForClassType(classType);
                  setForm((f) => ({
                    ...f,
                    classType,
                    creditType: newCreditType,
                    maxCapacity: isPrivate ? (classType.endsWith('_duo') ? '2' : '1') : f.maxCapacity,
                    creditCost: isPrivate ? '0' : f.creditCost,
                  }));
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus:ring-1 focus:ring-ring"
              >
                {getClassTypeSelectOptions().map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-dur" className="text-[#6b3d32] font-medium">Duration (min) *</Label>
              <Input id="tpl-dur" type="number" min={1} value={form.durationMinutes} onChange={set('durationMinutes')} required />
            </div>
          </div>

          {/* Credit package selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[#6b3d32] font-medium">
                {PRIVATE_CLASS_TYPES.has(form.classType) ? 'Billing' : 'Credit Package Type'}
              </Label>
              {!PRIVATE_CLASS_TYPES.has(form.classType) && (
                <span className="text-[10px] text-[#a6856f]">
                  Students need a matching package to book
                </span>
              )}
            </div>
            <PackageSelectorField
              classType={form.classType}
              selectedCreditType={form.creditType}
              packages={packages}
              loaded={packagesLoaded}
              onChange={(ct) => setForm((f) => ({ ...f, creditType: ct }))}
            />
          </div>

          {/* Capacity + credit cost */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-cap" className="text-[#6b3d32] font-medium">Max capacity *</Label>
              <Input id="tpl-cap" type="number" min={1} value={form.maxCapacity} onChange={set('maxCapacity')} required />
            </div>
            {PRIVATE_CLASS_TYPES.has(form.classType) ? (
              <div className="space-y-1.5">
                <Label className="text-[#6b3d32] font-medium">Billing</Label>
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-[#faf9f7] px-3 py-1 text-sm text-[#6b3d32]">
                  Session package
                  <span className="ml-2 text-xs text-[#a6856f]">(no credit cost)</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="tpl-cost" className="text-[#6b3d32] font-medium">Credits per class *</Label>
                <Input id="tpl-cost" type="number" min={1} value={form.creditCost} onChange={set('creditCost')} required />
              </div>
            )}
          </div>

          {/* Instructor + location */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-instr" className="text-[#6b3d32] font-medium">
                Default instructor <span className="text-[#8b6b5c]">(optional)</span>
              </Label>
              <select
                id="tpl-instr"
                value={form.instructorId}
                onChange={set('instructorId')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">None</option>
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-loc" className="text-[#6b3d32] font-medium">
                Location <span className="text-[#8b6b5c]">(optional)</span>
              </Label>
              <Input id="tpl-loc" value={form.location} onChange={set('location')} placeholder="Studio 1" />
            </div>
          </div>

          {/* Active */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="size-4 rounded border-slate-300"
            />
            <span className="text-sm text-[#4e2b22]">Active (available for scheduling)</span>
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="bg-emerald-600 text-white hover:bg-emerald-700">
              {isPending
                ? <span className="flex items-center gap-2"><Loader2Icon className="size-4 animate-spin" />Saving…</span>
                : isEdit ? 'Save changes' : 'Create template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function ClassTemplatesManager({
  templates, instructors,
}: {
  templates: AdminTemplateRow[];
  instructors: InstructorOption[];
}) {
  const [createOpen, setCreateOpen]     = useState(false);
  const [editTarget, setEditTarget]     = useState<AdminTemplateRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminTemplateRow | null>(null);
  const [deleteError, setDeleteError]   = useState<string | null>(null);
  const [toggling, startToggle]         = useTransition();
  const [deleting, startDelete]         = useTransition();

  function toggleActive(t: AdminTemplateRow) {
    startToggle(async () => {
      const result = await updateClassTemplateAction({ id: t.id, isActive: !t.isActive });
      if (result.success) {
        toast.success(t.isActive ? 'Template deactivated.' : 'Template activated.');
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteClassTemplateAction({ id: deleteTarget.id });
      if (result.success) {
        setDeleteTarget(null);
        toast.success('Template deleted.');
      } else {
        setDeleteError(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#8b6b5c]">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
        <Button onClick={() => setCreateOpen(true)} className="bg-emerald-600 text-white hover:bg-emerald-700">
          <PlusIcon className="size-4" />
          New Template
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              {['Template', 'Type', 'Duration', 'Capacity', 'Credits', 'Instructor', 'Status', ''].map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6b3d32]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {templates.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-sm text-[#8b6b5c]">
                  No templates yet.
                </td>
              </tr>
            )}
            {templates.map((t) => (
              <tr key={t.id} className={`hover:bg-slate-50 ${!t.isActive ? 'opacity-60' : ''}`}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{t.name}</p>
                  {t.location && <p className="mt-0.5 text-xs text-slate-400">{t.location}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getClassTypeBadgeStyle(t.classType)}`}>
                    {getClassTypeLabel(t.classType)}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-600">{t.durationMinutes}m</td>
                <td className="px-4 py-3 tabular-nums text-slate-600">{t.maxCapacity}</td>
                <td className="px-4 py-3">
                  {PRIVATE_CLASS_TYPES.has(t.classType) ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                      Session pkg
                    </span>
                  ) : (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getCreditTypeBadgeStyle(t.creditType)}`}>
                      {t.creditCost} {getCreditTypeLabel(t.creditType)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{t.instructorName ?? '—'}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(t)}
                    disabled={toggling}
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      t.isActive
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {t.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditTarget(t)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <PencilIcon className="size-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => { setDeleteError(null); setDeleteTarget(t); }}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2Icon className="size-3" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TemplateFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        editingTemplate={null}
        instructors={instructors}
      />
      <TemplateFormDialog
        open={editTarget !== null}
        onOpenChange={(v) => { if (!v) setEditTarget(null); }}
        editingTemplate={editTarget}
        instructors={instructors}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => { if (!v && !deleting) { setDeleteTarget(null); setDeleteError(null); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the template. If sessions already use this template, the delete will be blocked — deactivate it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete template'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
