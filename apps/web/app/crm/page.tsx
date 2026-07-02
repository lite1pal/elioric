import { AppShell } from "@/src/components/layout/app-shell";
import { requireCurrentUser } from "@/src/features/auth/server/auth-server";
import { resolveWorkspaceContext } from "@/src/features/organizations/domain/workspace";
import { CrmHomeScreen } from "@/src/features/crm-product";

import { getProductMetadata, getShellProductConfig } from "@/app/product-module";

export const metadata = getProductMetadata("crm");

interface ProductPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProductPage({ searchParams }: ProductPageProps) {
  const currentUser = await requireCurrentUser();
  const resolvedSearchParams = await searchParams;
  const workspace = resolveWorkspaceContext(
    currentUser,
    {
      organizationId: getSearchValue(resolvedSearchParams.organizationId),
      projectId: getSearchValue(resolvedSearchParams.projectId)
    },
    {
      requiredProductId: "crm"
    }
  );
  const shellProduct = getShellProductConfig({
    activeOrganizationId: workspace.activeOrganizationId,
    activeProjectId: workspace.activeProjectId,
    installedProducts: workspace.activeOrganizationInstalledProducts,
    preferredProductId: "crm"
  });
  const workspaceSuffix = buildWorkspaceSuffix(
    workspace.activeOrganizationId,
    workspace.activeProjectId
  );

  return (
    <AppShell
      activeOrganizationId={workspace.activeOrganizationId}
      activeProjectId={workspace.activeProjectId}
      availableProducts={shellProduct.availableProducts}
      currentUser={currentUser}
      productName={shellProduct.productName}
      productNavItems={shellProduct.navItems}
    >
      <CrmHomeScreen
        organizationName={workspace.activeOrganization?.name}
        resourceLinks={[
          { href: `/crm/companies${workspaceSuffix}`, label: "Companies" },
          { href: `/crm/contacts${workspaceSuffix}`, label: "Contacts" },
          { href: `/crm/deals${workspaceSuffix}`, label: "Deals" },
          { href: `/crm/notes${workspaceSuffix}`, label: "Notes" },
        ]}
      />
    </AppShell>
  );
}
function buildWorkspaceSuffix(
  organizationId?: string,
  projectId?: string
) {
  if (!organizationId) {
    return "";
  }

  const query = new URLSearchParams({ organizationId });

  if (projectId) {
    query.set("projectId", projectId);
  }

  return `?${query.toString()}`;
}

function getSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
