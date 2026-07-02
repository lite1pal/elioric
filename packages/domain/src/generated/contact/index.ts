import { z } from "zod";

export const contactFieldSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email().optional(),
  title: z.string().trim().min(1).optional(),
  companyId: z.string().uuid()
});

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

export const createContactInputSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email().optional(),
  title: z.string().trim().min(1).optional(),
  companyId: z.string().uuid()
});

export const updateContactInputSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  title: z.string().trim().min(1).optional(),
  companyId: z.string().uuid().optional()
});

export const contactPageInfoSchema = z.object({
  hasMore: z.boolean(),
  nextCursor: z.string().nullable()
});

export const listContactsInputSchema = z.object({
  archived: z.enum(["exclude", "include", "only"]).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.number().int().positive().max(100).optional(),
  query: z.string().trim().min(1).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "name"]).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
  companyId: z.string().uuid().optional()
});

export const listContactsResponseSchema = z.object({
  items: z.array(contactRecordSchema),
  pageInfo: contactPageInfoSchema
});

export type ContactRecord = z.infer<typeof contactRecordSchema>;
export type ContactPageInfo = z.infer<typeof contactPageInfoSchema>;
export type CreateContactInput = z.infer<typeof createContactInputSchema>;
export type UpdateContactInput = z.infer<typeof updateContactInputSchema>;
export type ListContactsInput = z.infer<typeof listContactsInputSchema>;
export type ListContactsResponse = z.infer<typeof listContactsResponseSchema>;
