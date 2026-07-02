import { z } from "zod";

export const dealFieldSchema = z.object({
  name: z.string().trim().min(1),
  stage: z.enum(["lead", "qualified", "proposal", "won", "lost"]),
  amount: z.string().trim().min(1).optional(),
  companyId: z.string().uuid(),
  ownerId: z.string().uuid().optional()
});

export const dealRecordSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().trim().min(1),
  stage: z.enum(["lead", "qualified", "proposal", "won", "lost"]),
  amount: z.string().trim().min(1).optional(),
  companyId: z.string().uuid(),
  ownerId: z.string().uuid().optional(),
  archivedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createDealInputSchema = z.object({
  name: z.string().trim().min(1),
  stage: z.enum(["lead", "qualified", "proposal", "won", "lost"]),
  amount: z.string().trim().min(1).optional(),
  companyId: z.string().uuid(),
  ownerId: z.string().uuid().optional()
});

export const updateDealInputSchema = z.object({
  name: z.string().trim().min(1).optional(),
  stage: z.enum(["lead", "qualified", "proposal", "won", "lost"]).optional(),
  amount: z.string().trim().min(1).optional(),
  companyId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional()
});
export const dealWorkflowStateSchema = z.enum(["lead", "qualified", "proposal", "won", "lost"]);

export const dealWorkflow = {
  field: "stage",
  initial: "lead",
  transitions: {
  "lead": [
    "qualified",
    "lost"
  ],
  "qualified": [
    "proposal",
    "lost"
  ],
  "proposal": [
    "won",
    "lost"
  ],
  "won": [],
  "lost": []
}
} as const;

export function assertDealWorkflowCreateState(state: DealWorkflowState) {
  if (state !== dealWorkflow.initial) {
    throw new Error(`invalid_workflow_transition:New Deal records must start in ${dealWorkflow.initial}.`);
  }
}

export function assertDealWorkflowTransition(input: {
  from: DealWorkflowState;
  to: DealWorkflowState;
}) {
  if (input.from === input.to) {
    return;
  }

  const allowedTransitions = dealWorkflow.transitions[input.from] as readonly DealWorkflowState[] | undefined;

  if (!allowedTransitions?.includes(input.to)) {
    throw new Error(`invalid_workflow_transition:Cannot move stage from ${input.from} to ${input.to}.`);
  }
}

export const dealPageInfoSchema = z.object({
  hasMore: z.boolean(),
  nextCursor: z.string().nullable()
});

export const listDealsInputSchema = z.object({
  archived: z.enum(["exclude", "include", "only"]).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.number().int().positive().max(100).optional(),
  query: z.string().trim().min(1).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "name"]).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
  stage: z.enum(["lead", "qualified", "proposal", "won", "lost"]).optional(),
  companyId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional()
});

export const listDealsResponseSchema = z.object({
  items: z.array(dealRecordSchema),
  pageInfo: dealPageInfoSchema
});

export type DealRecord = z.infer<typeof dealRecordSchema>;
export type DealWorkflowState = z.infer<typeof dealWorkflowStateSchema>;
export type DealPageInfo = z.infer<typeof dealPageInfoSchema>;
export type CreateDealInput = z.infer<typeof createDealInputSchema>;
export type UpdateDealInput = z.infer<typeof updateDealInputSchema>;
export type ListDealsInput = z.infer<typeof listDealsInputSchema>;
export type ListDealsResponse = z.infer<typeof listDealsResponseSchema>;
