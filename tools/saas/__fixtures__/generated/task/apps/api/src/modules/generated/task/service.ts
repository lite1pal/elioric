import { createTaskInputSchema, listTasksInputSchema, updateTaskInputSchema, type CreateTaskInput, type UpdateTaskInput } from "@auditrail/domain/generated/task";
import type { TaskRepo } from "./repo.js";
export function createTaskService(repo: TaskRepo) {
  return {
    async create(input: { data: CreateTaskInput; organizationId: string }) {
      const data = createTaskInputSchema.parse(input.data);
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
        filters: listTasksInputSchema.parse({
          cursor: input.cursor,
          limit: input.limit,
          query: input.query
        }),
        organizationId: input.organizationId
      });
    },
    async update(input: { data: UpdateTaskInput; id: string; organizationId: string }) {
      const data = updateTaskInputSchema.parse(input.data);
      return repo.update({
        data,
        id: input.id,
        organizationId: input.organizationId
      });
    }
  };
}
