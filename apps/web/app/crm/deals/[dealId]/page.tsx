import { AppShell } from "@/src/components/layout/app-shell";
import { requireCurrentUser } from "@/src/features/auth/server/auth-server";

import { getShellProductConfig } from "@/app/product-module";
import { archiveDealWorkspaceAction, loadDealWorkspaceDetailPage, unarchiveDealWorkspaceAction } from "@/src/features/crm-product/server/deal-workspace";

interface ResourceDetailPageProps {
  params: Promise<{ dealId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResourceDetailPage({
  params,
  searchParams
}: ResourceDetailPageProps) {
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
  const workspaceSuffix = buildWorkspaceSuffix(
    data.workspace.activeOrganizationId ?? "",
    data.workspace.activeProjectId ?? undefined,
    data.listQuery,
    { includeCursor: true }
  );
  const listHref = "/crm/deals" + workspaceSuffix;
  const editHref = data.item ? "/crm/deals" + `/${data.item.id}/edit${workspaceSuffix}` : listHref;

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
        <header className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Deal detail</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">{data.item?.name?.toString() ?? "Deal"}</h1>
            <div className="flex gap-3 text-sm">
              <a className="rounded-md border border-[var(--border)] px-3 py-2" href={listHref}>Back to list</a>
              {data.item ? <a className="rounded-md border border-[var(--border)] px-3 py-2" href={editHref}>Edit</a> : null}
            </div>
          </div>
        </header>
        {data.feedback ? (
          <p className="rounded-md border border-[var(--border)] bg-[var(--panel-muted)] px-3 py-2 text-sm text-[var(--foreground)]">{data.feedback}</p>
        ) : null}
        {data.item ? (
          <section className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
            <div className="grid gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Name</p>
              <p>{data.item ? renderRelationAwareDetailValue(data.item.id, "name", data.item.name, data.relationPresentations) : "Not set"}</p>
            </div>
            <div className="grid gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Stage</p>
              <p>{data.item ? renderRelationAwareDetailValue(data.item.id, "stage", data.item.stage, data.relationPresentations) : "Not set"}</p>
            </div>
            <div className="grid gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Amount</p>
              <p>{data.item ? renderRelationAwareDetailValue(data.item.id, "amount", data.item.amount, data.relationPresentations) : "Not set"}</p>
            </div>
            <div className="grid gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Company Id</p>
              <p>{data.item ? renderRelationAwareDetailValue(data.item.id, "companyId", data.item.companyId, data.relationPresentations) : "Not set"}</p>
            </div>
            <div className="grid gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Owner Id</p>
              <p>{data.item ? renderRelationAwareDetailValue(data.item.id, "ownerId", data.item.ownerId, data.relationPresentations) : "Not set"}</p>
            </div>

            <form action={data.item.archivedAt ? unarchiveDealWorkspaceAction : archiveDealWorkspaceAction} className="pt-2">
              <input name="dealId" type="hidden" value={data.item.id} />
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
              <button className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium" type="submit">{data.item.archivedAt ? "Restore Deal" : "Archive Deal"}</button>
            </form>
          </section>
        ) : (
          <section className="rounded-xl border border-dashed border-[var(--border)] px-4 py-4 text-sm text-[var(--muted)]">
            Deal not found.
          </section>
        )}
      </div>
    </AppShell>
  );
}

type DealRelationPresentation = {
  href?: string;
  label: string;
};

type DealRelationPresentations = Record<
  string,
  Partial<Record<string, DealRelationPresentation>>
>;

function renderRelationAwareDetailValue(
  recordId: string,
  fieldName: string,
  value: unknown,
  relationPresentations: DealRelationPresentations
) {
  const relation = relationPresentations[recordId]?.[fieldName];

  if (relation?.href) {
    return <a href={relation.href}>{relation.label}</a>;
  }

  if (relation) {
    return relation.label;
  }

  return value?.toString() ?? "Not set";
}

function buildWorkspaceSuffix(
  organizationId: string,
  projectId: string | undefined,
  query: Record<string, string | number | boolean | undefined> & { cursor?: string },
  options?: {
    includeCursor?: boolean;
  }
) {
  const search = new URLSearchParams({ organizationId });

  if (projectId) {
    search.set("projectId", projectId);
  }

  for (const [key, value] of Object.entries({
    archived: query.archived,
    query: query.query,
    limit: query.limit,
    sortBy: query.sortBy !== "createdAt" ? query.sortBy : undefined,
    sortDirection: query.sortDirection !== "desc" ? query.sortDirection : undefined,
    stage: query.stage,
    companyId: query.companyId,
    ownerId: query.ownerId,
  })) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    search.set(key, String(value));
  }

  if (options?.includeCursor && query.cursor) {
    search.set("cursor", query.cursor);
  }

  return `?${search.toString()}`;
}
