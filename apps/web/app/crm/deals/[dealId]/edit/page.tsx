import { AppShell } from "@/src/components/layout/app-shell";
import { requireCurrentUser } from "@/src/features/auth/server/auth-server";
import { DealForm } from "@/src/features/deal/components/deal-form";

import { getShellProductConfig } from "@/app/product-module";
import {
  loadDealWorkspaceDetailPage,
  updateDealWorkspaceAction
} from "@/src/features/crm-product/server/deal-workspace";

interface ResourceEditPageProps {
  params: Promise<{ dealId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResourceEditPage({
  params,
  searchParams
}: ResourceEditPageProps) {
  const currentUser = await requireCurrentUser();
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const data = await loadDealWorkspaceDetailPage(
    {
      dealId: resolvedParams.dealId,
      searchParams: resolvedSearchParams
    },
    {
      currentUser
    }
  );
  const shellProduct = getShellProductConfig({
    activeOrganizationId: data.workspace.activeOrganizationId,
    activeProjectId: data.workspace.activeProjectId,
    installedProducts: data.workspace.activeOrganizationInstalledProducts,
    preferredProductId: "crm"
  });

  return (
    <AppShell
      activeOrganizationId={data.workspace.activeOrganizationId}
      activeProjectId={data.workspace.activeProjectId}
      availableProducts={shellProduct.availableProducts}
      currentUser={currentUser}
      productName={shellProduct.productName}
      productNavItems={shellProduct.navItems}
    >
      <div className="grid gap-6">
        <header className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Edit Deal</p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Edit Deal</h1>
          <p className="max-w-2xl text-sm text-[var(--muted)]">Update the generated deal record through the existing API seam.</p>
        </header>
        <DealForm
          action={updateDealWorkspaceAction}
          defaultValues={data.draftValues?.name !== undefined || data.draftValues?.stage !== undefined || data.draftValues?.amount !== undefined || data.draftValues?.companyId !== undefined || data.draftValues?.ownerId !== undefined ? { ...(data.item ?? {}), ...data.draftValues } : data.item ?? undefined}
          fieldErrors={data.fieldErrors}
          formError={data.feedback}
          relationOptions={data.formOptions}
          submitLabel="Save Deal"
        >
          <input name="dealId" type="hidden" value={data.item?.id ?? resolvedParams.dealId} />
          <input name="organizationId" type="hidden" value={data.workspace.activeOrganizationId ?? ""} />
          <input name="projectId" type="hidden" value={data.workspace.activeProjectId ?? ""} />
          <input name="list_archived" type="hidden" value={data.listQuery.archived} />
          <input name="list_query" type="hidden" value={data.listQuery.query ?? ""} />
          <input name="list_limit" type="hidden" value={data.listQuery.limit?.toString() ?? ""} />
          <input name="list_sortBy" type="hidden" value={data.listQuery.sortBy} />
          <input name="list_sortDirection" type="hidden" value={data.listQuery.sortDirection} />
          <input name="list_stage" type="hidden" value={data.listQuery.stage ?? ""} />
          <input name="list_companyId" type="hidden" value={data.listQuery.companyId ?? ""} />
          <input name="list_ownerId" type="hidden" value={data.listQuery.ownerId ?? ""} />
        </DealForm>
      </div>
    </AppShell>
  );
}
