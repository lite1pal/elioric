import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createNoteInputSchema, updateNoteInputSchema } from "@auditrail/domain/generated/note";
import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";
import type { NoteRecord } from "@/src/features/note/domain/schemas";
import { createServerApiClient } from "@/src/lib/api/server-api-client";
import { resolveWorkspaceContext } from "@/src/features/organizations/domain/workspace";
import { createResourceClient } from "@/src/features/note/api/note-client";
import { createResourceClient as createDealResourceClient } from "@/src/features/deal/api/deal-client";
export async function loadNoteWorkspacePage(
  searchParams: Record<string, string | string[] | undefined>,
  dependencies: {
    currentUser: CurrentUserResponse;
  }
) {
  const workspace = resolveWorkspaceContext(
    dependencies.currentUser,
    {
      organizationId: getSearchValue(searchParams.organizationId),
      projectId: getSearchValue(searchParams.projectId)
    },
    {
      requiredProductId: "crm"
    }
  );
  const listQuery = readListQuery(searchParams);
  const listResponse = workspace.activeOrganizationId
    ? await createResourceClient(createServerApiClient()).list(
        workspace.activeOrganizationId,
        listQuery
      )
    : { items: [], pageInfo: { hasMore: false, nextCursor: null } };
  const formOptions = await resolveNoteFormOptions({
    organizationId: workspace.activeOrganizationId,
    projectId: workspace.activeProjectId,
    workspace
  });
  const relationPresentations = await resolveNoteRelationPresentations({
    items: listResponse.items,
    organizationId: workspace.activeOrganizationId,
    projectId: workspace.activeProjectId,
    workspace
  });
  return {
    draftValues: readDraftValues(searchParams),
    fieldErrors: readFieldErrors(searchParams),
    feedback: readFeedback(searchParams),
    formOptions,
    items: listResponse.items,
    listQuery,
    pageInfo: listResponse.pageInfo,
    relationPresentations,
    workspace
  };
}
export async function loadNoteWorkspaceDetailPage(
  input: {
    noteId: string;
    searchParams: Record<string, string | string[] | undefined>;
  },
  dependencies: {
    currentUser: CurrentUserResponse;
  }
) {
  const workspace = resolveWorkspaceContext(
    dependencies.currentUser,
    {
      organizationId: getSearchValue(input.searchParams.organizationId),
      projectId: getSearchValue(input.searchParams.projectId)
    },
    {
      requiredProductId: "crm"
    }
  );
  const listQuery = readListQuery(input.searchParams);
  const item = workspace.activeOrganizationId
    ? await createResourceClient(createServerApiClient()).get(
        workspace.activeOrganizationId,
        input.noteId
      )
    : null;
  const formOptions = await resolveNoteFormOptions({
    organizationId: workspace.activeOrganizationId,
    projectId: workspace.activeProjectId,
    workspace
  });
  const relationPresentations = item
    ? await resolveNoteRelationPresentations({
        items: [item],
        organizationId: workspace.activeOrganizationId,
        projectId: workspace.activeProjectId,
        workspace
      })
    : {};
  return {
    draftValues: readDraftValues(input.searchParams),
    fieldErrors: readFieldErrors(input.searchParams),
    feedback: readFeedback(input.searchParams),
    formOptions,
    item,
    listQuery,
    relationPresentations,
    workspace
  };
}
export async function createNoteWorkspaceAction(formData: FormData) {
  "use server";
  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));
  const listQuery = readListQueryFromFormData(formData);
  try {
    const payload = createNoteInputSchema.parse({
      body: String(formData.get("body") ?? ""),
      dealId: String(formData.get("dealId") ?? ""),
    });
    await createResourceClient(createServerApiClient()).create(
      organizationId,
      payload
    );
    const nextPath = "/crm/notes" + buildWorkspaceSuffix(organizationId, projectId, listQuery);
    revalidatePath(nextPath);
    redirect(nextPath as never);
  } catch (error) {
    const validationState = getValidationState(error, "Unable to create this record right now.");
    redirect(
      buildFailurePath("/crm/notes", organizationId, projectId, listQuery, {
        draftValues: buildDraftValues(formData),
        feedback: validationState.feedback,
        fieldErrors: validationState.fieldErrors
      }) as never
    );
  }
}
export async function updateNoteWorkspaceAction(formData: FormData) {
  "use server";
  const noteId = String(formData.get("noteId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));
  const listQuery = readListQueryFromFormData(formData);
  try {
    const payload = updateNoteInputSchema.parse({
      body: String(formData.get("body") ?? ""),
      dealId: String(formData.get("dealId") ?? ""),
    });
    await createResourceClient(createServerApiClient()).update(
      organizationId,
      noteId,
      payload
    );
    const nextPath = buildResourcePath("/crm/notes", noteId, organizationId, projectId, listQuery, { includeCursor: true });
    const listPath = "/crm/notes" + buildWorkspaceSuffix(organizationId, projectId, listQuery);
    revalidatePath(nextPath);
    revalidatePath(listPath);
    redirect(nextPath as never);
  } catch (error) {
    const validationState = getValidationState(error, "Unable to save changes right now.");
    redirect(
      buildFailurePath(buildResourceEditPath("/crm/notes", noteId), organizationId, projectId, listQuery, {
        draftValues: buildDraftValues(formData),
        feedback: validationState.feedback,
        fieldErrors: validationState.fieldErrors
      }) as never
    );
  }
}

export async function archiveNoteWorkspaceAction(formData: FormData) {
  "use server";

  const noteId = String(formData.get("noteId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));
  const listQuery = readListQueryFromFormData(formData);

  try {
    await createResourceClient(createServerApiClient()).archive(
      organizationId,
      noteId
    );

    const listPath = "/crm/notes" + buildWorkspaceSuffix(organizationId, projectId, listQuery);
    const detailPath = buildResourcePath(
      "/crm/notes",
      noteId,
      organizationId,
      projectId,
      { ...listQuery, archived: listQuery.archived === "only" ? "only" : "exclude" }
    );
    revalidatePath(listPath);
    revalidatePath(detailPath);
    redirect(listPath as never);
  } catch (error) {
    const validationState = getValidationState(error, "Unable to archive this record right now.");
    redirect(
      buildFailurePath(buildResourcePath("/crm/notes", noteId, organizationId, projectId, listQuery), organizationId, projectId, listQuery, {
        feedback: validationState.feedback,
        fieldErrors: validationState.fieldErrors
      }) as never
    );
  }
}

export async function unarchiveNoteWorkspaceAction(formData: FormData) {
  "use server";

  const noteId = String(formData.get("noteId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));
  const listQuery = readListQueryFromFormData(formData);

  try {
    await createResourceClient(createServerApiClient()).unarchive(
      organizationId,
      noteId
    );

    const listPath = "/crm/notes" + buildWorkspaceSuffix(organizationId, projectId, { ...listQuery, archived: listQuery.archived === "only" ? "exclude" : listQuery.archived });
    revalidatePath(listPath);
    redirect(buildResourcePath("/crm/notes", noteId, organizationId, projectId, { ...listQuery, archived: "exclude" }) as never);
  } catch (error) {
    const validationState = getValidationState(error, "Unable to restore this record right now.");
    redirect(
      buildFailurePath(buildResourcePath("/crm/notes", noteId, organizationId, projectId, listQuery), organizationId, projectId, listQuery, {
        feedback: validationState.feedback,
        fieldErrors: validationState.fieldErrors
      }) as never
    );
  }
}
type NoteRelationPresentation = {
  href?: string;
  label: string;
};
type NoteRelationPresentations = Record<
  string,
  Partial<Record<string, NoteRelationPresentation>>
>;
type NoteFormFieldErrors = Partial<Record<keyof NoteRecord, string>>;
type NoteFormOption = {
  label: string;
  value: string;
};
type NoteFormOptions = Partial<
  Record<keyof NoteRecord, readonly NoteFormOption[]>
>;
async function resolveNoteFormOptions(input: {
  organizationId?: string;
  projectId?: string;
  workspace: ReturnType<typeof resolveWorkspaceContext>;
}): Promise<NoteFormOptions> {
  const options: NoteFormOptions = {};
  if (input.organizationId) {
    const dealIdResponse = await createDealResourceClient(createServerApiClient()).list(
      input.organizationId,
      {
        archived: "exclude",
        sortBy: "createdAt",
        sortDirection: "desc",
        limit: 100
      }
    );
  
    options.dealId = dealIdResponse.items.map((record) => ({
      label: record.name?.toString() ?? record.id,
      value: record.id
    }));
  }
  
  return options;
}
async function resolveNoteRelationPresentations(input: {
  items: readonly NoteRecord[];
  organizationId?: string;
  projectId?: string;
  workspace: ReturnType<typeof resolveWorkspaceContext>;
}): Promise<NoteRelationPresentations> {
  const presentations: NoteRelationPresentations = {};
  if (input.items.length === 0) {
    return presentations;
  }
  for (const item of input.items) {
    presentations[item.id] = {};
  }
  if (input.organizationId) {
    const organizationId = input.organizationId;
    const dealIdClient = createDealResourceClient(createServerApiClient());
    const dealIdIds = Array.from(
      new Set(
        input.items
          .map((item) => item.dealId)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      )
    );
    const dealIdPresentations = new Map<string, { href?: string; label: string }>();
  
    await Promise.all(
      dealIdIds.map(async (id) => {
        try {
          const record = await dealIdClient.get(organizationId, id);
          dealIdPresentations.set(id, {
            href: buildResourcePath("/crm/deals", record.id, organizationId, input.projectId),
            label: record.name?.toString() ?? record.id
          });
        } catch {
          dealIdPresentations.set(id, { label: id });
        }
      })
    );
  
    for (const item of input.items) {
      if (item.dealId) {
        presentations[item.id].dealId =
          dealIdPresentations.get(item.dealId) ?? { label: item.dealId };
      }
    }
  }
  
  return compactRelationPresentations(presentations);
}
function compactRelationPresentations(
  presentations: NoteRelationPresentations
): NoteRelationPresentations {
  return Object.fromEntries(
    Object.entries(presentations).map(([recordId, value]) => [
      recordId,
      Object.fromEntries(
        Object.entries(value).filter(([, relation]) => relation !== undefined)
      )
    ])
  ) as NoteRelationPresentations;
}
type NoteListQuery = {
  archived: "exclude" | "include" | "only";
  cursor?: string;
  limit?: number;
  query?: string;
  sortBy: "createdAt" | "updatedAt";
  sortDirection: "asc" | "desc";
  dealId?: string;
};
function buildWorkspaceSuffix(
  organizationId: string,
  projectId: string | undefined,
  query: NoteListQuery,
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
    dealId: query.dealId,
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
function buildResourcePath(
  basePath: string,
  id: string,
  organizationId: string,
  projectId?: string,
  query?: NoteListQuery,
  options?: {
    includeCursor?: boolean;
  }
) {
  return `${basePath}/${id}${buildWorkspaceSuffix(organizationId, projectId, query ?? readDefaultListQuery(), options)}`;
}
function buildResourceEditPath(basePath: string, id: string) {
  return `${basePath}/${id}/edit`;
}
function buildFailurePath(
  basePath: string,
  organizationId: string,
  projectId: string | undefined,
  query: NoteListQuery,
  input: {
    draftValues?: Record<string, string | undefined>;
    feedback: string;
    fieldErrors?: NoteFormFieldErrors;
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
    dealId: query.dealId,
  })) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    search.set(key, String(value));
  }
  search.set("feedback", input.feedback);
  for (const [key, value] of Object.entries(input.fieldErrors ?? {})) {
    if (typeof value === "string" && value.length > 0) {
      search.set(`error_${key}`, value);
    }
  }
  for (const [key, value] of Object.entries(input.draftValues ?? {})) {
    if (value !== undefined && value.length > 0) {
      search.set(`draft_${key}`, value);
    }
  }
  return `${basePath}?${search.toString()}`;
}
function getSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
function readAllowedValue<T extends string>(value: string | undefined, allowed: readonly T[]) {
  return value && allowed.includes(value as T) ? (value as T) : undefined;
}
function readPositiveInteger(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
function readFeedback(searchParams: Record<string, string | string[] | undefined>) {
  const feedback = getSearchValue(searchParams.feedback);
  return feedback ? feedback : undefined;
}
function readFieldErrors(searchParams: Record<string, string | string[] | undefined>) {
  return compactFieldErrors({
    body: getSearchValue(searchParams.error_body) ?? undefined,
    dealId: getSearchValue(searchParams.error_dealId) ?? undefined,
  }) as NoteFormFieldErrors;
}
function readDefaultListQuery(): NoteListQuery {
  return {
    archived: "exclude",
    cursor: undefined,
    limit: undefined,
    query: undefined,
    sortBy: "createdAt",
    sortDirection: "desc",
    dealId: undefined,
  };
}
function readListQuery(searchParams: Record<string, string | string[] | undefined>): NoteListQuery {
  return {
    archived: readArchivedFilter(searchParams),
    cursor: getSearchValue(searchParams.cursor) ?? undefined,
    limit: readPositiveInteger(getSearchValue(searchParams.limit)),
    query: getSearchValue(searchParams.query) ?? undefined,
    sortBy: readAllowedValue(getSearchValue(searchParams.sortBy), ["createdAt", "updatedAt"]) ?? "createdAt",
    sortDirection: readAllowedValue(getSearchValue(searchParams.sortDirection), ["asc", "desc"]) ?? "desc",
    dealId: getSearchValue(searchParams.dealId) ?? undefined,
  };
}
function readListQueryFromFormData(formData: FormData): NoteListQuery {
  return {
    archived: readArchivedFilterFromFormData(formData),
    cursor: undefined,
    limit: readPositiveInteger(coerceString(formData.get("list_limit"))),
    query: coerceString(formData.get("list_query")),
    sortBy: readAllowedValue(coerceString(formData.get("list_sortBy")), ["createdAt", "updatedAt"]) ?? "createdAt",
    sortDirection: readAllowedValue(coerceString(formData.get("list_sortDirection")), ["asc", "desc"]) ?? "desc",
    dealId: coerceString(formData.get("list_dealId")),
  };
}

function readArchivedFilter(searchParams: Record<string, string | string[] | undefined>): "exclude" | "include" | "only" {
  const archived = getSearchValue(searchParams.archived);

  return archived === "include" || archived === "only" ? archived : "exclude";
}

function readArchivedFilterFromFormData(formData: FormData): "exclude" | "include" | "only" {
  const value = coerceString(formData.get("list_archived"));

  return value === "include" || value === "only" ? value : "exclude";
}
function readDraftValues(searchParams: Record<string, string | string[] | undefined>) {
  return compactDraftValues({
    body: getSearchValue(searchParams.draft_body) ?? undefined,
    dealId: getSearchValue(searchParams.draft_dealId) ?? undefined,
  });
}
function buildDraftValues(formData: FormData) {
  return {
    body: coerceString(formData.get("body")),
    dealId: coerceString(formData.get("dealId")),
  };
}
function compactDraftValues<T extends Record<string, unknown>>(values: T) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}
function compactFieldErrors(values: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => typeof value === "string" && value.length > 0)
  );
}
function coerceString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
function coerceDatetime(value: FormDataEntryValue | null) {
  const trimmed = coerceString(value);
  return trimmed ? new Date(trimmed).toISOString() : undefined;
}
function coerceBoolean(value: FormDataEntryValue | null) {
  return value === "on";
}
function getValidationState(error: unknown, fallback: string) {
  if (error instanceof ZodError) {
    const flattened = error.flatten().fieldErrors as Record<string, string[] | undefined>;
    const firstFieldErrors: Record<string, string | undefined> = {};
    for (const key of Object.keys(flattened)) {
      firstFieldErrors[key] = flattened[key]?.[0];
    }
    const fieldErrors = compactFieldErrors(firstFieldErrors) as NoteFormFieldErrors;
    const issue = error.issues[0];
    return {
      feedback: issue?.message ?? fallback,
      fieldErrors
    };
  }
  if (error instanceof Error && error.message.length > 0) {
    return {
      feedback: error.message,
      fieldErrors: {} as NoteFormFieldErrors
    };
  }
  return {
    feedback: fallback,
    fieldErrors: {} as NoteFormFieldErrors
  };
}
