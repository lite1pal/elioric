import { z } from "zod";

export const todoFieldSchema = z.object({
  title: z.string().trim().min(1),
  details: z.string().trim().min(1).optional(),
  status: z.enum(["todo", "done"]),
  dueAt: z.string().datetime().optional()
});

export const todoRecordSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  title: z.string().trim().min(1),
  details: z.string().trim().min(1).optional(),
  status: z.enum(["todo", "done"]),
  dueAt: z.string().datetime().optional(),
  archivedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createTodoInputSchema = z.object({
  title: z.string().trim().min(1),
  details: z.string().trim().min(1).optional(),
  status: z.enum(["todo", "done"]),
  dueAt: z.string().datetime().optional()
});

export const updateTodoInputSchema = z.object({
  title: z.string().trim().min(1).optional(),
  details: z.string().trim().min(1).optional(),
  status: z.enum(["todo", "done"]).optional(),
  dueAt: z.string().datetime().optional()
});
export const todoWorkflowStateSchema = z.enum(["todo", "done"]);

export const todoWorkflow = {
  field: "status",
  initial: "todo",
  transitions: {
  "todo": [
    "done"
  ],
  "done": []
}
} as const;

export function assertTodoWorkflowCreateState(state: TodoWorkflowState) {
  if (state !== todoWorkflow.initial) {
    throw new Error(`invalid_workflow_transition:New Todo records must start in ${todoWorkflow.initial}.`);
  }
}

export function assertTodoWorkflowTransition(input: {
  from: TodoWorkflowState;
  to: TodoWorkflowState;
}) {
  if (input.from === input.to) {
    return;
  }

  const allowedTransitions = todoWorkflow.transitions[input.from] as readonly TodoWorkflowState[] | undefined;

  if (!allowedTransitions?.includes(input.to)) {
    throw new Error(`invalid_workflow_transition:Cannot move status from ${input.from} to ${input.to}.`);
  }
}

export const todoPageInfoSchema = z.object({
  hasMore: z.boolean(),
  nextCursor: z.string().nullable()
});

export const listTodosInputSchema = z.object({
  archived: z.enum(["exclude", "include", "only"]).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.number().int().positive().max(100).optional(),
  query: z.string().trim().min(1).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "title"]).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(["todo", "done"]).optional()
});

export const listTodosResponseSchema = z.object({
  items: z.array(todoRecordSchema),
  pageInfo: todoPageInfoSchema
});

export type TodoRecord = z.infer<typeof todoRecordSchema>;
export type TodoWorkflowState = z.infer<typeof todoWorkflowStateSchema>;
export type TodoPageInfo = z.infer<typeof todoPageInfoSchema>;
export type CreateTodoInput = z.infer<typeof createTodoInputSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoInputSchema>;
export type ListTodosInput = z.infer<typeof listTodosInputSchema>;
export type ListTodosResponse = z.infer<typeof listTodosResponseSchema>;
