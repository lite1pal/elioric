import { AppShell } from "@/src/components/layout/app-shell";
import { requireCurrentUser } from "@/src/features/auth/server/auth-server";
import { TodoForm } from "@/src/features/todo/components/todo-form";

import { getShellProductConfig } from "@/app/product-module";
import {
  loadTodoWorkspaceDetailPage,
  updateTodoWorkspaceAction
} from "@/src/features/todo-product/server/todo-workspace";

interface ResourceEditPageProps {
  params: Promise<{ todoId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResourceEditPage({
  params,
  searchParams
}: ResourceEditPageProps) {
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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Edit Todo</p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Edit Todo</h1>
          <p className="max-w-2xl text-sm text-[var(--muted)]">Update the generated todo record through the existing API seam.</p>
        </header>
        {data.feedback ? (
          <p className="rounded-md border border-[var(--border)] bg-[var(--panel-muted)] px-3 py-2 text-sm text-[var(--foreground)]">{data.feedback}</p>
        ) : null}
        <TodoForm
          action={updateTodoWorkspaceAction}
          defaultValues={data.draftValues?.title !== undefined || data.draftValues?.details !== undefined || data.draftValues?.status !== undefined || data.draftValues?.dueAt !== undefined ? { ...(data.item ?? {}), ...data.draftValues } : data.item ?? undefined}
          submitLabel="Save Todo"
        >
          <input name="todoId" type="hidden" value={data.item?.id ?? resolvedParams.todoId} />
          <input name="organizationId" type="hidden" value={data.workspace.activeOrganizationId ?? ""} />
          <input name="projectId" type="hidden" value={data.workspace.activeProjectId ?? ""} />
          <input name="list_archived" type="hidden" value={data.listQuery.archived} />
          <input name="list_query" type="hidden" value={data.listQuery.query ?? ""} />
          <input name="list_limit" type="hidden" value={data.listQuery.limit?.toString() ?? ""} />
          <input name="list_sortBy" type="hidden" value={data.listQuery.sortBy} />
          <input name="list_sortDirection" type="hidden" value={data.listQuery.sortDirection} />
          <input name="list_status" type="hidden" value={data.listQuery.status ?? ""} />
        </TodoForm>
      </div>
    </AppShell>
  );
}
