import { getCreditPackagesAction } from '@/modules/billing/actions/creditPackage.actions';
import { getClassTemplatesAdminAction } from '@/modules/classes/actions/class.actions';
import { CreditPackagesManager } from '@/modules/billing/components/CreditPackagesManager';
import type { CreditType } from '@/lib/config/class-types';

export default async function CreditsPage() {
  const [packagesResult, templatesResult] = await Promise.all([
    getCreditPackagesAction(),
    getClassTemplatesAdminAction(),
  ]);
  
  const packages = packagesResult.success ? packagesResult.data : [];
  const templates = templatesResult.success ? templatesResult.data : [];
  
  // Extract unique credit types from templates
  const availableCreditTypes = Array.from(
    new Set(templates.map(template => template.creditType).filter(Boolean))
  ) as CreditType[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Credit Packages</h1>
        <p className="mt-1 text-sm text-slate-500">
          Define what students can purchase. Each package grants a fixed number of credits of a specific tier.
        </p>
      </div>

      {/* Error State - only show if there's an actual error and packages exist */}
      {!packagesResult.success && packages.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load packages: {packagesResult.error}
        </div>
      )}

      {/* Credit Packages Manager - handles empty state internally with New Package button */}
      <CreditPackagesManager packages={packages} availableCreditTypes={availableCreditTypes} />
    </div>
  );
}
