import { getCreditPackagesAction } from '@/modules/billing/actions/creditPackage.actions';
import { CreditPackagesManager } from '@/modules/billing/components/CreditPackagesManager';

export default async function CreditsPage() {
  const result = await getCreditPackagesAction();
  const packages = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Credit Packages</h1>
        <p className="mt-1 text-sm text-slate-500">
          Define what students can purchase. Each package grants a fixed number of credits of a specific tier.
        </p>
      </div>

      {!result.success && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load packages: {result.error}
        </div>
      )}

      <CreditPackagesManager packages={packages} />
    </div>
  );
}
