import type { CreateTodoInput, TodoRecord, ListTodosInput, ListTodosResponse, UpdateTodoInput } from "@auditrail/domain/generated/todo";
export interface TodoRepo {
  archive(input: { id: string; organizationId: string }): Promise<TodoRecord | undefined>;
  create(input: { organizationId: string; data: CreateTodoInput }): Promise<TodoRecord>;
  findById(input: { id: string; organizationId: string }): Promise<TodoRecord | undefined>;
  list(input: { organizationId: string; filters: ListTodosInput }): Promise<ListTodosResponse>;
  unarchive(input: { id: string; organizationId: string }): Promise<TodoRecord | undefined>;
  update(input: { id: string; organizationId: string; data: UpdateTodoInput }): Promise<TodoRecord | undefined>;
}
