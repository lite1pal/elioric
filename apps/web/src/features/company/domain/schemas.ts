import { z } from "zod";

export const companyRecordSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().trim().min(1),
  domain: z.string().trim().min(1).optional(),
  status: z.enum(["lead", "customer", "inactive"]),
  archivedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type CompanyRecord = z.infer<typeof companyRecordSchema>;
