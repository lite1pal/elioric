import { z } from "zod";

export const noteRecordSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  body: z.string().trim().min(1),
  dealId: z.string().uuid(),
  archivedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type NoteRecord = z.infer<typeof noteRecordSchema>;
