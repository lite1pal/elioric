import { AppShell } from "@/src/components/layout/app-shell";
import { requireCurrentUser } from "@/src/features/auth/server/auth-server";
import { NoteForm } from "@/src/features/note/components/note-form";

import { getShellProductConfig } from "@/app/product-module";
import {
  loadNoteWorkspaceDetailPage,
  updateNoteWorkspaceAction
} from "@/src/features/crm-product/server/note-workspace";

interface ResourceEditPageProps {
  params: Promise<{ noteId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResourceEditPage({
  params,
  searchParams
}: ResourceEditPageProps) {
  const currentUser = await requireCurrentUser();
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const data = await loadNoteWorkspaceDetailPage(
    {
      noteId: resolvedParams.noteId,
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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Edit Note</p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Edit Note</h1>
          <p className="max-w-2xl text-sm text-[var(--muted)]">Update the generated note record through the existing API seam.</p>
        </header>
        {data.feedback ? (
          <p className="rounded-md border border-[var(--border)] bg-[var(--panel-muted)] px-3 py-2 text-sm text-[var(--foreground)]">{data.feedback}</p>
        ) : null}
        <NoteForm
          action={updateNoteWorkspaceAction}
          defaultValues={data.draftValues?.body !== undefined || data.draftValues?.dealId !== undefined ? { ...(data.item ?? {}), ...data.draftValues } : data.item ?? undefined}
          submitLabel="Save Note"
        >
          <input name="noteId" type="hidden" value={data.item?.id ?? resolvedParams.noteId} />
          <input name="organizationId" type="hidden" value={data.workspace.activeOrganizationId ?? ""} />
          <input name="projectId" type="hidden" value={data.workspace.activeProjectId ?? ""} />
          <input name="list_archived" type="hidden" value={data.listQuery.archived} />
          <input name="list_query" type="hidden" value={data.listQuery.query ?? ""} />
          <input name="list_limit" type="hidden" value={data.listQuery.limit?.toString() ?? ""} />
          <input name="list_sortBy" type="hidden" value={data.listQuery.sortBy} />
          <input name="list_sortDirection" type="hidden" value={data.listQuery.sortDirection} />
          <input name="list_dealId" type="hidden" value={data.listQuery.dealId ?? ""} />
        </NoteForm>
      </div>
    </AppShell>
  );
}
