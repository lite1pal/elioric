import { createCustomerInputSchema, listCustomersInputSchema, updateCustomerInputSchema, type CreateCustomerInput, type UpdateCustomerInput } from "@auditrail/domain/generated/customer";
import type { CustomerRepo } from "./repo.js";
export function createCustomerService(repo: CustomerRepo) {
  return {
    async create(input: { data: CreateCustomerInput; organizationId: string }) {
      const data = createCustomerInputSchema.parse(input.data);
      return repo.create({
        data,
        organizationId: input.organizationId
      });
    },
    async get(input: { id: string; organizationId: string }) {
      return repo.findById(input);
    },
    async list(input: { organizationId: string; query?: string; limit?: number; cursor?: string }) {
      return repo.list({
        filters: listCustomersInputSchema.parse({
          cursor: input.cursor,
          limit: input.limit,
          query: input.query
        }),
        organizationId: input.organizationId
      });
    },
    async update(input: { data: UpdateCustomerInput; id: string; organizationId: string }) {
      const data = updateCustomerInputSchema.parse(input.data);
      return repo.update({
        data,
        id: input.id,
        organizationId: input.organizationId
      });
    }
  };
}
