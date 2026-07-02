import { z } from "zod";

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

export type DealRecord = z.infer<typeof dealRecordSchema>;
