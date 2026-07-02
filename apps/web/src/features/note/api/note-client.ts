import type { ApiClient } from "@/src/lib/api/api-client";
import { noteRecordSchema } from "@/src/features/note/domain/schemas";
import { z } from "zod";
const notePageInfoSchema = z.object({
  hasMore: z.boolean(),
  nextCursor: z.string().nullable()
});
const noteListResponseSchema = z.object({
  items: z.array(noteRecordSchema),
  pageInfo: notePageInfoSchema
});
export function createResourceClient(apiClient: ApiClient) {
  return {
    async create(organizationId: string, body: Record<string, unknown>) {
      return noteRecordSchema.parse(
        await apiClient.request({
          body,
          method: "POST",
          path: `/api/v1/organizations/${organizationId}/notes` as never
        })
      );
    },
    async get(organizationId: string, id: string) {
      return noteRecordSchema.parse(
        await apiClient.request({
          path: `/api/v1/organizations/${organizationId}/notes/${id}` as never
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
sortBy?: "createdAt" | "updatedAt";
sortDirection?: "asc" | "desc";
    dealId?: string;
      }
    ) {
      return noteListResponseSchema.parse(
        await apiClient.request({
          path: `/api/v1/organizations/${organizationId}/notes${buildListQuery(options)}` as never
        })
      );
    },
    async update(organizationId: string, id: string, body: Record<string, unknown>) {
      return noteRecordSchema.parse(
        await apiClient.request({
          body,
          method: "PATCH",
          path: `/api/v1/organizations/${organizationId}/notes/${id}` as never
        })
      );
    },
    async archive(organizationId: string, id: string) {
      return noteRecordSchema.parse(
        await apiClient.request({
          method: "POST",
          path: `/api/v1/organizations/${organizationId}/notes/${id}/archive` as never
        })
      );
    },
    async unarchive(organizationId: string, id: string) {
      return noteRecordSchema.parse(
        await apiClient.request({
          method: "POST",
          path: `/api/v1/organizations/${organizationId}/notes/${id}/unarchive` as never
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
sortBy?: "createdAt" | "updatedAt";
sortDirection?: "asc" | "desc";
    dealId?: string;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({
    archived: options?.archived,
    cursor: options?.cursor,
    limit: options?.limit,
    query: options?.query,
    sortBy: options?.sortBy,
    sortDirection: options?.sortDirection,
    dealId: options?.dealId,
  })) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    query.set(key, String(value));
  }
  const queryString = query.toString();
  return queryString.length > 0 ? `?${queryString}` : "";
}
