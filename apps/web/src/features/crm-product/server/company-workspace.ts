import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createCompanyInputSchema, updateCompanyInputSchema } from "@auditrail/domain/generated/company";
import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";
import type { CompanyRecord } from "@/src/features/company/domain/schemas";
import { createServerApiClient } from "@/src/lib/api/server-api-client";
import { resolveWorkspaceContext } from "@/src/features/organizations/domain/workspace";
import { createResourceClient } from "@/src/features/company/api/company-client";
export async function loadCompanyWorkspacePage(
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
export async function loadCompanyWorkspaceDetailPage(
  input: {
    companyId: string;
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
        input.companyId
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
export async function createCompanyWorkspaceAction(formData: FormData) {
  "use server";
  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));
  const listQuery = readListQueryFromFormData(formData);
  if (!organizationId.trim()) {
    return redirect(
      buildFailurePath("/crm/companies", "", projectId, listQuery, {
        draftValues: buildDraftValues(formData),
        feedback: "Enable the CRM product for a workspace before creating records."
      }) as never
    );
  }
  try {
    const payload = createCompanyInputSchema.parse({
      name: String(formData.get("name") ?? ""),
      domain: coerceString(formData.get("domain")),
      status: String(formData.get("status") ?? ""),
    });
    await createResourceClient(createServerApiClient()).create(
      organizationId,
      payload
    );
    const nextPath = "/crm/companies" + buildWorkspaceSuffix(organizationId, projectId, listQuery);
    revalidatePath(nextPath);
    redirect(nextPath as never);
  } catch (error) {
    const validationState = getValidationState(error, "Unable to create this record right now.");
    redirect(
      buildFailurePath("/crm/companies", organizationId, projectId, listQuery, {
        draftValues: buildDraftValues(formData),
        feedback: validationState.feedback,
        fieldErrors: validationState.fieldErrors
      }) as never
    );
  }
}
export async function updateCompanyWorkspaceAction(formData: FormData) {
  "use server";
  const companyId = String(formData.get("companyId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));
  const listQuery = readListQueryFromFormData(formData);
  try {
    const payload = updateCompanyInputSchema.parse({
      name: String(formData.get("name") ?? ""),
      domain: coerceString(formData.get("domain")),
      status: String(formData.get("status") ?? ""),
    });
    await createResourceClient(createServerApiClient()).update(
      organizationId,
      companyId,
      payload
    );
    const nextPath = buildResourcePath("/crm/companies", companyId, organizationId, projectId, listQuery, { includeCursor: true });
    const listPath = "/crm/companies" + buildWorkspaceSuffix(organizationId, projectId, listQuery);
    revalidatePath(nextPath);
    revalidatePath(listPath);
    redirect(nextPath as never);
  } catch (error) {
    const validationState = getValidationState(error, "Unable to save changes right now.");
    redirect(
      buildFailurePath(buildResourceEditPath("/crm/companies", companyId), organizationId, projectId, listQuery, {
        draftValues: buildDraftValues(formData),
        feedback: validationState.feedback,
        fieldErrors: validationState.fieldErrors
      }) as never
    );
  }
}

export async function archiveCompanyWorkspaceAction(formData: FormData) {
  "use server";

  const companyId = String(formData.get("companyId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));
  const listQuery = readListQueryFromFormData(formData);

  try {
    await createResourceClient(createServerApiClient()).archive(
      organizationId,
      companyId
    );

    const listPath = "/crm/companies" + buildWorkspaceSuffix(organizationId, projectId, listQuery);
    const detailPath = buildResourcePath(
      "/crm/companies",
      companyId,
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
      buildFailurePath(buildResourcePath("/crm/companies", companyId, organizationId, projectId, listQuery), organizationId, projectId, listQuery, {
        feedback: validationState.feedback,
        fieldErrors: validationState.fieldErrors
      }) as never
    );
  }
}

export async function unarchiveCompanyWorkspaceAction(formData: FormData) {
  "use server";

  const companyId = String(formData.get("companyId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));
  const listQuery = readListQueryFromFormData(formData);

  try {
    await createResourceClient(createServerApiClient()).unarchive(
      organizationId,
      companyId
    );

    const listPath = "/crm/companies" + buildWorkspaceSuffix(organizationId, projectId, { ...listQuery, archived: listQuery.archived === "only" ? "exclude" : listQuery.archived });
    revalidatePath(listPath);
    redirect(buildResourcePath("/crm/companies", companyId, organizationId, projectId, { ...listQuery, archived: "exclude" }) as never);
  } catch (error) {
    const validationState = getValidationState(error, "Unable to restore this record right now.");
    redirect(
      buildFailurePath(buildResourcePath("/crm/companies", companyId, organizationId, projectId, listQuery), organizationId, projectId, listQuery, {
        feedback: validationState.feedback,
        fieldErrors: validationState.fieldErrors
      }) as never
    );
  }
}
type CompanyRelationPresentation = {
  href?: string;
  label: string;
};
type CompanyRelationPresentations = Record<
  string,
  Partial<Record<string, CompanyRelationPresentation>>
>;
type CompanyFormFieldErrors = Partial<Record<keyof CompanyRecord, string>>;
type CompanyFormOption = {
  label: string;
  value: string;
};
type CompanyFormOptions = Partial<
  Record<keyof CompanyRecord, readonly CompanyFormOption[]>
>;
async function resolveCompanyFormOptions(input: {
  organizationId?: string;
  projectId?: string;
  workspace: ReturnType<typeof resolveWorkspaceContext>;
}): Promise<CompanyFormOptions> {
  const options: CompanyFormOptions = {};
  return options;
}
async function resolveCompanyRelationPresentations(input: {
  items: readonly CompanyRecord[];
  organizationId?: string;
  projectId?: string;
  workspace: ReturnType<typeof resolveWorkspaceContext>;
}): Promise<CompanyRelationPresentations> {
  const presentations: CompanyRelationPresentations = {};
  if (input.items.length === 0) {
    return presentations;
  }
  for (const item of input.items) {
    presentations[item.id] = {};
  }
  return compactRelationPresentations(presentations);
}
function compactRelationPresentations(
  presentations: CompanyRelationPresentations
): CompanyRelationPresentations {
  return Object.fromEntries(
    Object.entries(presentations).map(([recordId, value]) => [
      recordId,
      Object.fromEntries(
        Object.entries(value).filter(([, relation]) => relation !== undefined)
      )
    ])
  ) as CompanyRelationPresentations;
}
type CompanyListQuery = {
  archived: "exclude" | "include" | "only";
  cursor?: string;
  limit?: number;
  query?: string;
  sortBy: "createdAt" | "updatedAt" | "name";
  sortDirection: "asc" | "desc";
  status?: "lead" | "customer" | "inactive";
};
function buildWorkspaceSuffix(
  organizationId: string,
  projectId: string | undefined,
  query: CompanyListQuery,
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
  query?: CompanyListQuery,
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
  query: CompanyListQuery,
  input: {
    draftValues?: Record<string, string | undefined>;
    feedback: string;
    fieldErrors?: CompanyFormFieldErrors;
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
    name: getSearchValue(searchParams.error_name) ?? undefined,
    domain: getSearchValue(searchParams.error_domain) ?? undefined,
    status: getSearchValue(searchParams.error_status) ?? undefined,
  }) as CompanyFormFieldErrors;
}
function readDefaultListQuery(): CompanyListQuery {
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
function readListQuery(searchParams: Record<string, string | string[] | undefined>): CompanyListQuery {
  return {
    archived: readArchivedFilter(searchParams),
    cursor: getSearchValue(searchParams.cursor) ?? undefined,
    limit: readPositiveInteger(getSearchValue(searchParams.limit)),
    query: getSearchValue(searchParams.query) ?? undefined,
    sortBy: readAllowedValue(getSearchValue(searchParams.sortBy), ["createdAt", "updatedAt", "name"]) ?? "createdAt",
    sortDirection: readAllowedValue(getSearchValue(searchParams.sortDirection), ["asc", "desc"]) ?? "desc",
    status: readAllowedValue(getSearchValue(searchParams.status), ["lead", "customer", "inactive"]) ?? undefined,
  };
}
function readListQueryFromFormData(formData: FormData): CompanyListQuery {
  return {
    archived: readArchivedFilterFromFormData(formData),
    cursor: undefined,
    limit: readPositiveInteger(coerceString(formData.get("list_limit"))),
    query: coerceString(formData.get("list_query")),
    sortBy: readAllowedValue(coerceString(formData.get("list_sortBy")), ["createdAt", "updatedAt", "name"]) ?? "createdAt",
    sortDirection: readAllowedValue(coerceString(formData.get("list_sortDirection")), ["asc", "desc"]) ?? "desc",
    status: readAllowedValue(coerceString(formData.get("list_status")), ["lead", "customer", "inactive"]) ?? undefined,
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
    name: getSearchValue(searchParams.draft_name) ?? undefined,
    domain: getSearchValue(searchParams.draft_domain) ?? undefined,
    status: ["lead","customer","inactive"].includes(getSearchValue(searchParams.draft_status) ?? "") ? (getSearchValue(searchParams.draft_status) as "lead" | "customer" | "inactive") : undefined,
  });
}
function buildDraftValues(formData: FormData) {
  return {
    name: coerceString(formData.get("name")),
    domain: coerceString(formData.get("domain")),
    status: coerceString(formData.get("status")),
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
    const fieldErrors = compactFieldErrors(firstFieldErrors) as CompanyFormFieldErrors;
    const issue = error.issues[0];
    return {
      feedback: issue?.message ?? fallback,
      fieldErrors
    };
  }
  if (error instanceof Error && error.message.length > 0) {
    return {
      feedback: error.message,
      fieldErrors: {} as CompanyFormFieldErrors
    };
  }
  return {
    feedback: fallback,
    fieldErrors: {} as CompanyFormFieldErrors
  };
}
