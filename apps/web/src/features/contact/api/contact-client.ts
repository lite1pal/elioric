import type { ApiClient } from "@/src/lib/api/api-client";
import { contactRecordSchema } from "@/src/features/contact/domain/schemas";
import { z } from "zod";
const contactPageInfoSchema = z.object({
  hasMore: z.boolean(),
  nextCursor: z.string().nullable()
});
const contactListResponseSchema = z.object({
  items: z.array(contactRecordSchema),
  pageInfo: contactPageInfoSchema
});
export function createResourceClient(apiClient: ApiClient) {
  return {
    async create(organizationId: string, body: Record<string, unknown>) {
      return contactRecordSchema.parse(
        await apiClient.request({
          body,
          method: "POST",
          path: `/api/v1/organizations/${organizationId}/contacts` as never
        })
      );
    },
    async get(organizationId: string, id: string) {
      return contactRecordSchema.parse(
        await apiClient.request({
          path: `/api/v1/organizations/${organizationId}/contacts/${id}` as never
        })
      );
    },
    async list(
      organizationId: string,
      options?: {
archived?: "exclude" | "include" | "only";
cursor?: string;
limit?: number;
query?: string;
sortBy?: "createdAt" | "updatedAt" | "name";
sortDirection?: "asc" | "desc";
    companyId?: string;
      }
    ) {
      return contactListResponseSchema.parse(
        await apiClient.request({
          path: `/api/v1/organizations/${organizationId}/contacts${buildListQuery(options)}` as never
        })
      );
    },
    async update(organizationId: string, id: string, body: Record<string, unknown>) {
      return contactRecordSchema.parse(
        await apiClient.request({
          body,
          method: "PATCH",
          path: `/api/v1/organizations/${organizationId}/contacts/${id}` as never
        })
      );
    },
    async archive(organizationId: string, id: string) {
      return contactRecordSchema.parse(
        await apiClient.request({
          method: "POST",
          path: `/api/v1/organizations/${organizationId}/contacts/${id}/archive` as never
        })
      );
    },
    async unarchive(organizationId: string, id: string) {
      return contactRecordSchema.parse(
        await apiClient.request({
          method: "POST",
          path: `/api/v1/organizations/${organizationId}/contacts/${id}/unarchive` as never
        })
      );
    }
  };
}
function buildListQuery(options?: {
archived?: "exclude" | "include" | "only";
cursor?: string;
limit?: number;
query?: string;
sortBy?: "createdAt" | "updatedAt" | "name";
sortDirection?: "asc" | "desc";
    companyId?: string;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({
    archived: options?.archived,
    cursor: options?.cursor,
    limit: options?.limit,
    query: options?.query,
    sortBy: options?.sortBy,
    sortDirection: options?.sortDirection,
    companyId: options?.companyId,
  })) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    query.set(key, String(value));
  }
  const queryString = query.toString();
  return queryString.length > 0 ? `?${queryString}` : "";
}
