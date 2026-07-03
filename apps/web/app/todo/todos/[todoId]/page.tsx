import { AppShell } from "@/src/components/layout/app-shell";
import { requireCurrentUser } from "@/src/features/auth/server/auth-server";

import { getShellProductConfig } from "@/app/product-module";
import { archiveTodoWorkspaceAction, loadTodoWorkspaceDetailPage, unarchiveTodoWorkspaceAction } from "@/src/features/todo-product/server/todo-workspace";

interface ResourceDetailPageProps {
  params: Promise<{ todoId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResourceDetailPage({
  params,
  searchParams
}: ResourceDetailPageProps) {
  const currentUser = await requireCurrentUser();
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const data = await loadTodoWorkspaceDetailPage(
    {
      todoId: resolvedParams.todoId,
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
    preferredProductId: "todo"
  });
  const workspaceSuffix = data.workspace.activeOrganizationId
    ? buildWorkspaceSuffix(
        data.workspace.activeOrganizationId,
        data.workspace.activeProjectId ?? undefined,
        data.listQuery,
        { includeCursor: true }
      )
    : "";
  const listHref = "/todo/todos" + workspaceSuffix;
  const editHref = data.item ? "/todo/todos" + `/${data.item.id}/edit${workspaceSuffix}` : listHref;

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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Todo detail</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">{data.item?.title?.toString() ?? "Todo"}</h1>
            <div className="flex gap-3 text-sm">
              <a className="rounded-md border border-[var(--border)] px-3 py-2" href={listHref}>Back to list</a>
              {data.item ? <a className="rounded-md border border-[var(--border)] px-3 py-2" href={editHref}>Edit</a> : null}
            </div>
          </div>
        </header>
        {data.feedback ? (
          <p className="rounded-md border border-[var(--border)] bg-[var(--panel-muted)] px-3 py-2 text-sm text-[var(--foreground)]">{data.feedback}</p>
        ) : null}
        {!data.workspace.activeOrganizationId ? (
          <section className="rounded-xl border border-dashed border-[var(--border)] px-4 py-4 text-sm text-[var(--muted)]">No workspace with the Todo product is enabled for this account yet.</section>
        ) : data.item ? (
          <section className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
            <div className="grid gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Title</p>
              <p>{data.item ? renderRelationAwareDetailValue(data.item.id, "title", data.item.title, data.relationPresentations) : "Not set"}</p>
            </div>
            <div className="grid gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Details</p>
              <p>{data.item ? renderRelationAwareDetailValue(data.item.id, "details", data.item.details, data.relationPresentations) : "Not set"}</p>
            </div>
            <div className="grid gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Status</p>
              <p>{data.item ? renderRelationAwareDetailValue(data.item.id, "status", data.item.status, data.relationPresentations) : "Not set"}</p>
            </div>
            <div className="grid gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Due At</p>
              <p>{data.item ? renderRelationAwareDetailValue(data.item.id, "dueAt", data.item.dueAt, data.relationPresentations) : "Not set"}</p>
            </div>

            <form action={data.item.archivedAt ? unarchiveTodoWorkspaceAction : archiveTodoWorkspaceAction} className="pt-2">
              <input name="todoId" type="hidden" value={data.item.id} />
              <input name="organizationId" type="hidden" value={data.workspace.activeOrganizationId} />
              <input name="projectId" type="hidden" value={data.workspace.activeProjectId ?? ""} />
          <input name="list_archived" type="hidden" value={data.listQuery.archived} />
          <input name="list_query" type="hidden" value={data.listQuery.query ?? ""} />
          <input name="list_limit" type="hidden" value={data.listQuery.limit?.toString() ?? ""} />
          <input name="list_sortBy" type="hidden" value={data.listQuery.sortBy} />
          <input name="list_sortDirection" type="hidden" value={data.listQuery.sortDirection} />
          <input name="list_status" type="hidden" value={data.listQuery.status ?? ""} />
              <button className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium" type="submit">{data.item.archivedAt ? "Restore Todo" : "Archive Todo"}</button>
            </form>
          </section>
        ) : (
          <section className="rounded-xl border border-dashed border-[var(--border)] px-4 py-4 text-sm text-[var(--muted)]">
            Todo not found.
          </section>
        )}
      </div>
    </AppShell>
  );
}

type TodoRelationPresentation = {
  href?: string;
  label: string;
};

type TodoRelationPresentations = Record<
  string,
  Partial<Record<string, TodoRelationPresentation>>
>;

function renderRelationAwareDetailValue(
  recordId: string,
  fieldName: string,
  value: unknown,
  relationPresentations: TodoRelationPresentations
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
  const search = new URLSearchParams();

  if (organizationId) {
    search.set("organizationId", organizationId);
  }

  if (projectId) {
    search.set("projectId", projectId);
  }

  for (const [key, value] of Object.entries({
    archived: query.archived,
    query: query.query,
    limit: query.limit,
    sortBy: query.sortBy !== "createdAt" ? query.sortBy : undefined,
    sortDirection: query.sortDirection !== "desc" ? query.sortDirection : undefined,
    status: query.status,
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
