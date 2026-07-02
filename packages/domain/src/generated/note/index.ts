import { z } from "zod";

export const noteFieldSchema = z.object({
  body: z.string().trim().min(1),
  dealId: z.string().uuid()
});

export const noteRecordSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  body: z.string().trim().min(1),
  dealId: z.string().uuid(),
  archivedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createNoteInputSchema = z.object({
  body: z.string().trim().min(1),
  dealId: z.string().uuid()
});

export const updateNoteInputSchema = z.object({
  body: z.string().trim().min(1).optional(),
  dealId: z.string().uuid().optional()
});

export const notePageInfoSchema = z.object({
  hasMore: z.boolean(),
  nextCursor: z.string().nullable()
});

export const listNotesInputSchema = z.object({
  archived: z.enum(["exclude", "include", "only"]).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.number().int().positive().max(100).optional(),
  query: z.string().trim().min(1).optional(),
  sortBy: z.enum(["createdAt", "updatedAt"]).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
  dealId: z.string().uuid().optional()
});

export const listNotesResponseSchema = z.object({
  items: z.array(noteRecordSchema),
  pageInfo: notePageInfoSchema
});

export type NoteRecord = z.infer<typeof noteRecordSchema>;
export type NotePageInfo = z.infer<typeof notePageInfoSchema>;
export type CreateNoteInput = z.infer<typeof createNoteInputSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteInputSchema>;
export type ListNotesInput = z.infer<typeof listNotesInputSchema>;
export type ListNotesResponse = z.infer<typeof listNotesResponseSchema>;
