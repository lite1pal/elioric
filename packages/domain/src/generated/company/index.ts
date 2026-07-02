import { z } from "zod";

export const companyFieldSchema = z.object({
  name: z.string().trim().min(1),
  domain: z.string().trim().min(1).optional(),
  status: z.enum(["lead", "customer", "inactive"])
});

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

export const createCompanyInputSchema = z.object({
  name: z.string().trim().min(1),
  domain: z.string().trim().min(1).optional(),
  status: z.enum(["lead", "customer", "inactive"])
});

export const updateCompanyInputSchema = z.object({
  name: z.string().trim().min(1).optional(),
  domain: z.string().trim().min(1).optional(),
  status: z.enum(["lead", "customer", "inactive"]).optional()
});

export const companyPageInfoSchema = z.object({
  hasMore: z.boolean(),
  nextCursor: z.string().nullable()
});

export const listCompaniesInputSchema = z.object({
  archived: z.enum(["exclude", "include", "only"]).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.number().int().positive().max(100).optional(),
  query: z.string().trim().min(1).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "name"]).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(["lead", "customer", "inactive"]).optional()
});

export const listCompaniesResponseSchema = z.object({
  items: z.array(companyRecordSchema),
  pageInfo: companyPageInfoSchema
});

export type CompanyRecord = z.infer<typeof companyRecordSchema>;
export type CompanyPageInfo = z.infer<typeof companyPageInfoSchema>;
export type CreateCompanyInput = z.infer<typeof createCompanyInputSchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanyInputSchema>;
export type ListCompaniesInput = z.infer<typeof listCompaniesInputSchema>;
export type ListCompaniesResponse = z.infer<typeof listCompaniesResponseSchema>;
