import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createDealInputSchema, updateDealInputSchema } from "@auditrail/domain/generated/deal";
import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";
import type { DealRecord } from "@/src/features/deal/domain/schemas";
import { createServerApiClient } from "@/src/lib/api/server-api-client";
import { resolveWorkspaceContext } from "@/src/features/organizations/domain/workspace";
import { createResourceClient } from "@/src/features/deal/api/deal-client";
import { createResourceClient as createCompanyResourceClient } from "@/src/features/company/api/company-client";
export async function loadDealWorkspacePage(
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
  const relationPresentations = await resolveDealRelationPresentations({
    items: listResponse.items,
    organizationId: workspace.activeOrganizationId,
    projectId: workspace.activeProjectId,
    workspace
  });
  return {
    draftValues: readDraftValues(searchParams),
    feedback: readFeedback(searchParams),
    items: listResponse.items,
    listQuery,
    pageInfo: listResponse.pageInfo,
    relationPresentations,
    workspace
  };
}
export async function loadDealWorkspaceDetailPage(
  input: {
    dealId: string;
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
        input.dealId
      )
    : null;
  const relationPresentations = item
    ? await resolveDealRelationPresentations({
        items: [item],
        organizationId: workspace.activeOrganizationId,
        projectId: workspace.activeProjectId,
        workspace
      })
    : {};
  return {
    draftValues: readDraftValues(input.searchParams),
    feedback: readFeedback(input.searchParams),
    item,
    listQuery,
    relationPresentations,
    workspace
  };
}
export async function createDealWorkspaceAction(formData: FormData) {
  "use server";
  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));
  const listQuery = readListQueryFromFormData(formData);
  try {
    const payload = createDealInputSchema.parse({
      name: String(formData.get("name") ?? ""),
      stage: String(formData.get("stage") ?? ""),
      amount: coerceString(formData.get("amount")),
      companyId: String(formData.get("companyId") ?? ""),
      ownerId: coerceString(formData.get("ownerId")),
    });
    await createResourceClient(createServerApiClient()).create(
      organizationId,
      payload
    );
    const nextPath = "/crm/deals" + buildWorkspaceSuffix(organizationId, projectId, listQuery);
    revalidatePath(nextPath);
    redirect(nextPath as never);
  } catch (error) {
    redirect(
      buildFailurePath("/crm/deals", organizationId, projectId, listQuery, {
        draftValues: buildDraftValues(formData),
        feedback: getFeedbackMessage(error, "Unable to create this record right now.")
      }) as never
    );
  }
}
export async function updateDealWorkspaceAction(formData: FormData) {
  "use server";
  const dealId = String(formData.get("dealId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));
  const listQuery = readListQueryFromFormData(formData);
  try {
    const payload = updateDealInputSchema.parse({
      name: String(formData.get("name") ?? ""),
      stage: String(formData.get("stage") ?? ""),
      amount: coerceString(formData.get("amount")),
      companyId: String(formData.get("companyId") ?? ""),
      ownerId: coerceString(formData.get("ownerId")),
    });
    await createResourceClient(createServerApiClient()).update(
      organizationId,
      dealId,
      payload
    );
    const nextPath = buildResourcePath("/crm/deals", dealId, organizationId, projectId, listQuery, { includeCursor: true });
    const listPath = "/crm/deals" + buildWorkspaceSuffix(organizationId, projectId, listQuery);
    revalidatePath(nextPath);
    revalidatePath(listPath);
    redirect(nextPath as never);
  } catch (error) {
    redirect(
      buildFailurePath(buildResourceEditPath("/crm/deals", dealId), organizationId, projectId, listQuery, {
        draftValues: buildDraftValues(formData),
        feedback: getFeedbackMessage(error, "Unable to save changes right now.")
      }) as never
    );
  }
}

export async function archiveDealWorkspaceAction(formData: FormData) {
  "use server";

  const dealId = String(formData.get("dealId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));
  const listQuery = readListQueryFromFormData(formData);

  try {
    await createResourceClient(createServerApiClient()).archive(
      organizationId,
      dealId
    );

    const listPath = "/crm/deals" + buildWorkspaceSuffix(organizationId, projectId, listQuery);
    const detailPath = buildResourcePath(
      "/crm/deals",
      dealId,
      organizationId,
      projectId,
      { ...listQuery, archived: listQuery.archived === "only" ? "only" : "exclude" }
    );
    revalidatePath(listPath);
    revalidatePath(detailPath);
    redirect(listPath as never);
  } catch (error) {
    redirect(
      buildFailurePath(buildResourcePath("/crm/deals", dealId, organizationId, projectId, listQuery), organizationId, projectId, listQuery, {
        feedback: getFeedbackMessage(error, "Unable to archive this record right now.")
      }) as never
    );
  }
}

export async function unarchiveDealWorkspaceAction(formData: FormData) {
  "use server";

  const dealId = String(formData.get("dealId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const projectId = coerceString(formData.get("projectId"));
  const listQuery = readListQueryFromFormData(formData);

  try {
    await createResourceClient(createServerApiClient()).unarchive(
      organizationId,
      dealId
    );

    const listPath = "/crm/deals" + buildWorkspaceSuffix(organizationId, projectId, { ...listQuery, archived: listQuery.archived === "only" ? "exclude" : listQuery.archived });
    revalidatePath(listPath);
    redirect(buildResourcePath("/crm/deals", dealId, organizationId, projectId, { ...listQuery, archived: "exclude" }) as never);
  } catch (error) {
    redirect(
      buildFailurePath(buildResourcePath("/crm/deals", dealId, organizationId, projectId, listQuery), organizationId, projectId, listQuery, {
        feedback: getFeedbackMessage(error, "Unable to restore this record right now.")
      }) as never
    );
  }
}
type DealRelationPresentation = {
  href?: string;
  label: string;
};
type DealRelationPresentations = Record<
  string,
  Partial<Record<string, DealRelationPresentation>>
>;
async function resolveDealRelationPresentations(input: {
  items: readonly DealRecord[];
  organizationId?: string;
  projectId?: string;
  workspace: ReturnType<typeof resolveWorkspaceContext>;
}): Promise<DealRelationPresentations> {
  const presentations: DealRelationPresentations = {};
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
  presentations: DealRelationPresentations
): DealRelationPresentations {
  return Object.fromEntries(
    Object.entries(presentations).map(([recordId, value]) => [
      recordId,
      Object.fromEntries(
        Object.entries(value).filter(([, relation]) => relation !== undefined)
      )
    ])
  ) as DealRelationPresentations;
}
type DealListQuery = {
  archived: "exclude" | "include" | "only";
  cursor?: string;
  limit?: number;
  query?: string;
  sortBy: "createdAt" | "updatedAt" | "name";
  sortDirection: "asc" | "desc";
  stage?: "lead" | "qualified" | "proposal" | "won" | "lost";
  companyId?: string;
  ownerId?: string;
};
function buildWorkspaceSuffix(
  organizationId: string,
  projectId: string | undefined,
  query: DealListQuery,
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
function buildResourcePath(
  basePath: string,
  id: string,
  organizationId: string,
  projectId?: string,
  query?: DealListQuery,
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
  query: DealListQuery,
  input: {
    draftValues?: Record<string, string | undefined>;
    feedback: string;
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
  search.set("feedback", input.feedback);
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
function readDefaultListQuery(): DealListQuery {
  return {
    archived: "exclude",
    cursor: undefined,
    limit: undefined,
    query: undefined,
    sortBy: "createdAt",
    sortDirection: "desc",
    stage: undefined,
    companyId: undefined,
    ownerId: undefined,
  };
}
function readListQuery(searchParams: Record<string, string | string[] | undefined>): DealListQuery {
  return {
    archived: readArchivedFilter(searchParams),
    cursor: getSearchValue(searchParams.cursor) ?? undefined,
    limit: readPositiveInteger(getSearchValue(searchParams.limit)),
    query: getSearchValue(searchParams.query) ?? undefined,
    sortBy: readAllowedValue(getSearchValue(searchParams.sortBy), ["createdAt", "updatedAt", "name"]) ?? "createdAt",
    sortDirection: readAllowedValue(getSearchValue(searchParams.sortDirection), ["asc", "desc"]) ?? "desc",
    stage: readAllowedValue(getSearchValue(searchParams.stage), ["lead", "qualified", "proposal", "won", "lost"]) ?? undefined,
    companyId: getSearchValue(searchParams.companyId) ?? undefined,
    ownerId: getSearchValue(searchParams.ownerId) ?? undefined,
  };
}
function readListQueryFromFormData(formData: FormData): DealListQuery {
  return {
    archived: readArchivedFilterFromFormData(formData),
    cursor: undefined,
    limit: readPositiveInteger(coerceString(formData.get("list_limit"))),
    query: coerceString(formData.get("list_query")),
    sortBy: readAllowedValue(coerceString(formData.get("list_sortBy")), ["createdAt", "updatedAt", "name"]) ?? "createdAt",
    sortDirection: readAllowedValue(coerceString(formData.get("list_sortDirection")), ["asc", "desc"]) ?? "desc",
    stage: readAllowedValue(coerceString(formData.get("list_stage")), ["lead", "qualified", "proposal", "won", "lost"]) ?? undefined,
    companyId: coerceString(formData.get("list_companyId")),
    ownerId: coerceString(formData.get("list_ownerId")),
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
    stage: ["lead","qualified","proposal","won","lost"].includes(getSearchValue(searchParams.draft_stage) ?? "") ? (getSearchValue(searchParams.draft_stage) as "lead" | "qualified" | "proposal" | "won" | "lost") : undefined,
    amount: getSearchValue(searchParams.draft_amount) ?? undefined,
    companyId: getSearchValue(searchParams.draft_companyId) ?? undefined,
    ownerId: getSearchValue(searchParams.draft_ownerId) ?? undefined,
  });
}
function buildDraftValues(formData: FormData) {
  return {
    name: coerceString(formData.get("name")),
    stage: coerceString(formData.get("stage")),
    amount: coerceString(formData.get("amount")),
    companyId: coerceString(formData.get("companyId")),
    ownerId: coerceString(formData.get("ownerId")),
  };
}
function compactDraftValues<T extends Record<string, unknown>>(values: T) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
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
function getFeedbackMessage(error: unknown, fallback: string) {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return issue?.message ?? fallback;
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return fallback;
}
