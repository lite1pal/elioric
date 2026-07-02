import { createNoteInputSchema, listNotesInputSchema, updateNoteInputSchema, type CreateNoteInput, type ListNotesInput, type UpdateNoteInput } from "@auditrail/domain/generated/note";
import type { NoteRepo } from "./repo.js";
export function createNoteService(repo: NoteRepo) {
  return {
    async archive(input: { id: string; organizationId: string }) {
      return repo.archive(input);
    },
    async create(input: { data: CreateNoteInput; organizationId: string }) {
      const data = createNoteInputSchema.parse(input.data);
      return repo.create({
        data,
        organizationId: input.organizationId
      });
    },
    async get(input: { id: string; organizationId: string }) {
      return repo.findById(input);
    },
    async list(input: { organizationId: string; filters: ListNotesInput }) {
      return repo.list({
        filters: listNotesInputSchema.parse(input.filters),
        organizationId: input.organizationId
      });
    },
    async unarchive(input: { id: string; organizationId: string }) {
      return repo.unarchive(input);
    },
    async update(input: { data: UpdateNoteInput; id: string; organizationId: string }) {
      const data = updateNoteInputSchema.parse(input.data);
      return repo.update({
        data,
        id: input.id,
        organizationId: input.organizationId
      });
    }
  };
}
