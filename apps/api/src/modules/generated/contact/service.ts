import { createContactInputSchema, listContactsInputSchema, updateContactInputSchema, type CreateContactInput, type ListContactsInput, type UpdateContactInput } from "@auditrail/domain/generated/contact";
import type { ContactRepo } from "./repo.js";
export function createContactService(repo: ContactRepo) {
  return {
    async archive(input: { id: string; organizationId: string }) {
      return repo.archive(input);
    },
    async create(input: { data: CreateContactInput; organizationId: string }) {
      const data = createContactInputSchema.parse(input.data);
      return repo.create({
        data,
        organizationId: input.organizationId
      });
    },
    async get(input: { id: string; organizationId: string }) {
      return repo.findById(input);
    },
    async list(input: { organizationId: string; filters: ListContactsInput }) {
      return repo.list({
        filters: listContactsInputSchema.parse(input.filters),
        organizationId: input.organizationId
      });
    },
    async unarchive(input: { id: string; organizationId: string }) {
      return repo.unarchive(input);
    },
    async update(input: { data: UpdateContactInput; id: string; organizationId: string }) {
      const data = updateContactInputSchema.parse(input.data);
      return repo.update({
        data,
        id: input.id,
        organizationId: input.organizationId
      });
    }
  };
}
