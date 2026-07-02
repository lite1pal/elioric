import type { ApiClient } from "@/src/lib/api/api-client";
import { customerRecordSchema } from "@/src/features/customer/domain/schemas";
import { z } from "zod";
const customerPageInfoSchema = z.object({
  hasMore: z.boolean(),
  nextCursor: z.string().nullable()
});
const customerListResponseSchema = z.object({
  items: z.array(customerRecordSchema),
  pageInfo: customerPageInfoSchema
});
export function createResourceClient(apiClient: ApiClient) {
  return {
    async create(organizationId: string, body: Record<string, unknown>) {
      return customerRecordSchema.parse(
        await apiClient.request({
          body,
          method: "POST",
          path: `/api/v1/organizations/${organizationId}/customers` as never
        })
      );
    },
    async get(organizationId: string, id: string) {
      return customerRecordSchema.parse(
        await apiClient.request({
          path: `/api/v1/organizations/${organizationId}/customers/${id}` as never
        })
      );
    },
    async list(
      organizationId: string,
      options?: {
cursor?: string;
limit?: number;
query?: string;
sortBy?: "createdAt" | "updatedAt" | "email";
sortDirection?: "asc" | "desc";
      }
    ) {
      return customerListResponseSchema.parse(
        await apiClient.request({
          path: `/api/v1/organizations/${organizationId}/customers${buildListQuery(options)}` as never
        })
      );
    },
    async update(organizationId: string, id: string, body: Record<string, unknown>) {
      return customerRecordSchema.parse(
        await apiClient.request({
          body,
          method: "PATCH",
          path: `/api/v1/organizations/${organizationId}/customers/${id}` as never
        })
      );
    },
  };
}
function buildListQuery(options?: {
cursor?: string;
limit?: number;
query?: string;
sortBy?: "createdAt" | "updatedAt" | "email";
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
