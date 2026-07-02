import { createDealInputSchema, listDealsInputSchema, updateDealInputSchema, assertDealWorkflowCreateState, assertDealWorkflowTransition, type CreateDealInput, type ListDealsInput, type UpdateDealInput } from "@auditrail/domain/generated/deal";
import type { DealRepo } from "./repo.js";
export function createDealService(repo: DealRepo) {
  return {
    async archive(input: { id: string; organizationId: string }) {
      return repo.archive(input);
    },
    async create(input: { data: CreateDealInput; organizationId: string }) {
      const data = createDealInputSchema.parse(input.data);
      assertDealWorkflowCreateState(data.stage);
      return repo.create({
        data,
        organizationId: input.organizationId
      });
    },
    async get(input: { id: string; organizationId: string }) {
      return repo.findById(input);
    },
    async list(input: { organizationId: string; filters: ListDealsInput }) {
      return repo.list({
        filters: listDealsInputSchema.parse(input.filters),
        organizationId: input.organizationId
      });
    },
    async unarchive(input: { id: string; organizationId: string }) {
      return repo.unarchive(input);
    },
    async update(input: { data: UpdateDealInput; id: string; organizationId: string }) {
      const data = updateDealInputSchema.parse(input.data);
      const current = await repo.findById({
        id: input.id,
        organizationId: input.organizationId
      });

      if (!current) {
        return undefined;
      }

      const nextWorkflowState = data.stage;

      if (nextWorkflowState !== undefined) {
        assertDealWorkflowTransition({
          from: current.stage,
          to: nextWorkflowState
        });
      }
      return repo.update({
        data,
        id: input.id,
        organizationId: input.organizationId
      });
    }
  };
}
