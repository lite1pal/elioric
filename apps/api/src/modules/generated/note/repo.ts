import type { CreateNoteInput, NoteRecord, ListNotesInput, ListNotesResponse, UpdateNoteInput } from "@auditrail/domain/generated/note";
export interface NoteRepo {
  archive(input: { id: string; organizationId: string }): Promise<NoteRecord | undefined>;
  create(input: { organizationId: string; data: CreateNoteInput }): Promise<NoteRecord>;
  findById(input: { id: string; organizationId: string }): Promise<NoteRecord | undefined>;
  list(input: { organizationId: string; filters: ListNotesInput }): Promise<ListNotesResponse>;
  unarchive(input: { id: string; organizationId: string }): Promise<NoteRecord | undefined>;
  update(input: { id: string; organizationId: string; data: UpdateNoteInput }): Promise<NoteRecord | undefined>;
}
