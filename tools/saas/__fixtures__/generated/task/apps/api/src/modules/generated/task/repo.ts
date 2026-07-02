import type { CreateTaskInput, TaskRecord, ListTasksInput, ListTasksResponse, UpdateTaskInput } from "@auditrail/domain/generated/task";
export interface TaskRepo {
  create(input: { organizationId: string; data: CreateTaskInput }): Promise<TaskRecord>;
  findById(input: { id: string; organizationId: string }): Promise<TaskRecord | undefined>;
  list(input: { organizationId: string; filters: ListTasksInput }): Promise<ListTasksResponse>;
  update(input: { id: string; organizationId: string; data: UpdateTaskInput }): Promise<TaskRecord | undefined>;
}
