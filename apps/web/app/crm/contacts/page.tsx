import { AppShell } from "@/src/components/layout/app-shell";
import { requireCurrentUser } from "@/src/features/auth/server/auth-server";
import { ContactForm } from "@/src/features/contact/components/contact-form";
import { ContactScreen } from "@/src/features/contact/components/contact-screen";

import { getShellProductConfig } from "@/app/product-module";
import {
  createContactWorkspaceAction,
  loadContactWorkspacePage
} from "@/src/features/crm-product/server/contact-workspace";

interface ResourcePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResourcePage({ searchParams }: ResourcePageProps) {
  const currentUser = await requireCurrentUser();
  const resolvedSearchParams = await searchParams;
  const data = await loadContactWorkspacePage(resolvedSearchParams, {
    currentUser
  });
  const shellProduct = getShellProductConfig({
    activeOrganizationId: data.workspace.activeOrganizationId,
    activeProjectId: data.workspace.activeProjectId,
    installedProducts: data.workspace.activeOrganizationInstalledProducts,
    preferredProductId: "crm"
  });
  const resourceQuery = buildWorkspaceSuffix(
    data.workspace.activeOrganizationId ?? "",
    data.workspace.activeProjectId ?? undefined,
    data.listQuery,
    { includeCursor: true }
  ).slice(1);
  const nextPageHref =
    data.pageInfo.hasMore && data.pageInfo.nextCursor && data.workspace.activeOrganizationId
      ? "/crm/contacts" +
        buildWorkspaceSuffix(
          data.workspace.activeOrganizationId,
          data.workspace.activeProjectId ?? undefined,
          { ...data.listQuery, cursor: data.pageInfo.nextCursor },
          { includeCursor: true }
        )
      : null;

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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Contacts</p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Contacts</h1>
          <p className="max-w-2xl text-sm text-[var(--muted)]">This generated product route loads real contacts through the API seam and allows inline creation.</p>
        </header>
        <ContactForm
          action={createContactWorkspaceAction}
          defaultValues={data.draftValues}
          fieldErrors={data.fieldErrors}
          formError={data.feedback}
          relationOptions={data.formOptions}
          submitLabel="Create Contact"
        >
          <input name="organizationId" type="hidden" value={data.workspace.activeOrganizationId ?? ""} />
          <input name="projectId" type="hidden" value={data.workspace.activeProjectId ?? ""} />
          <input name="list_archived" type="hidden" value={data.listQuery.archived} />
          <input name="list_query" type="hidden" value={data.listQuery.query ?? ""} />
          <input name="list_limit" type="hidden" value={data.listQuery.limit?.toString() ?? ""} />
          <input name="list_sortBy" type="hidden" value={data.listQuery.sortBy} />
          <input name="list_sortDirection" type="hidden" value={data.listQuery.sortDirection} />
          <input name="list_companyId" type="hidden" value={data.listQuery.companyId ?? ""} />
        </ContactForm>
        <form action="" className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4" method="GET">
          <input name="organizationId" type="hidden" value={data.workspace.activeOrganizationId ?? ""} />
          <input name="projectId" type="hidden" value={data.workspace.activeProjectId ?? ""} />
          <label className="grid gap-2">
            <span>Archived</span>
            <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={data.listQuery.archived} name="archived">
              <option value="exclude">Active</option>
              <option value="include">All</option>
              <option value="only">Archived</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span>Search</span>
            <input className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={data.listQuery.query ?? ""} name="query" type="text" />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span>Sort By</span>
              <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={data.listQuery.sortBy} name="sortBy">
                <option value="createdAt">Created At</option>
                <option value="updatedAt">Updated At</option>
                <option value="name">Name</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span>Sort Direction</span>
              <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={data.listQuery.sortDirection} name="sortDirection">
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </label>
          </div>
          <label className="grid gap-2">
            <span>Page Size</span>
            <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={data.listQuery.limit?.toString() ?? "25"} name="limit">
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span>Company Id</span>
            <input className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={data.listQuery.companyId ?? ""} name="companyId" type="text" />
          </label>
          <button className="w-fit rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium" type="submit">Apply Filters</button>
        </form>
        <ContactScreen
          items={data.items}
          organizationId={data.workspace.activeOrganizationId ?? undefined}
          projectId={data.workspace.activeProjectId ?? undefined}
          relationPresentations={data.relationPresentations}
          resourceQuery={resourceQuery}
          resourceBasePath="/crm/contacts"
        />
        {nextPageHref ? (
          <a className="w-fit rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium" href={nextPageHref}>Next Page</a>
        ) : null}
      </div>
    </AppShell>
  );
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
    companyId: query.companyId,
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
