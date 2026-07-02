import type { ApiClient } from "@/src/lib/api/api-client";
import { taskRecordSchema } from "@/src/features/task/domain/schemas";
import { z } from "zod";
const taskPageInfoSchema = z.object({
  hasMore: z.boolean(),
  nextCursor: z.string().nullable()
});
const taskListResponseSchema = z.object({
  items: z.array(taskRecordSchema),
  pageInfo: taskPageInfoSchema
});
export function createResourceClient(apiClient: ApiClient) {
  return {
    async create(organizationId: string, body: Record<string, unknown>) {
      return taskRecordSchema.parse(
        await apiClient.request({
          body,
          method: "POST",
          path: `/api/v1/organizations/${organizationId}/tasks` as never
        })
      );
    },
    async get(organizationId: string, id: string) {
      return taskRecordSchema.parse(
        await apiClient.request({
          path: `/api/v1/organizations/${organizationId}/tasks/${id}` as never
        })
      );
    },
    async list(
      organizationId: string,
      options?: {
cursor?: string;
limit?: number;
query?: string;
sortBy?: "createdAt" | "updatedAt";
sortDirection?: "asc" | "desc";
      }
    ) {
      return taskListResponseSchema.parse(
        await apiClient.request({
          path: `/api/v1/organizations/${organizationId}/tasks${buildListQuery(options)}` as never
        })
      );
    },
    async update(organizationId: string, id: string, body: Record<string, unknown>) {
      return taskRecordSchema.parse(
        await apiClient.request({
          body,
          method: "PATCH",
          path: `/api/v1/organizations/${organizationId}/tasks/${id}` as never
        })
      );
    },
  };
}
function buildListQuery(options?: {
cursor?: string;
limit?: number;
query?: string;
sortBy?: "createdAt" | "updatedAt";
sortDirection?: "asc" | "desc";
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({
    cursor: options?.cursor,
    limit: options?.limit,
    query: options?.query,
    sortBy: options?.sortBy,
    sortDirection: options?.sortDirection,
  })) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    query.set(key, String(value));
  }
  const queryString = query.toString();
  return queryString.length > 0 ? `?${queryString}` : "";
}
