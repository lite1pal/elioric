import type { ApiClient } from "@/src/lib/api/api-client";
import { todoRecordSchema } from "@/src/features/todo/domain/schemas";
import { z } from "zod";
const todoPageInfoSchema = z.object({
  hasMore: z.boolean(),
  nextCursor: z.string().nullable()
});
const todoListResponseSchema = z.object({
  items: z.array(todoRecordSchema),
  pageInfo: todoPageInfoSchema
});
export function createResourceClient(apiClient: ApiClient) {
  return {
    async create(organizationId: string, body: Record<string, unknown>) {
      return todoRecordSchema.parse(
        await apiClient.request({
          body,
          method: "POST",
          path: `/api/v1/organizations/${organizationId}/todos` as never
        })
      );
    },
    async get(organizationId: string, id: string) {
      return todoRecordSchema.parse(
        await apiClient.request({
          path: `/api/v1/organizations/${organizationId}/todos/${id}` as never
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
sortBy?: "createdAt" | "updatedAt" | "title";
sortDirection?: "asc" | "desc";
    status?: "todo" | "done";
      }
    ) {
      return todoListResponseSchema.parse(
        await apiClient.request({
          path: `/api/v1/organizations/${organizationId}/todos${buildListQuery(options)}` as never
        })
      );
    },
    async update(organizationId: string, id: string, body: Record<string, unknown>) {
      return todoRecordSchema.parse(
        await apiClient.request({
          body,
          method: "PATCH",
          path: `/api/v1/organizations/${organizationId}/todos/${id}` as never
        })
      );
    },
    async archive(organizationId: string, id: string) {
      return todoRecordSchema.parse(
        await apiClient.request({
          method: "POST",
          path: `/api/v1/organizations/${organizationId}/todos/${id}/archive` as never
        })
      );
    },
    async unarchive(organizationId: string, id: string) {
      return todoRecordSchema.parse(
        await apiClient.request({
          method: "POST",
          path: `/api/v1/organizations/${organizationId}/todos/${id}/unarchive` as never
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
sortBy?: "createdAt" | "updatedAt" | "title";
sortDirection?: "asc" | "desc";
    status?: "todo" | "done";
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({
    archived: options?.archived,
    cursor: options?.cursor,
    limit: options?.limit,
    query: options?.query,
    sortBy: options?.sortBy,
    sortDirection: options?.sortDirection,
    status: options?.status,
  })) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    query.set(key, String(value));
  }
  const queryString = query.toString();
  return queryString.length > 0 ? `?${queryString}` : "";
}
