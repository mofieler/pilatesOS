'use client';

import { useState, useTransition } from 'react';
import { PlusIcon, Loader2Icon, PencilIcon, Trash2Icon } from 'lucide-react';
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
  createCreditPackageAction,
  updateCreditPackageAction,
  deleteCreditPackageAction,
} from '@/modules/billing/actions/creditPackage.actions';
import type { CreditPackage } from '@/db/schema';
import type { CreditType } from '@/lib/config/class-types';
import {
  getCreditPackCategoryConfig,
  type CreditPackCategory,
} from '@/lib/config/financial-config';
import { CREDIT_TYPES } from '@/lib/config/class-types';
import { CheckCircleIcon } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  packages: CreditPackage[];
};

type ClassType = 'mat' | 'reformer' | 'group';

// ─── Derivation helpers ──────────────────────────────────────────────────────

function deriveCreditType(category: CreditPackCategory, classType: ClassType): CreditType {
  if (category === 'session') return 'session';
  return classType as CreditType;
}

function categoryClassTypeLabel(category: CreditPackCategory, classType: ClassType | null): string {
  if (!classType) return getCreditPackCategoryConfig(category)?.label ?? category;
  if (classType === 'group') return 'Group Credits';
  const equipment = classType === 'mat' ? 'Mat' : 'Reformer';
  return category === 'session' ? `Private ${equipment}` : `${equipment} Group`;
}

// ─── Form state ──────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  description: string;
  creditsAmount: string;
  category: CreditPackCategory;
  classType: ClassType;
  priceEur: string;
  validityWeeks: string;
  sortOrder: string;
  isActive: boolean;
  stripePriceId: string;
};

const EMPTY_FORM: FormState = {
  name: '', description: '', creditsAmount: '', category: 'credit', classType: 'mat',
  priceEur: '', validityWeeks: '52', sortOrder: '0', isActive: true, stripePriceId: '',
};

function fromPackage(p: CreditPackage): FormState {
  // Derive classType for legacy packages that don't have it set
  const inferredClassType: ClassType =
    (p.classType as ClassType | null) ??
    (p.creditType === 'reformer' || p.creditType === 'session' ? 'reformer' : p.creditType === 'group' ? 'group' : 'mat');

  return {
    name:          p.name,
    description:   p.description ?? '',
    creditsAmount: String(p.creditsAmount),
    category:      (p.category as CreditPackCategory) ?? 'credit',
    classType:     inferredClassType,
    priceEur:      (p.priceCents / 100).toFixed(2),
    validityWeeks: String(p.validityWeeks ?? Math.ceil((p.validityDays ?? 365) / 7)),
    sortOrder:     String(p.sortOrder),
    isActive:      p.isActive,
    stripePriceId: p.stripePriceId ?? '',
  };
}

// ─── Credit type cards ────────────────────────────────────────────────────────

// Which class types are booked using each credit type, split by package category.
// Credit packages → group classes only; session packages → private/duo classes only.
const CREDIT_CLASS_TYPES: Record<ClassType, string[]> = {
  reformer: ['reformer_group'],
  mat:      ['mat_group'],
  group:    ['reformer_group', 'mat_group', 'chair', 'online', 'yoga', 'sound_healing'],
};

const SESSION_CLASS_TYPES: Record<ClassType, string[]> = {
  reformer: ['reformer_private', 'reformer_duo'],
  mat:      ['mat_private', 'mat_duo'],
  group:    [],
};

