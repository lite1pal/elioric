import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createContactInputSchema, updateContactInputSchema } from "@auditrail/domain/generated/contact";
import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";
import type { ContactRecord } from "@/src/features/contact/domain/schemas";
import { createServerApiClient } from "@/src/lib/api/server-api-client";
import { resolveWorkspaceContext } from "@/src/features/organizations/domain/workspace";
import { createResourceClient } from "@/src/features/contact/api/contact-client";
import { createResourceClient as createCompanyResourceClient } from "@/src/features/company/api/company-client";
export async function loadContactWorkspacePage(
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
  const formOptions = await resolveContactFormOptions({
    organizationId: workspace.activeOrganizationId,
    projectId: workspace.activeProjectId,
    workspace
  });
  const relationPresentations = await resolveContactRelationPresentations({
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
export async function loadContactWorkspaceDetailPage(
  input: {
    contactId: string;
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
        input.contactId
      )
    : null;
  const formOptions = await resolveContactFormOptions({
    organizationId: workspace.activeOrganizationId,
    projectId: workspace.activeProjectId,
    workspace
  });
  const relationPresentations = item
    ? await resolveContactRelationPresentations({
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
export async function createContactWorkspaceAction(formData: FormData) {
  "use server";
  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));
  const listQuery = readListQueryFromFormData(formData);
  if (!organizationId.trim()) {
    return redirect(
      buildFailurePath("/crm/contacts", "", projectId, listQuery, {
        draftValues: buildDraftValues(formData),
        feedback: "Enable the CRM product for a workspace before managing contacts."
      }) as never
    );
  }
  try {
    const payload = createContactInputSchema.parse({
      name: String(formData.get("name") ?? ""),
      email: coerceString(formData.get("email")),
      title: coerceString(formData.get("title")),
      companyId: String(formData.get("companyId") ?? ""),
    });
    await createResourceClient(createServerApiClient()).create(
      organizationId,
      payload
    );
    const nextPath = "/crm/contacts" + buildWorkspaceSuffix(organizationId, projectId, listQuery);
    revalidatePath(nextPath);
    redirect(nextPath as never);
  } catch (error) {
    const validationState = getValidationState(error, "Unable to create this record right now.");
    redirect(
      buildFailurePath("/crm/contacts", organizationId, projectId, listQuery, {
        draftValues: buildDraftValues(formData),
        feedback: validationState.feedback,
        fieldErrors: validationState.fieldErrors
      }) as never
    );
  }
}
export async function updateContactWorkspaceAction(formData: FormData) {
  "use server";
  const contactId = String(formData.get("contactId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));
  const listQuery = readListQueryFromFormData(formData);
  if (!organizationId.trim()) {
    return redirect(
      buildFailurePath(buildResourceEditPath("/crm/contacts", contactId), "", projectId, listQuery, {
        draftValues: buildDraftValues(formData),
        feedback: "Enable the CRM product for a workspace before managing contacts."
      }) as never
    );
  }
  try {
    const payload = updateContactInputSchema.parse({
      name: String(formData.get("name") ?? ""),
      email: coerceString(formData.get("email")),
      title: coerceString(formData.get("title")),
      companyId: String(formData.get("companyId") ?? ""),
    });
    await createResourceClient(createServerApiClient()).update(
      organizationId,
      contactId,
      payload
    );
    const nextPath = buildResourcePath("/crm/contacts", contactId, organizationId, projectId, listQuery, { includeCursor: true });
    const listPath = "/crm/contacts" + buildWorkspaceSuffix(organizationId, projectId, listQuery);
    revalidatePath(nextPath);
    revalidatePath(listPath);
    redirect(nextPath as never);
  } catch (error) {
    const validationState = getValidationState(error, "Unable to save changes right now.");
    redirect(
      buildFailurePath(buildResourceEditPath("/crm/contacts", contactId), organizationId, projectId, listQuery, {
        draftValues: buildDraftValues(formData),
        feedback: validationState.feedback,
        fieldErrors: validationState.fieldErrors
      }) as never
    );
  }
}

export async function archiveContactWorkspaceAction(formData: FormData) {
  "use server";

  const contactId = String(formData.get("contactId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));
  const listQuery = readListQueryFromFormData(formData);

  if (!organizationId.trim()) {
    return redirect(
      buildFailurePath(buildResourcePath("/crm/contacts", contactId, "", projectId, listQuery), "", projectId, listQuery, {
        feedback: "Enable the CRM product for a workspace before managing contacts."
      }) as never
    );
  }

  try {
    await createResourceClient(createServerApiClient()).archive(
      organizationId,
      contactId
    );

    const listPath = "/crm/contacts" + buildWorkspaceSuffix(organizationId, projectId, listQuery);
    const detailPath = buildResourcePath(
      "/crm/contacts",
      contactId,
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
      buildFailurePath(buildResourcePath("/crm/contacts", contactId, organizationId, projectId, listQuery), organizationId, projectId, listQuery, {
        feedback: validationState.feedback,
        fieldErrors: validationState.fieldErrors
      }) as never
    );
  }
}

export async function unarchiveContactWorkspaceAction(formData: FormData) {
  "use server";

  const contactId = String(formData.get("contactId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));
  const listQuery = readListQueryFromFormData(formData);

  if (!organizationId.trim()) {
    return redirect(
      buildFailurePath(buildResourcePath("/crm/contacts", contactId, "", projectId, listQuery), "", projectId, listQuery, {
        feedback: "Enable the CRM product for a workspace before managing contacts."
      }) as never
    );
  }

  try {
    await createResourceClient(createServerApiClient()).unarchive(
      organizationId,
      contactId
    );

    const listPath = "/crm/contacts" + buildWorkspaceSuffix(organizationId, projectId, { ...listQuery, archived: listQuery.archived === "only" ? "exclude" : listQuery.archived });
    revalidatePath(listPath);
    redirect(buildResourcePath("/crm/contacts", contactId, organizationId, projectId, { ...listQuery, archived: "exclude" }) as never);
  } catch (error) {
    const validationState = getValidationState(error, "Unable to restore this record right now.");
    redirect(
      buildFailurePath(buildResourcePath("/crm/contacts", contactId, organizationId, projectId, listQuery), organizationId, projectId, listQuery, {
        feedback: validationState.feedback,
        fieldErrors: validationState.fieldErrors
      }) as never
    );
  }
}
type ContactRelationPresentation = {
  href?: string;
  label: string;
};
type ContactRelationPresentations = Record<
  string,
  Partial<Record<string, ContactRelationPresentation>>
>;
type ContactFormFieldErrors = Partial<Record<keyof ContactRecord, string>>;
type ContactFormOption = {
  label: string;
  value: string;
};
type ContactFormOptions = Partial<
  Record<keyof ContactRecord, readonly ContactFormOption[]>
>;
async function resolveContactFormOptions(input: {
  organizationId?: string;
  projectId?: string;
  workspace: ReturnType<typeof resolveWorkspaceContext>;
}): Promise<ContactFormOptions> {
  const options: ContactFormOptions = {};
  if (input.organizationId) {
    const companyIdResponse = await createCompanyResourceClient(createServerApiClient()).list(
      input.organizationId,
      {
        archived: "exclude",
        sortBy: "createdAt",
        sortDirection: "desc",
        limit: 100
      }
    );
  
    options.companyId = companyIdResponse.items.map((record) => ({
      label: record.name?.toString() ?? record.id,
      value: record.id
    }));
  }
  
  return options;
}
async function resolveContactRelationPresentations(input: {
  items: readonly ContactRecord[];
  organizationId?: string;
  projectId?: string;
  workspace: ReturnType<typeof resolveWorkspaceContext>;
}): Promise<ContactRelationPresentations> {
  const presentations: ContactRelationPresentations = {};
  if (input.items.length === 0) {
    return presentations;
  }
  for (const item of input.items) {
    presentations[item.id] = {};
  }
  if (input.organizationId) {
    const organizationId = input.organizationId;
    const companyIdClient = createCompanyResourceClient(createServerApiClient());
    const companyIdIds = Array.from(
      new Set(
        input.items
          .map((item) => item.companyId)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      )
    );
    const companyIdPresentations = new Map<string, { href?: string; label: string }>();
  
    await Promise.all(
      companyIdIds.map(async (id) => {
        try {
          const record = await companyIdClient.get(organizationId, id);
          companyIdPresentations.set(id, {
            href: buildResourcePath("/crm/companies", record.id, organizationId, input.projectId),
            label: record.name?.toString() ?? record.id
          });
        } catch {
          companyIdPresentations.set(id, { label: id });
        }
      })
    );
  
    for (const item of input.items) {
      if (item.companyId) {
        presentations[item.id].companyId =
          companyIdPresentations.get(item.companyId) ?? { label: item.companyId };
      }
    }
  }
  
  return compactRelationPresentations(presentations);
}
function compactRelationPresentations(
  presentations: ContactRelationPresentations
): ContactRelationPresentations {
  return Object.fromEntries(
    Object.entries(presentations).map(([recordId, value]) => [
      recordId,
      Object.fromEntries(
        Object.entries(value).filter(([, relation]) => relation !== undefined)
      )
    ])
  ) as ContactRelationPresentations;
}
type ContactListQuery = {
  archived: "exclude" | "include" | "only";
  cursor?: string;
  limit?: number;
  query?: string;
  sortBy: "createdAt" | "updatedAt" | "name";
  sortDirection: "asc" | "desc";
  companyId?: string;
};
function buildWorkspaceSuffix(
  organizationId: string,
  projectId: string | undefined,
  query: ContactListQuery,
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
function buildResourcePath(
  basePath: string,
  id: string,
  organizationId: string,
  projectId?: string,
  query?: ContactListQuery,
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
  query: ContactListQuery,
  input: {
    draftValues?: Record<string, string | undefined>;
    feedback: string;
    fieldErrors?: ContactFormFieldErrors;
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
    companyId: query.companyId,
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
    email: getSearchValue(searchParams.error_email) ?? undefined,
    title: getSearchValue(searchParams.error_title) ?? undefined,
    companyId: getSearchValue(searchParams.error_companyId) ?? undefined,
  }) as ContactFormFieldErrors;
}
function readDefaultListQuery(): ContactListQuery {
  return {
    archived: "exclude",
    cursor: undefined,
    limit: undefined,
    query: undefined,
    sortBy: "createdAt",
    sortDirection: "desc",
    companyId: undefined,
  };
}
function readListQuery(searchParams: Record<string, string | string[] | undefined>): ContactListQuery {
  return {
    archived: readArchivedFilter(searchParams),
    cursor: getSearchValue(searchParams.cursor) ?? undefined,
    limit: readPositiveInteger(getSearchValue(searchParams.limit)),
    query: getSearchValue(searchParams.query) ?? undefined,
    sortBy: readAllowedValue(getSearchValue(searchParams.sortBy), ["createdAt", "updatedAt", "name"]) ?? "createdAt",
    sortDirection: readAllowedValue(getSearchValue(searchParams.sortDirection), ["asc", "desc"]) ?? "desc",
    companyId: getSearchValue(searchParams.companyId) ?? undefined,
  };
}
function readListQueryFromFormData(formData: FormData): ContactListQuery {
  return {
    archived: readArchivedFilterFromFormData(formData),
    cursor: undefined,
    limit: readPositiveInteger(coerceString(formData.get("list_limit"))),
    query: coerceString(formData.get("list_query")),
    sortBy: readAllowedValue(coerceString(formData.get("list_sortBy")), ["createdAt", "updatedAt", "name"]) ?? "createdAt",
    sortDirection: readAllowedValue(coerceString(formData.get("list_sortDirection")), ["asc", "desc"]) ?? "desc",
    companyId: coerceString(formData.get("list_companyId")),
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
    email: getSearchValue(searchParams.draft_email) ?? undefined,
    title: getSearchValue(searchParams.draft_title) ?? undefined,
    companyId: getSearchValue(searchParams.draft_companyId) ?? undefined,
  });
}
function buildDraftValues(formData: FormData) {
  return {
    name: coerceString(formData.get("name")),
    email: coerceString(formData.get("email")),
    title: coerceString(formData.get("title")),
    companyId: coerceString(formData.get("companyId")),
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
    const fieldErrors = compactFieldErrors(firstFieldErrors) as ContactFormFieldErrors;
    const issue = error.issues[0];
    return {
      feedback: issue?.message ?? fallback,
      fieldErrors
    };
  }
  if (error instanceof Error && error.message.length > 0) {
    return {
      feedback: error.message,
      fieldErrors: {} as ContactFormFieldErrors
    };
  }
  return {
    feedback: fallback,
    fieldErrors: {} as ContactFormFieldErrors
  };
}
