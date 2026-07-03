import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createTodoInputSchema, updateTodoInputSchema } from "@auditrail/domain/generated/todo";
import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";
import type { TodoRecord } from "@/src/features/todo/domain/schemas";
import { createServerApiClient } from "@/src/lib/api/server-api-client";
import { resolveWorkspaceContext } from "@/src/features/organizations/domain/workspace";
import { createResourceClient } from "@/src/features/todo/api/todo-client";
export async function loadTodoWorkspacePage(
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
      requiredProductId: "todo"
    }
  );
  const listQuery = readListQuery(searchParams);
  const listResponse = workspace.activeOrganizationId
    ? await createResourceClient(createServerApiClient()).list(
        workspace.activeOrganizationId,
        listQuery
      )
    : { items: [], pageInfo: { hasMore: false, nextCursor: null } };
  const formOptions = {};
  const relationPresentations = {};
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
export async function loadTodoWorkspaceDetailPage(
  input: {
    todoId: string;
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
      requiredProductId: "todo"
    }
  );
  const listQuery = readListQuery(input.searchParams);
  const item = workspace.activeOrganizationId
    ? await createResourceClient(createServerApiClient()).get(
        workspace.activeOrganizationId,
        input.todoId
      )
    : null;
  const formOptions = {};
  const relationPresentations = {};
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
export async function createTodoWorkspaceAction(formData: FormData) {
  "use server";
  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));
  const listQuery = readListQueryFromFormData(formData);
  if (!organizationId.trim()) {
    return redirect(
      buildFailurePath("/todo/todos", "", projectId, listQuery, {
        draftValues: buildDraftValues(formData),
        feedback: "Enable the Todo product for a workspace before managing todos."
      }) as never
    );
  }
  try {
    const payload = createTodoInputSchema.parse({
      title: String(formData.get("title") ?? ""),
      details: coerceString(formData.get("details")),
      status: String(formData.get("status") ?? ""),
      dueAt: coerceDatetime(formData.get("dueAt")),
    });
    await createResourceClient(createServerApiClient()).create(
      organizationId,
      payload
    );
    const nextPath = "/todo/todos" + buildWorkspaceSuffix(organizationId, projectId, listQuery);
    revalidatePath(nextPath);
    redirect(nextPath as never);
  } catch (error) {
    const validationState = getValidationState(error, "Unable to create this record right now.");
    redirect(
      buildFailurePath("/todo/todos", organizationId, projectId, listQuery, {
        draftValues: buildDraftValues(formData),
        feedback: validationState.feedback,
        fieldErrors: validationState.fieldErrors
      }) as never
    );
  }
}
export async function updateTodoWorkspaceAction(formData: FormData) {
  "use server";
  const todoId = String(formData.get("todoId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));
  const listQuery = readListQueryFromFormData(formData);
  if (!organizationId.trim()) {
    return redirect(
      buildFailurePath(buildResourceEditPath("/todo/todos", todoId), "", projectId, listQuery, {
        draftValues: buildDraftValues(formData),
        feedback: "Enable the Todo product for a workspace before managing todos."
      }) as never
    );
  }
  try {
    const payload = updateTodoInputSchema.parse({
      title: String(formData.get("title") ?? ""),
      details: coerceString(formData.get("details")),
      status: String(formData.get("status") ?? ""),
      dueAt: coerceDatetime(formData.get("dueAt")),
    });
    await createResourceClient(createServerApiClient()).update(
      organizationId,
      todoId,
      payload
    );
    const nextPath = buildResourcePath("/todo/todos", todoId, organizationId, projectId, listQuery, { includeCursor: true });
    const listPath = "/todo/todos" + buildWorkspaceSuffix(organizationId, projectId, listQuery);
    revalidatePath(nextPath);
    revalidatePath(listPath);
    redirect(nextPath as never);
  } catch (error) {
    const validationState = getValidationState(error, "Unable to save changes right now.");
    redirect(
      buildFailurePath(buildResourceEditPath("/todo/todos", todoId), organizationId, projectId, listQuery, {
        draftValues: buildDraftValues(formData),
        feedback: validationState.feedback,
        fieldErrors: validationState.fieldErrors
      }) as never
    );
  }
}

export async function archiveTodoWorkspaceAction(formData: FormData) {
  "use server";

  const todoId = String(formData.get("todoId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));
  const listQuery = readListQueryFromFormData(formData);

  if (!organizationId.trim()) {
    return redirect(
      buildFailurePath(buildResourcePath("/todo/todos", todoId, "", projectId, listQuery), "", projectId, listQuery, {
        feedback: "Enable the Todo product for a workspace before managing todos."
      }) as never
    );
  }

  try {
    await createResourceClient(createServerApiClient()).archive(
      organizationId,
      todoId
    );

    const listPath = "/todo/todos" + buildWorkspaceSuffix(organizationId, projectId, listQuery);
    const detailPath = buildResourcePath(
      "/todo/todos",
      todoId,
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
      buildFailurePath(buildResourcePath("/todo/todos", todoId, organizationId, projectId, listQuery), organizationId, projectId, listQuery, {
        feedback: validationState.feedback,
        fieldErrors: validationState.fieldErrors
      }) as never
    );
  }
}

export async function unarchiveTodoWorkspaceAction(formData: FormData) {
  "use server";

  const todoId = String(formData.get("todoId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));
  const listQuery = readListQueryFromFormData(formData);

  if (!organizationId.trim()) {
    return redirect(
      buildFailurePath(buildResourcePath("/todo/todos", todoId, "", projectId, listQuery), "", projectId, listQuery, {
        feedback: "Enable the Todo product for a workspace before managing todos."
      }) as never
    );
  }

  try {
    await createResourceClient(createServerApiClient()).unarchive(
      organizationId,
      todoId
    );

    const listPath = "/todo/todos" + buildWorkspaceSuffix(organizationId, projectId, { ...listQuery, archived: listQuery.archived === "only" ? "exclude" : listQuery.archived });
    revalidatePath(listPath);
    redirect(buildResourcePath("/todo/todos", todoId, organizationId, projectId, { ...listQuery, archived: "exclude" }) as never);
  } catch (error) {
    const validationState = getValidationState(error, "Unable to restore this record right now.");
    redirect(
      buildFailurePath(buildResourcePath("/todo/todos", todoId, organizationId, projectId, listQuery), organizationId, projectId, listQuery, {
        feedback: validationState.feedback,
        fieldErrors: validationState.fieldErrors
      }) as never
    );
  }
}
type TodoRelationPresentation = {
  href?: string;
  label: string;
};
type TodoRelationPresentations = Record<
  string,
  Partial<Record<string, TodoRelationPresentation>>
>;
type TodoFormFieldErrors = Partial<Record<keyof TodoRecord, string>>;
type TodoFormOption = {
  label: string;
  value: string;
};
type TodoFormOptions = Partial<
  Record<keyof TodoRecord, readonly TodoFormOption[]>
>;
async function resolveTodoFormOptions(input: {
  organizationId?: string;
  projectId?: string;
  workspace: ReturnType<typeof resolveWorkspaceContext>;
}): Promise<TodoFormOptions> {
  const options: TodoFormOptions = {};
  return options;
}
async function resolveTodoRelationPresentations(input: {
  items: readonly TodoRecord[];
  organizationId?: string;
  projectId?: string;
  workspace: ReturnType<typeof resolveWorkspaceContext>;
}): Promise<TodoRelationPresentations> {
  const presentations: TodoRelationPresentations = {};
  if (input.items.length === 0) {
    return presentations;
  }
  for (const item of input.items) {
    presentations[item.id] = {};
  }
  return compactRelationPresentations(presentations);
}
function compactRelationPresentations(
  presentations: TodoRelationPresentations
): TodoRelationPresentations {
  return Object.fromEntries(
    Object.entries(presentations).map(([recordId, value]) => [
      recordId,
      Object.fromEntries(
        Object.entries(value).filter(([, relation]) => relation !== undefined)
      )
    ])
  ) as TodoRelationPresentations;
}
type TodoListQuery = {
  archived: "exclude" | "include" | "only";
  cursor?: string;
  limit?: number;
  query?: string;
  sortBy: "createdAt" | "updatedAt" | "title";
  sortDirection: "asc" | "desc";
  status?: "todo" | "done";
};
function buildWorkspaceSuffix(
  organizationId: string,
  projectId: string | undefined,
  query: TodoListQuery,
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
function buildResourcePath(
  basePath: string,
  id: string,
  organizationId: string,
  projectId?: string,
  query?: TodoListQuery,
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
  query: TodoListQuery,
  input: {
    draftValues?: Record<string, string | undefined>;
    feedback: string;
    fieldErrors?: TodoFormFieldErrors;
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
    title: getSearchValue(searchParams.error_title) ?? undefined,
    details: getSearchValue(searchParams.error_details) ?? undefined,
    status: getSearchValue(searchParams.error_status) ?? undefined,
    dueAt: getSearchValue(searchParams.error_dueAt) ?? undefined,
  }) as TodoFormFieldErrors;
}
function readDefaultListQuery(): TodoListQuery {
  return {
    archived: "exclude",
    cursor: undefined,
    limit: undefined,
    query: undefined,
    sortBy: "createdAt",
    sortDirection: "desc",
    status: undefined,
  };
}
function readListQuery(searchParams: Record<string, string | string[] | undefined>): TodoListQuery {
  return {
    archived: readArchivedFilter(searchParams),
    cursor: getSearchValue(searchParams.cursor) ?? undefined,
    limit: readPositiveInteger(getSearchValue(searchParams.limit)),
    query: getSearchValue(searchParams.query) ?? undefined,
    sortBy: readAllowedValue(getSearchValue(searchParams.sortBy), ["createdAt", "updatedAt", "title"]) ?? "createdAt",
    sortDirection: readAllowedValue(getSearchValue(searchParams.sortDirection), ["asc", "desc"]) ?? "desc",
    status: readAllowedValue(getSearchValue(searchParams.status), ["todo", "done"]) ?? undefined,
  };
}
function readListQueryFromFormData(formData: FormData): TodoListQuery {
  return {
    archived: readArchivedFilterFromFormData(formData),
    cursor: undefined,
    limit: readPositiveInteger(coerceString(formData.get("list_limit"))),
    query: coerceString(formData.get("list_query")),
    sortBy: readAllowedValue(coerceString(formData.get("list_sortBy")), ["createdAt", "updatedAt", "title"]) ?? "createdAt",
    sortDirection: readAllowedValue(coerceString(formData.get("list_sortDirection")), ["asc", "desc"]) ?? "desc",
    status: readAllowedValue(coerceString(formData.get("list_status")), ["todo", "done"]) ?? undefined,
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
    title: getSearchValue(searchParams.draft_title) ?? undefined,
    details: getSearchValue(searchParams.draft_details) ?? undefined,
    status: ["todo","done"].includes(getSearchValue(searchParams.draft_status) ?? "") ? (getSearchValue(searchParams.draft_status) as "todo" | "done") : undefined,
    dueAt: getSearchValue(searchParams.draft_dueAt) ?? undefined,
  });
}
function buildDraftValues(formData: FormData) {
  return {
    title: coerceString(formData.get("title")),
    details: coerceString(formData.get("details")),
    status: coerceString(formData.get("status")),
    dueAt: coerceString(formData.get("dueAt")),
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
    const fieldErrors = compactFieldErrors(firstFieldErrors) as TodoFormFieldErrors;
    const issue = error.issues[0];
    return {
      feedback: issue?.message ?? fallback,
      fieldErrors
    };
  }
  if (error instanceof Error && error.message.length > 0) {
    return {
      feedback: error.message,
      fieldErrors: {} as TodoFormFieldErrors
    };
  }
  return {
    feedback: fallback,
    fieldErrors: {} as TodoFormFieldErrors
  };
}
