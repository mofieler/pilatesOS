import { getCreditPackagesAction } from '@/modules/billing/actions/creditPackage.actions';
import { getClassTemplatesAdminAction } from '@/modules/classes/actions/class.actions';
import { CreditPackagesManager } from '@/modules/billing/components/CreditPackagesManager';
import { Package2Icon } from 'lucide-react';
import type { CreditType } from '@/lib/config/class-types';

export default async function CreditsPage() {
  const [packagesResult, templatesResult] = await Promise.all([
    getCreditPackagesAction(),
    getClassTemplatesAdminAction(),
  ]);
  
  const packages = packagesResult.success ? packagesResult.data : [];
  const templates = templatesResult.success ? templatesResult.data : [];
  const isEmpty = packages.length === 0;
  
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

      {/* Empty State */}
      {isEmpty && (
        <div className="rounded-xl border border-[#ede8e5]/50 bg-gradient-to-br from-[#faf9f7] to-[#f5f3f1] p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#c4a88a]/20 mb-4">
            <Package2Icon className="w-8 h-8 text-[#c4a88a]" />
          </div>
          <h2 className="text-xl font-semibold text-[#4e2b22] mb-3">No Credit Packages Yet</h2>
          <p className="text-[#6b3d32] mb-6 max-w-md mx-auto">
            Credit packages allow students to purchase class credits in advance. Create your first package to get started.
          </p>
          
          {/* Setup Guide */}
          <div className="bg-white/80 rounded-lg p-6 text-left max-w-2xl mx-auto">
            <h3 className="text-lg font-semibold text-[#4e2b22] mb-4">Getting Started Guide</h3>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#4a7c4a]/20 flex items-center justify-center text-sm font-semibold text-[#4a7c4a]">1</div>
                <div>
                  <h4 className="font-medium text-[#4e2b22]">Create Your First Package</h4>
                  <p className="text-sm text-[#8b6b5c] mt-1">Click the "New Package" button below to create your first credit package.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#4e2b22]/20 flex items-center justify-center text-sm font-semibold text-[#4e2b22]">2</div>
                <div>
                  <h4 className="font-medium text-[#4e2b22]">Recommended Setup</h4>
                  <div className="text-sm text-[#8b6b5c] mt-1 space-y-2">
                    <p><strong>Starter Package:</strong> 5-10 credits, €8.99-€12.99</p>
                    <p><strong>Standard Package:</strong> 20-50 credits, €29.99-€49.99</p>
                    <p><strong>Premium Package:</strong> 100-200 credits, €99.99-€149.99</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#c4a88a]/20 flex items-center justify-center text-sm font-semibold text-[#c4a88a]">3</div>
                <div>
                  <h4 className="font-medium text-[#4e2b22]">Best Practices</h4>
                  <div className="text-sm text-[#8b6b5c] mt-1 space-y-2">
                    <p>• Set clear, descriptive names (e.g., "10 Class Pass")</p>
                    <p>• Price competitively based on your local market</p>
                    <p>• Consider validity periods (30, 60, 90, 365 days)</p>
                    <p>• Use different credit tiers for flexibility</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-[#ede8e5]/50">
              <p className="text-xs text-[#8b6b5c]">
                <strong>Need help?</strong> Check our documentation or contact support for assistance with setting up your credit packages.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Credit Packages Manager - show even on error so users can create packages */}
      {!isEmpty && (
        <CreditPackagesManager packages={packages} availableCreditTypes={availableCreditTypes} />
      )}
    </div>
  );
}
