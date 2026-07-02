import { createTodoInputSchema, listTodosInputSchema, updateTodoInputSchema, assertTodoWorkflowCreateState, assertTodoWorkflowTransition, type CreateTodoInput, type ListTodosInput, type UpdateTodoInput } from "@auditrail/domain/generated/todo";
import type { TodoRepo } from "./repo.js";
export function createTodoService(repo: TodoRepo) {
  return {
    async archive(input: { id: string; organizationId: string }) {
      return repo.archive(input);
    },
    async create(input: { data: CreateTodoInput; organizationId: string }) {
      const data = createTodoInputSchema.parse(input.data);
      assertTodoWorkflowCreateState(data.status);
      return repo.create({
        data,
        organizationId: input.organizationId
      });
    },
    async get(input: { id: string; organizationId: string }) {
      return repo.findById(input);
    },
    async list(input: { organizationId: string; filters: ListTodosInput }) {
      return repo.list({
        filters: listTodosInputSchema.parse(input.filters),
        organizationId: input.organizationId
      });
    },
    async unarchive(input: { id: string; organizationId: string }) {
      return repo.unarchive(input);
    },
    async update(input: { data: UpdateTodoInput; id: string; organizationId: string }) {
      const data = updateTodoInputSchema.parse(input.data);
      const current = await repo.findById({
        id: input.id,
        organizationId: input.organizationId
      });

      if (!current) {
        return undefined;
      }

      const nextWorkflowState = data.status;

      if (nextWorkflowState !== undefined) {
        assertTodoWorkflowTransition({
          from: current.status,
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
