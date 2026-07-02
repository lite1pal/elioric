import { z } from "zod";

export const contactRecordSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().trim().min(1),
  email: z.string().email().optional(),
  title: z.string().trim().min(1).optional(),
  companyId: z.string().uuid(),
  archivedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type ContactRecord = z.infer<typeof contactRecordSchema>;
