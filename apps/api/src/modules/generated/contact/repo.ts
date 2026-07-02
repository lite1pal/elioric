import type { CreateContactInput, ContactRecord, ListContactsInput, ListContactsResponse, UpdateContactInput } from "@auditrail/domain/generated/contact";
export interface ContactRepo {
  archive(input: { id: string; organizationId: string }): Promise<ContactRecord | undefined>;
  create(input: { organizationId: string; data: CreateContactInput }): Promise<ContactRecord>;
  findById(input: { id: string; organizationId: string }): Promise<ContactRecord | undefined>;
  list(input: { organizationId: string; filters: ListContactsInput }): Promise<ListContactsResponse>;
  unarchive(input: { id: string; organizationId: string }): Promise<ContactRecord | undefined>;
  update(input: { id: string; organizationId: string; data: UpdateContactInput }): Promise<ContactRecord | undefined>;
}
