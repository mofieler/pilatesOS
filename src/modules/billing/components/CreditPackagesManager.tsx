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
import { getClassTemplatesAdminAction } from '@/modules/classes/actions/class.actions';
import type { CreditPackage } from '@/db/schema';
import {
  getCreditTypeLabel,
  getCreditTypeBadgeStyle,
  getCreditTypeSelectOptions,
  type CreditType,
} from '@/lib/config/class-types';
import {
  getCreditPackCategoryLabel,
  getCreditPackCategorySelectOptions,
  type CreditPackCategory,
} from '@/lib/config/financial-config';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { 
  packages: CreditPackage[];
  availableCreditTypes: CreditType[];
};

// ─── Package form dialog ──────────────────────────────────────────────────────

type FormState = {
  name: string;
  description: string;
  creditsAmount: string;
  creditType: CreditType;
  category: CreditPackCategory;
  priceEur: string;
  validityWeeks: string;
  sortOrder: string;
  isActive: boolean;
  stripePriceId: string;
};

const EMPTY_FORM: FormState = {
  name: '', description: '', creditsAmount: '', creditType: 'mat_group', category: 'standard',
  priceEur: '', validityWeeks: '52', sortOrder: '0', isActive: true, stripePriceId: '',
};

function fromPackage(p: CreditPackage): FormState {
  return {
    name:          p.name,
    description:   p.description ?? '',
    creditsAmount: String(p.creditsAmount),
    creditType:    p.creditType,
    category:      p.category || 'standard',
    priceEur:      (p.priceCents / 100).toFixed(2),
    validityWeeks: String((p as any).validityWeeks || Math.ceil((p as any).validityDays / 7) || 52),
    sortOrder:     String(p.sortOrder),
    isActive:      p.isActive,
    stripePriceId: p.stripePriceId ?? '',
  };
}

function PackageFormDialog({
  open, onOpenChange, editingPackage, availableCreditTypes,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingPackage: CreditPackage | null;
  availableCreditTypes: CreditType[];
}) {
  const isEdit = editingPackage !== null;
  const [form, setForm] = useState<FormState>(
    isEdit ? fromPackage(editingPackage!) : EMPTY_FORM,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset form when dialog target changes
  const handleOpen = (v: boolean) => {
    if (!isPending) {
      if (v) setForm(isEdit ? fromPackage(editingPackage!) : EMPTY_FORM);
      setError(null);
      onOpenChange(v);
    }
  };

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const creditsAmount = parseInt(form.creditsAmount, 10);
    const priceCents    = Math.round(parseFloat(form.priceEur) * 100);
    const validityWeeks = parseInt(form.validityWeeks, 10);
    const validityDays  = validityWeeks * 7; // Calculate days from weeks
    const sortOrder     = parseInt(form.sortOrder, 10);

    if (isNaN(creditsAmount) || creditsAmount < 1) { setError('Credits must be a positive whole number.'); return; }
    if (isNaN(priceCents)    || priceCents < 0)    { setError('Price must be 0 or more.'); return; }
    if (isNaN(validityWeeks) || validityWeeks < 1)  { setError('Validity weeks must be positive.'); return; }

    startTransition(async () => {
      const payload = {
        name:          form.name,
        description:   form.description || null,
        creditsAmount,
        creditType:    form.creditType,
        category:      form.category,
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

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit credit package' : 'New credit package'}</DialogTitle>
          <DialogDescription>
            Credit packages are what students purchase. Each package grants a set number of credits of a specific tier.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="pkg-name" className="text-[#6b3d32] font-medium">Name *</Label>
            <Input id="pkg-name" value={form.name} onChange={set('name')} required placeholder="e.g. 10 Standard Classes" />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="pkg-desc" className="text-[#6b3d32] font-medium">Description <span className="text-[#8b6b5c]">(optional)</span></Label>
            <textarea
              id="pkg-desc"
              value={form.description}
              onChange={set('description')}
              rows={2}
              placeholder="Shown to students on the pricing page"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {/* Credits + type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pkg-credits" className="text-[#6b3d32] font-medium">Credits *</Label>
              <Input id="pkg-credits" type="number" min={1} value={form.creditsAmount} onChange={set('creditsAmount')} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pkg-ctype" className="text-[#6b3d32] font-medium">Credit tier *</Label>
              <select
                id="pkg-ctype"
                value={form.creditType}
                onChange={set('creditType')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus:ring-1 focus:ring-ring"
              >
                {availableCreditTypes.map((creditType) => (
                  <option key={creditType} value={creditType}>
                    {getCreditTypeLabel(creditType)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Price + validity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pkg-price" className="text-[#6b3d32] font-medium">Price (EUR) *</Label>
              <Input id="pkg-price" type="number" min={0} step="0.01" value={form.priceEur} onChange={set('priceEur')} required placeholder="89.00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pkg-validity-weeks" className="text-[#6b3d32] font-medium">Validity (weeks) *</Label>
              <Input id="pkg-validity-weeks" type="number" min={1} value={form.validityWeeks} onChange={set('validityWeeks')} required />
              <p className="text-xs text-[#8b6b5c] mt-1">Credits will expire after {form.validityWeeks} week(s) ({parseInt(form.validityWeeks) * 7} days)</p>
            </div>
          </div>

          {/* Sort + Stripe */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pkg-sort" className="text-[#6b3d32] font-medium">Sort order</Label>
              <Input id="pkg-sort" type="number" min={0} value={form.sortOrder} onChange={set('sortOrder')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pkg-stripe" className="text-[#6b3d32] font-medium">Stripe Price ID <span className="text-[#8b6b5c]">(Phase 2)</span></Label>
              <Input id="pkg-stripe" value={form.stripePriceId} onChange={set('stripePriceId')} placeholder="price_..." />
            </div>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
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

export function CreditPackagesManager({ packages, availableCreditTypes }: Props) {
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
              {['Package', 'Tier', 'Credits', 'Price', 'Validity', 'Status', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6b3d32]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {packages.length === 0 && (
              <tr><td colSpan={7} className="py-12 text-center text-sm text-[#8b6b5c]">No packages yet. Create your first credit package to get started.</td></tr>
            )}
            {packages.map((pkg) => (
              <tr key={pkg.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{pkg.name}</p>
                  {pkg.description && <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">{pkg.description}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getCreditTypeBadgeStyle(pkg.creditType)}`}>
                    {getCreditTypeLabel(pkg.creditType)}
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
            ))}
          </tbody>
        </table>
      </div>

      {/* Dialogs */}
      <PackageFormDialog open={createOpen} onOpenChange={setCreateOpen} editingPackage={null} availableCreditTypes={availableCreditTypes} />
      <PackageFormDialog open={editTarget !== null} onOpenChange={(v) => { if (!v) setEditTarget(null); }} editingPackage={editTarget} availableCreditTypes={availableCreditTypes} />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(v) => { if (!v && !deleting) { setDeleteTarget(null); setDeleteError(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the credit package. If students have purchased it, the delete will be blocked — deactivate it instead.
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