function CreditTypeCards({
  selected, onSelect, isSession, disabled,
}: {
  selected: ClassType;
  onSelect: (v: ClassType) => void;
  isSession: boolean;
  disabled: boolean;
}) {
  // Session packages: reformer only (no mat session packages exist).
  const visibleTypes: ClassType[] = isSession
    ? ['reformer']
    : ['reformer', 'mat', 'group'];

  const compatibleTypes = isSession ? SESSION_CLASS_TYPES : CREDIT_CLASS_TYPES;

  return (
    <div className="space-y-1.5">
      <Label className="text-[#6b3d32] font-medium">Credit type *</Label>
      <div className="grid grid-cols-2 gap-2">
        {visibleTypes.map((type) => {
          const cfg = CREDIT_TYPES[type as keyof typeof CREDIT_TYPES];
          if (!cfg) return null;
          const active = selected === type;
          const accepts = compatibleTypes[type];
          return (
            <button
              key={type}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(type)}
              className={`relative flex flex-col gap-1 rounded-xl border p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-[#4e2b22]/30 ${
                active
                  ? 'border-[#4e2b22] bg-[#4e2b22]/5 shadow-sm'
                  : 'border-[#ede8e5] bg-[#faf9f7] hover:border-[#c4a88a] hover:bg-[#ede8e5]/40'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {active && (
                <CheckCircleIcon className="absolute top-2.5 right-2.5 size-4 text-[#4e2b22]" aria-hidden />
              )}
              <span className={`text-xs font-semibold ${cfg.badgeStyle} inline-flex items-center rounded-full px-2 py-0.5 w-fit`}>
                {cfg.label}
              </span>
              <span className="text-[11px] leading-snug text-[#6b5047] mt-0.5">
                {cfg.description}
              </span>
              {accepts.length > 0 && (
                <div className="mt-1.5">
                  <p className="text-[10px] font-medium text-[#a6856f] uppercase tracking-wide mb-1">Accepted for</p>
                  <div className="flex flex-wrap gap-1">
                    {accepts.map((ct) => (
                      <span key={ct} className="text-[10px] rounded bg-white/70 border border-[#ede8e5] px-1.5 py-0.5 text-[#8b6b5c] font-mono">
                        {ct}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
      {isSession && (
        <p className="text-[11px] text-[#8b6b5c]">
          Session packages cover private &amp; duo reformer sessions only.
        </p>
      )}
    </div>
  );
}

// ─── Form dialog ─────────────────────────────────────────────────────────────

function PackageFormDialog({
  open, onOpenChange, editingPackage,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingPackage: CreditPackage | null;
}) {
  const isEdit = editingPackage !== null;
  const [form, setForm] = useState<FormState>(
    isEdit ? fromPackage(editingPackage!) : EMPTY_FORM,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpen = (v: boolean) => {
    if (!isPending) {
      if (v) setForm(isEdit ? fromPackage(editingPackage!) : EMPTY_FORM);
      setError(null);
      onOpenChange(v);
    }
  };

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setText =
    (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const isSession = form.category === 'session';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const creditsAmount = parseInt(form.creditsAmount, 10);
    const priceCents    = Math.round(parseFloat(form.priceEur) * 100);
    const validityWeeks = parseInt(form.validityWeeks, 10);
    const validityDays  = validityWeeks * 7;
    const sortOrder     = parseInt(form.sortOrder, 10);

    if (isNaN(creditsAmount) || creditsAmount < 1) { setError('Credits must be a positive whole number.'); return; }
    if (isNaN(priceCents)    || priceCents < 0)    { setError('Price must be 0 or more.'); return; }
    if (isNaN(validityWeeks) || validityWeeks < 1) { setError('Validity weeks must be positive.'); return; }

    const derivedCreditType = deriveCreditType(form.category, form.classType);

    startTransition(async () => {
      const payload = {
        name:          form.name,
        description:   form.description || null,
        creditsAmount,
        creditType:    derivedCreditType,
        category:      form.category,
        classType:     form.classType,
        priceCents,
        currency:      'eur',
        validityDays,
        validityWeeks,
        sortOrder:     isNaN(sortOrder) ? 0 : sortOrder,
        isActive:      form.isActive,
        stripePriceId: form.stripePriceId || null,
      };

      const result = isEdit
        ? await updateCreditPackageAction({ id: editingPackage!.id, ...payload })
        : await createCreditPackageAction(payload);

      if (result.success) {
        onOpenChange(false);
        toast.success(isEdit ? 'Package updated.' : 'Package created.');
      } else {
        setError(result.error ?? 'Something went wrong.');
      }
    });
  }

  const dialogTitle = isEdit
    ? `Edit ${isSession ? 'session' : 'credit'} package`
    : `New ${isSession ? 'session' : 'credit'} package`;

  const dialogDescription = isSession
    ? 'Session packages grant private 1:1 sessions. Pick the equipment students will use.'
    : 'Credit packages grant group-class credits. Pick the class type students can attend.';

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category toggle */}
          <div className="space-y-1.5">
            <Label className="text-[#6b3d32] font-medium">Package type *</Label>
            <div className="inline-flex rounded-lg border border-[#ede8e5] bg-[#faf9f7] p-1 w-full">
              {(['credit', 'session'] as CreditPackCategory[]).map((cat) => {
                const cfg = getCreditPackCategoryConfig(cat);
                const active = form.category === cat;
                return (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setField('category', cat)}
                    disabled={isPending}
                    className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-white text-[#4e2b22] shadow-sm'
                        : 'text-[#8b6b5c] hover:text-[#4e2b22]'
                    }`}
                  >
                    {cfg?.label ?? cat}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[#8b6b5c]">
              {getCreditPackCategoryConfig(form.category)?.description}
            </p>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="pkg-name" className="text-[#6b3d32] font-medium">Name *</Label>
            <Input
              id="pkg-name"
              value={form.name}
              onChange={setText('name')}
              required
              placeholder={isSession ? 'e.g. 5 Private Reformer Sessions' : 'e.g. 10 Mat Classes'}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="pkg-desc" className="text-[#6b3d32] font-medium">
              Description <span className="text-[#8b6b5c]">(optional)</span>
            </Label>
            <textarea
              id="pkg-desc"
              value={form.description}
              onChange={setText('description')}
              rows={2}
              placeholder="Shown to students on the pricing page"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {/* Credits */}
          <div className="space-y-1.5">
            <Label htmlFor="pkg-credits" className="text-[#6b3d32] font-medium">
              {isSession ? 'Sessions *' : 'Credits *'}
            </Label>
            <Input
              id="pkg-credits"
              type="number"
              min={1}
              value={form.creditsAmount}
              onChange={setText('creditsAmount')}
              required
            />
          </div>

          {/* Credit type cards */}
          <CreditTypeCards
            selected={form.classType}
            onSelect={(v) => setField('classType', v)}
            isSession={isSession}
            disabled={isPending}
          />

          {/* Price + validity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pkg-price" className="text-[#6b3d32] font-medium">Price (EUR) *</Label>
              <Input
                id="pkg-price"
                type="number"
                min={0}
                step="0.01"
                value={form.priceEur}
                onChange={setText('priceEur')}
                required
                placeholder="89.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pkg-validity-weeks" className="text-[#6b3d32] font-medium">
                Validity (weeks) *
              </Label>
              <Input
                id="pkg-validity-weeks"
                type="number"
                min={1}
                value={form.validityWeeks}
                onChange={setText('validityWeeks')}
                required
              />
              <p className="text-xs text-[#8b6b5c] mt-1">
                Credits expire after {form.validityWeeks || 0} week(s) ({(parseInt(form.validityWeeks) || 0) * 7} days)
              </p>
            </div>
          </div>

          {/* Sort + Stripe */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pkg-sort" className="text-[#6b3d32] font-medium">Sort order</Label>
              <Input
                id="pkg-sort"
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={setText('sortOrder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pkg-stripe" className="text-[#6b3d32] font-medium">
                Stripe Price ID <span className="text-[#8b6b5c]">(Phase 2)</span>
              </Label>
              <Input
                id="pkg-stripe"
                value={form.stripePriceId}
                onChange={setText('stripePriceId')}
                placeholder="price_..."
              />
            </div>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setField('isActive', e.target.checked)}
              className="size-4 rounded border-slate-300"
            />
            <span className="text-sm text-[#4e2b22]">Active (visible to students)</span>
          </label>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpen(false)} disabled={isPending}>Cancel</Button>
            <Button type="submit" disabled={isPending} className="bg-emerald-600 text-white hover:bg-emerald-700">
              {isPending
                ? <span className="flex items-center gap-2"><Loader2Icon className="size-4 animate-spin" />Saving…</span>
                : isEdit ? 'Save changes' : 'Create package'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function CreditPackagesManager({ packages }: Props) {
  const [createOpen, setCreateOpen]       = useState(false);
  const [editTarget, setEditTarget]       = useState<CreditPackage | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<CreditPackage | null>(null);
  const [deleteError, setDeleteError]     = useState<string | null>(null);
  const [toggling, startToggleTransition] = useTransition();
  const [deleting, startDelete]           = useTransition();

  function toggleActive(pkg: CreditPackage) {
    startToggleTransition(async () => {
      const result = await updateCreditPackageAction({ id: pkg.id, isActive: !pkg.isActive });
      if (result.success) {
        toast.success(result.data.isActive ? 'Package activated.' : 'Package deactivated.');
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteCreditPackageAction({ id: deleteTarget.id });
      if (result.success) {
        setDeleteTarget(null);
        toast.success('Package deleted.');
      } else {
        setDeleteError(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#8b6b5c]">{packages.length} package{packages.length !== 1 ? 's' : ''}</p>
        <Button onClick={() => setCreateOpen(true)} className="bg-emerald-600 text-white hover:bg-emerald-700">
          <PlusIcon className="size-4" />
          New Package
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              {['Package', 'Type', 'Credits', 'Price', 'Validity', 'Status', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6b3d32]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {packages.length === 0 && (
              <tr><td colSpan={7} className="py-12 text-center text-sm text-[#8b6b5c]">No packages yet. Create your first credit or session package to get started.</td></tr>
            )}
            {packages.map((pkg) => {
              const cat = (pkg.category ?? 'credit') as CreditPackCategory;
              const classType = (pkg.classType as ClassType | null) ??
                (pkg.creditType === 'reformer' || pkg.creditType === 'session' ? 'reformer' : pkg.creditType === 'group' ? 'group' : 'mat');
              const cfg = getCreditPackCategoryConfig(cat);
              return (
                <tr key={pkg.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{pkg.name}</p>
                    {pkg.description && <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">{pkg.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg?.badgeStyle ?? 'bg-slate-100 text-slate-700'}`}>
                      {categoryClassTypeLabel(cat, classType)}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{pkg.creditsAmount}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">
                    €{(pkg.priceCents / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{pkg.validityDays} days</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(pkg)}
                      disabled={toggling}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                        pkg.isActive
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {pkg.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditTarget(pkg)}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <PencilIcon className="size-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => { setDeleteError(null); setDeleteTarget(pkg); }}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2Icon className="size-3" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dialogs */}
      <PackageFormDialog open={createOpen} onOpenChange={setCreateOpen} editingPackage={null} />
      <PackageFormDialog open={editTarget !== null} onOpenChange={(v) => { if (!v) setEditTarget(null); }} editingPackage={editTarget} />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(v) => { if (!v && !deleting) { setDeleteTarget(null); setDeleteError(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the package. If students have purchased it, the delete will be blocked — deactivate it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete package'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
