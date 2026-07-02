import { AppShell } from "@/src/components/layout/app-shell";
import { requireCurrentUser } from "@/src/features/auth/server/auth-server";
import { CompanyForm } from "@/src/features/company/components/company-form";

import { getShellProductConfig } from "@/app/product-module";
import {
  loadCompanyWorkspaceDetailPage,
  updateCompanyWorkspaceAction
} from "@/src/features/crm-product/server/company-workspace";

interface ResourceEditPageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResourceEditPage({
  params,
  searchParams
}: ResourceEditPageProps) {
  const currentUser = await requireCurrentUser();
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const data = await loadCompanyWorkspaceDetailPage(
    {
      companyId: resolvedParams.companyId,
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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Edit Company</p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Edit Company</h1>
          <p className="max-w-2xl text-sm text-[var(--muted)]">Update the generated company record through the existing API seam.</p>
        </header>
        <CompanyForm
          action={updateCompanyWorkspaceAction}
          defaultValues={data.draftValues?.name !== undefined || data.draftValues?.domain !== undefined || data.draftValues?.status !== undefined ? { ...(data.item ?? {}), ...data.draftValues } : data.item ?? undefined}
          fieldErrors={data.fieldErrors}
          formError={data.feedback}
          relationOptions={data.formOptions}
          submitLabel="Save Company"
        >
          <input name="companyId" type="hidden" value={data.item?.id ?? resolvedParams.companyId} />
          <input name="organizationId" type="hidden" value={data.workspace.activeOrganizationId ?? ""} />
          <input name="projectId" type="hidden" value={data.workspace.activeProjectId ?? ""} />
          <input name="list_archived" type="hidden" value={data.listQuery.archived} />
          <input name="list_query" type="hidden" value={data.listQuery.query ?? ""} />
          <input name="list_limit" type="hidden" value={data.listQuery.limit?.toString() ?? ""} />
          <input name="list_sortBy" type="hidden" value={data.listQuery.sortBy} />
          <input name="list_sortDirection" type="hidden" value={data.listQuery.sortDirection} />
          <input name="list_status" type="hidden" value={data.listQuery.status ?? ""} />
        </CompanyForm>
      </div>
    </AppShell>
  );
}
